#!/usr/bin/env node

// HTTP server wrapper for MCP server (for ChatGPT Apps SDK)
import express from 'express';
import cors from 'cors';
import { spawn } from 'child_process';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
const port = Number(process.env.PORT) || 3001;

// Middleware
app.use(cors());
app.use(express.json());

// Health check endpoint
app.get('/health', (req, res) => {
  res.json({
    status: 'healthy',
    service: 'usdcx-bridge-mcp',
    timestamp: new Date().toISOString(),
    version: '1.0.0'
  });
});

// MCP endpoint for ChatGPT
app.post('/mcp', async (req, res) => {
  try {
    // Spawn MCP server process for each request
    const mcpServer = spawn('node', [path.join(__dirname, 'index.js')], {
      stdio: ['pipe', 'pipe', 'pipe']
    });

    // Send request to MCP server
    mcpServer.stdin.write(JSON.stringify(req.body) + '\n');
    mcpServer.stdin.end();

    let response = '';
    mcpServer.stdout.on('data', (data) => {
      response += data.toString();
    });

    mcpServer.on('close', (code) => {
      try {
        const mcpResponse = JSON.parse(response);
        res.json(mcpResponse);
      } catch (error) {
        res.status(500).json({
          error: 'Failed to parse MCP response',
          details: error instanceof Error ? error.message : 'Unknown error',
          response
        });
      }
    });

    mcpServer.on('error', (error) => {
      res.status(500).json({
        error: 'MCP server error',
        details: error instanceof Error ? error.message : 'Unknown error'
      });
    });

  } catch (error) {
    res.status(500).json({
      error: 'Failed to process MCP request',
      details: error instanceof Error ? error.message : 'Unknown error'
    });
  }
});

// Static file serving for widgets (if needed)
app.use('/widgets', express.static(path.join(__dirname, '../../widgets')));

// Default route
app.get('/', (req, res) => {
  res.json({
    name: 'USDCx Bridge MCP Server',
    description: 'ChatGPT App for bridging USDC between Ethereum and Stacks',
    version: '1.0.0',
    endpoints: {
      health: '/health',
      mcp: '/mcp',
      widgets: '/widgets'
    },
    documentation: 'https://github.com/your-username/usdcx-bridge-app'
  });
});

// Start server
app.listen(port, '0.0.0.0', () => {
  console.log(`🚀 USDCx Bridge MCP Server running on port ${port}`);
  console.log(`📊 Health check: http://localhost:${port}/health`);
  console.log(`🔗 MCP endpoint: http://localhost:${port}/mcp`);
  console.log(`🎨 Widgets: http://localhost:${port}/widgets`);
});