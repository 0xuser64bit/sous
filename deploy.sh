#!/usr/bin/env bash
# One-shot deploy for a fresh Oracle Cloud VM (Ubuntu or Oracle Linux).
#
#   ./deploy.sh sous.usevora.fun
#
# Installs Docker, adds swap on small shapes, opens the host firewall, and
# brings up the app behind Caddy with an automatic Let's Encrypt cert.
# Safe to re-run: every step checks before it acts.
#
# The ONE thing this cannot do is open Oracle's VCN Security List — that
# lives in the cloud console, not on the VM. The script checks for it and
# tells you if it is still shut.
set -euo pipefail

DOMAIN="${1:-${SOUS_DOMAIN:-}}"
REPO_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"

say()  { printf '\n\033[1;33m==> %s\033[0m\n' "$*"; }
ok()   { printf '    \033[0;32m✓\033[0m %s\n' "$*"; }
warn() { printf '    \033[0;33m!\033[0m %s\n' "$*"; }
die()  { printf '\n\033[0;31mx %s\033[0m\n' "$*" >&2; exit 1; }

[ -n "$DOMAIN" ] || die "usage: ./deploy.sh <domain>   e.g. ./deploy.sh sous.usevora.fun"
[ -f "$REPO_DIR/docker-compose.yml" ] || die "run this from inside the repo"

# sudo, or nothing if already root. Avoids the usermod/re-login dance entirely:
# every docker call in this script goes through sudo.
SUDO=""
[ "$(id -u)" -ne 0 ] && SUDO="sudo"

# ---------------------------------------------------------------- curl
# Needed by the Docker installer and by every check below.
if ! command -v curl >/dev/null 2>&1; then
  say "curl"
  if command -v apt-get >/dev/null 2>&1; then
    $SUDO apt-get update -qq && DEBIAN_FRONTEND=noninteractive $SUDO apt-get install -y curl >/dev/null
  elif command -v dnf >/dev/null 2>&1; then
    $SUDO dnf install -y curl >/dev/null
  else
    die "curl is missing and I cannot tell which package manager to use"
  fi
  ok "installed"
fi

# ---------------------------------------------------------------- swap
# next build peaks well over 1GB. The Always Free AMD micro has exactly 1GB
# and will OOM mid-build without this. The ARM Ampere shape has plenty.
say "Swap"
MEM_KB=$(awk '/MemTotal/{print $2}' /proc/meminfo)
if [ "$MEM_KB" -lt 2000000 ] && [ "$(swapon --show --noheadings | wc -l)" -eq 0 ]; then
  $SUDO fallocate -l 2G /swapfile
  $SUDO chmod 600 /swapfile
  $SUDO mkswap /swapfile >/dev/null
  $SUDO swapon /swapfile
  grep -q '^/swapfile' /etc/fstab || echo '/swapfile none swap sw 0 0' | $SUDO tee -a /etc/fstab >/dev/null
  ok "added 2G swap (only ${MEM_KB}kB RAM — the build needs it)"
else
  ok "enough memory, or swap already on"
fi

# ---------------------------------------------------------------- docker
say "Docker"
if command -v docker >/dev/null 2>&1; then
  ok "already installed"
else
  curl -fsSL https://get.docker.com | $SUDO sh
  ok "installed"
fi
$SUDO systemctl enable --now docker >/dev/null 2>&1 || true
$SUDO docker compose version >/dev/null 2>&1 || die "docker compose plugin missing — install docker-compose-plugin and re-run"
# Convenience for later interactive use; this shell still uses sudo.
if [ -n "$SUDO" ] && ! id -nG "$USER" | grep -qw docker; then
  $SUDO usermod -aG docker "$USER"
  warn "added $USER to the docker group — log out and back in to use docker without sudo"
fi
ok "compose ready"

