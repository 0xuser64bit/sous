#!/bin/sh
# ponytail: no supervisor. If the sidecar dies the web app serves its honest
# "sidecar is down" errors until the platform restarts the container. Add a
# real supervisor only if that restart proves too slow in practice.
set -e
COOKIE_SIGNER=external cookie-mcp --http 8787 &
trap 'kill 0' TERM INT
exec node_modules/.bin/next start -p "${PORT:-3000}"
