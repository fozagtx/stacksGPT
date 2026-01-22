// Simple health check for Railway deployment
const http = require('http');

const server = http.createServer((req, res) => {
  if (req.url === '/health') {
    res.writeHead(200, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({
      status: 'healthy',
      service: 'usdcx-bridge-mcp',
      timestamp: new Date().toISOString()
    }));
  } else {
    res.writeHead(404);
    res.end('MCP Server running on stdio');
  }
});

const port = process.env.PORT || 3001;
server.listen(port, () => {
  console.log(`Health check server running on port ${port}`);
});