# ---------------------------------------------------------------- firewall
# Oracle images ship a host firewall that drops everything but SSH. This is
# the step people miss, because the console Security List looks like the only
# one. Both have to be open.
say "Host firewall (80/443)"
if command -v firewall-cmd >/dev/null 2>&1 && $SUDO firewall-cmd --state >/dev/null 2>&1; then
  $SUDO firewall-cmd --permanent --add-service=http  >/dev/null
  $SUDO firewall-cmd --permanent --add-service=https >/dev/null
  $SUDO firewall-cmd --reload >/dev/null
  ok "firewalld: http + https open"
elif command -v iptables >/dev/null 2>&1; then
  for port in 80 443; do
    if $SUDO iptables -C INPUT -p tcp --dport "$port" -j ACCEPT 2>/dev/null; then
      ok "iptables: $port already open"
    else
      # Insert at the top: Oracle's chain ends in a REJECT, so appending does nothing.
      $SUDO iptables -I INPUT 1 -p tcp --dport "$port" -j ACCEPT
      ok "iptables: opened $port"
    fi
  done
  if command -v netfilter-persistent >/dev/null 2>&1; then
    $SUDO netfilter-persistent save >/dev/null
    ok "rules persisted"
  else
    DEBIAN_FRONTEND=noninteractive $SUDO apt-get install -y iptables-persistent >/dev/null 2>&1 \
      && ok "rules persisted" \
      || warn "could not persist iptables rules — they will not survive a reboot"
  fi
else
  warn "no firewalld or iptables found; assuming the host is open"
fi

# ---------------------------------------------------------------- DNS
say "DNS"
PUBLIC_IP="$(curl -fsS --max-time 10 https://api.ipify.org 2>/dev/null || true)"
RESOLVED="$(getent hosts "$DOMAIN" 2>/dev/null | awk '{print $1; exit}' || true)"
if [ -z "$RESOLVED" ]; then
  die "$DOMAIN does not resolve yet.
    Add an A record:  $DOMAIN  ->  ${PUBLIC_IP:-the public IP of this VM}
    On Cloudflare set it to DNS only (grey cloud) — a proxied record breaks
    Caddy's certificate challenge. Re-run this script once it resolves."
elif [ -n "$PUBLIC_IP" ] && [ "$RESOLVED" != "$PUBLIC_IP" ]; then
  warn "$DOMAIN resolves to $RESOLVED but this VM is $PUBLIC_IP"
  warn "if that is a Cloudflare proxy IP, switch the record to DNS only (grey cloud)"
else
  ok "$DOMAIN -> $RESOLVED"
fi

# ---------------------------------------------------------------- up
say "Build and start"
cd "$REPO_DIR"
# SOUS_PORT is the loopback port the app publishes on. It only matters in
# shared-host mode (below), but it is always kept in .env so re-runs reuse it.
SOUS_PORT="${SOUS_PORT:-}"
if [ -z "$SOUS_PORT" ] && [ -f .env ]; then
  SOUS_PORT="$(grep -E '^SOUS_PORT=' .env | cut -d= -f2 | tail -n1 || true)"
fi
[ -n "$SOUS_PORT" ] || SOUS_PORT=3100
if [ -f .env ] && grep -q '^SOUS_DOMAIN=' .env; then
  $SUDO sed -i "s|^SOUS_DOMAIN=.*|SOUS_DOMAIN=$DOMAIN|" .env
else
  echo "SOUS_DOMAIN=$DOMAIN" >> .env
fi
if grep -q '^SOUS_PORT=' .env 2>/dev/null; then
  $SUDO sed -i "s|^SOUS_PORT=.*|SOUS_PORT=$SOUS_PORT|" .env
else
  echo "SOUS_PORT=$SOUS_PORT" >> .env
fi
ok "SOUS_DOMAIN=$DOMAIN SOUS_PORT=$SOUS_PORT"

# This VM may already host other sites behind a system-wide Caddy (port 80
# taken). A second Caddy in docker cannot bind 80/443 then — the exact
# "address already in use" failure. In that case run only the app container
# (published on 127.0.0.1:$SOUS_PORT) and let the host Caddy route $DOMAIN
# to it, instead of starting the docker Caddy.
SHARED_MODE=0
if $SUDO systemctl is-active --quiet caddy 2>/dev/null; then
  SHARED_MODE=1
