#!/usr/bin/env bash
# Two processes in one container, and either one dying has to take the
# container down with it.
#
# This used to `exec next`, which made the web server PID 1. A sidecar that
# crashed then left a container Docker still called "up": every read and
# every fill failed, the page served nothing but "the kitchen is not
# answering", and `restart: unless-stopped` could not help — it restarts a
# container that exits, and this one never did. Waiting on both means the
# first death ends the script, and the platform recycles us.
#
# A crash loop is the honest failure here. It is visible in `docker ps`,
# which a silently half-dead container is not.
set -uo pipefail

COOKIE_SIGNER=external cookie-mcp --http 8787 &
sidecar=$!

node_modules/.bin/next start -p "${PORT:-3000}" &
web=$!

# Pass `docker stop` through to both rather than sitting out the 10s grace
# period and taking a SIGKILL.
trap 'kill -TERM "$sidecar" "$web" 2>/dev/null || true' TERM INT

# Returns as soon as EITHER child exits, carrying that child's status.
wait -n
status=$?

kill -TERM "$sidecar" "$web" 2>/dev/null || true
wait "$sidecar" "$web" 2>/dev/null || true
exit "$status"
