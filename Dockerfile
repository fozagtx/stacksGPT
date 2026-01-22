# USDCx Bridge MCP Server
FROM node:20-alpine

WORKDIR /app

# Install production dependencies first for better caching
COPY package*.json ./
RUN npm ci --only=production

# Install dev dependencies for build
COPY package*.json ./
RUN npm ci

# Copy source code
COPY . .

# Build TypeScript
RUN npm run build

# Remove dev dependencies to keep image lean
RUN npm prune --production

# Expose port
EXPOSE 3001

# Health check
HEALTHCHECK --interval=30s --timeout=3s --start-period=5s --retries=3 \
  CMD node health-check.js

# Start HTTP server (not stdio MCP server)
CMD ["node", "dist/server/http-server.js"]