elif $SUDO ss -tln 2>/dev/null | grep -qE ':80(\s|$)'; then
  SHARED_MODE=1
fi

if [ "$SHARED_MODE" -eq 1 ]; then
  say "Shared host detected (port 80 already bound) — using host Caddy"
  $SUDO docker compose up -d --build app
  # The compose file still defines a docker Caddy for fresh-VM use; make sure
  # a stale one from an earlier run is not left behind to confuse anyone.
  $SUDO docker compose stop caddy >/dev/null 2>&1 || true
  $SUDO docker compose rm -f caddy >/dev/null 2>&1 || true
  ok "app container up on 127.0.0.1:$SOUS_PORT"
  say "Host Caddy ($DOMAIN -> 127.0.0.1:$SOUS_PORT)"
  $SUDO python3 - "$DOMAIN" "$SOUS_PORT" <<'PYEOF'
import re, sys
domain, port = sys.argv[1], sys.argv[2]
path = "/etc/caddy/Caddyfile"
with open(path) as f:
    src = f.read()
block = "%s {\n\tencode gzip zstd\n\treverse_proxy 127.0.0.1:%s\n}\n" % (domain, port)
# Replace an existing block for this domain, else append.
pat = re.compile(r"(?m)^[ \t]*" + re.escape(domain) + r"[ \t]*\{.*?\n\}[ \t]*\n?", re.DOTALL)
if pat.search(src):
    src = pat.sub(block, src)
else:
    if not src.endswith("\n"):
        src += "\n"
    src += "\n" + block
with open(path, "w") as f:
    f.write(src)
print("Caddyfile updated for %s" % domain)
PYEOF
  $SUDO caddy validate --config /etc/caddy/Caddyfile --adapter caddyfile >/dev/null \
    || die "host Caddyfile failed validation — fix /etc/caddy/Caddyfile and re-run"
  $SUDO systemctl reload caddy
  ok "host Caddy reloaded"
else
  $SUDO docker compose up -d --build
  ok "containers up"
fi

# ---------------------------------------------------------------- verify
say "Verify"
# The app answers before Caddy has a cert; check it first so a TLS failure
# is not mistaken for a broken app.
for i in $(seq 1 30); do
  # node, not curl/wget: node:22-slim ships neither, but it is by definition a node image.
  if $SUDO docker compose exec -T app node -e \
    "fetch('http://127.0.0.1:3000/api/health').then(r=>process.exit(r.ok?0:1)).catch(()=>process.exit(1))" \
    >/dev/null 2>&1; then
    ok "app is serving (sidecar + Next.js both up)"
    break
  fi
  [ "$i" -eq 30 ] && { warn "app did not answer in 60s — check: sudo docker compose logs app"; break; }
  sleep 2
done

printf '    waiting for the certificate'
for i in $(seq 1 30); do
  if curl -fsS --max-time 5 "https://$DOMAIN/api/health" >/dev/null 2>&1; then
    printf '\n'; ok "https://$DOMAIN is live"
    echo
    curl -fsS "https://$DOMAIN/api/health"; echo
    say "Done — submit this URL:  https://$DOMAIN"
    exit 0
  fi
  printf '.'; sleep 4
done

printf '\n'
warn "no answer on https://$DOMAIN after 2 minutes"
if [ "${SHARED_MODE:-0}" -eq 1 ]; then
  cat <<EOF

    Shared-host mode: the host Caddy serves this domain. Check:
      sudo systemctl status caddy --no-pager | head -20
      sudo journalctl -u caddy --since "10 min ago" --no-pager | tail -30
      curl -s http://127.0.0.1:${SOUS_PORT}/api/health   (bypasses Caddy)
EOF
else
  cat <<EOF

    Almost always Oracle's VCN Security List. Open it in the console:
      Networking > Virtual Cloud Networks > your VCN > Subnet > Security List
      Add ingress rules, Source 0.0.0.0/0, TCP, destination ports 80 and 443

    Then check the cert:  sudo docker compose logs caddy | tail -30
EOF
fi
exit 1
