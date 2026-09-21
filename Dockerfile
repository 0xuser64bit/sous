# One container, two processes: cookie-mcp on loopback + Next.js on $PORT.
# cookie-mcp has no auth of its own, so co-locating keeps it on loopback where
# nothing outside this container can reach it. (--host would bind it wider;
# don't, unless something in front of it enforces auth.)
FROM node:22-slim

# Baked at build time: boot must not depend on the npm registry.
RUN npm i -g cookie-mcp@0.5.0 pnpm@11.24.0

WORKDIR /app
COPY package.json pnpm-lock.yaml pnpm-workspace.yaml ./
RUN pnpm install --frozen-lockfile

COPY . .
RUN pnpm build

# Loopback only — /api/mcp is the sole way in, and it allowlists tools.
ENV MCP_HTTP_URL=http://127.0.0.1:8787/mcp
ENV NODE_ENV=production

COPY start.sh ./
RUN chmod +x start.sh
CMD ["./start.sh"]
