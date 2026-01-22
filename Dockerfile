# USDCx Bridge MCP Server
FROM node:20-alpine

WORKDIR /app

# Copy package files
COPY package*.json ./

# Install dependencies
RUN npm ci --only=production

# Copy source code
COPY . .

# Build TypeScript
RUN npm run build

# Expose MCP server port
EXPOSE 3001

# Health check endpoint
COPY health-check.js ./

# Start MCP server
CMD ["node", "dist/server/index.js"]