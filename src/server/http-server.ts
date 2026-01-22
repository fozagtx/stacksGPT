#!/usr/bin/env node

// HTTP server wrapper for MCP server (for ChatGPT Apps SDK)
import express from 'express';
import cors from 'cors';
import { spawn } from 'child_process';
import path from 'path';
import { fileURLToPath } from 'url';

// Import MCP server functions directly
import {
  prepareDepositTransaction,
  getUSDCBalance,
  getEthereumTransactionStatus,
  checkContractHealth,
  type DepositTransactionData
} from './lib/ethereum.js';
import {
  prepareWithdrawalTransaction,
  getUSDCxBalance,
  getStacksTransactionStatus,
  checkStacksContractHealth,
  estimateWithdrawalTime,
  type WithdrawalTransactionData
} from './lib/stacks.js';
import {
  isValidStacksAddress,
  isValidEthereumAddress,
  toMicroUSDC
} from './lib/helpers.js';

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

// Direct MCP handler for better performance
async function handleMCPRequest(requestData: any) {
  const { method, params } = requestData;

  if (method === 'initialize') {
    return {
      jsonrpc: '2.0',
      id: requestData.id,
      result: {
        protocolVersion: '2024-11-05',
        capabilities: {
          tools: {}
        },
        serverInfo: {
          name: 'usdcx-bridge',
          version: '1.0.0'
        }
      }
    };
  }

  if (method === 'tools/list') {
    return {
      jsonrpc: '2.0',
      id: requestData.id,
      result: {
        tools: [
          {
            name: 'prepareDeposit',
            description: 'Prepare transaction to bridge USDC from Ethereum to Stacks as USDCx',
            inputSchema: {
              type: 'object',
              properties: {
                amount: { type: 'string', description: 'Amount of USDC to bridge' },
                stacksRecipient: { type: 'string', description: 'Stacks address to receive USDCx' },
                userEthereumAddress: { type: 'string', description: 'User\'s Ethereum address' }
              },
              required: ['amount', 'stacksRecipient', 'userEthereumAddress']
            }
          },
          {
            name: 'healthCheck',
            description: 'Check if USDCx bridge contracts are operational',
            inputSchema: {
              type: 'object',
              properties: {}
            }
          }
        ]
      }
    };
  }

  if (method === 'tools/call') {
    const { name, arguments: args } = params;

    if (name === 'healthCheck') {
      const [ethHealth, stacksHealth] = await Promise.all([
        checkContractHealth(),
        checkStacksContractHealth()
      ]);

      return {
        jsonrpc: '2.0',
        id: requestData.id,
        result: {
          content: [{
            type: 'text',
            text: `**USDCx Bridge Health Check**\n\n` +
                  `**Ethereum**: ${ethHealth.healthy ? 'Healthy' : `Error - ${ethHealth.error}`}\n` +
                  `**Stacks**: ${stacksHealth.healthy ? 'Healthy' : `Error - ${stacksHealth.error}`}\n\n` +
                  `**Status**: ${ethHealth.healthy && stacksHealth.healthy ? 'Operational' : 'Issues detected'}\n\n` +
                  `Note: Bridge transactions may still work even if health check shows errors.`
          }]
        }
      };
    }

    if (name === 'prepareDeposit') {
      try {
        const { amount, stacksRecipient, userEthereumAddress } = args;

        // Validate inputs
        if (!amount || !stacksRecipient || !userEthereumAddress) {
          throw new Error('Missing required parameters: amount, stacksRecipient, userEthereumAddress');
        }

        if (!isValidStacksAddress(stacksRecipient)) {
          throw new Error('Invalid Stacks address format');
        }

        if (!isValidEthereumAddress(userEthereumAddress)) {
          throw new Error('Invalid Ethereum address format');
        }

        // Prepare the deposit transaction
        const txData = await prepareDepositTransaction(amount, stacksRecipient, userEthereumAddress);

        // Generate ready-to-use code snippets
        const metaMaskSnippet = `
// Bridge ${amount} USDC to USDCx for ${stacksRecipient}
(async () => {
  if (!window.ethereum) throw new Error("MetaMask not found");

  const provider = new ethers.providers.Web3Provider(window.ethereum);
  await provider.send("eth_requestAccounts", []);
  const signer = provider.getSigner();
${txData.requiresApproval ? `
  console.log("Step 1: Approving USDC...");
  const approveTx = await signer.sendTransaction({
    to: "${txData.approvalTx!.to}",
    data: "${txData.approvalTx!.data}"
  });
  console.log("Approval sent:", approveTx.hash);
  await approveTx.wait();
  console.log("Approval confirmed");
` : `  console.log("USDC already approved");`}

  console.log("Step 2: Bridging to Stacks...");
  const depositTx = await signer.sendTransaction({
    to: "${txData.to}",
    data: "${txData.data}",
    gasLimit: ${txData.estimatedGas.toString()}
  });
  console.log("Bridge tx sent:", depositTx.hash);
  await depositTx.wait();
  console.log("Bridge complete! USDCx will arrive in ~15 minutes");
})();`;

        // Generate manual transaction details
        const manualDetails = txData.requiresApproval ?
        `**Step 1: Approve USDC**
• Contract: ${txData.approvalTx!.to}
• Data: ${txData.approvalTx!.data}

**Step 2: Bridge Deposit**
• Contract: ${txData.to}
• Data: ${txData.data}
• Gas Limit: ${txData.estimatedGas}` :
        `**Single Transaction** (pre-approved)
• Contract: ${txData.to}
• Data: ${txData.data}
• Gas Limit: ${txData.estimatedGas}`;

        const statusMessage = txData.requiresApproval ?
          `**STEP 1 REQUIRED**: You must approve USDC spending first, then submit the bridge transaction.` :
          `**READY**: USDC already approved, you can bridge immediately.`;

        return {
          jsonrpc: '2.0',
          id: requestData.id,
          result: {
            content: [{
              type: 'text',
              text: `**Bridge ${amount} USDC → USDCx**\n` +
                    `**Destination**: ${stacksRecipient}\n\n` +
                    `${statusMessage}\n\n` +
                    `**Complete Script (Copy & Paste to Browser Console):**\n\`\`\`javascript${metaMaskSnippet}\`\`\`\n\n` +
                    `**Manual Step-by-Step:**\n${manualDetails}\n\n` +
                    `**Networks**: Ethereum Sepolia → Stacks Testnet\n` +
                    `**Bridge Time**: ~15 minutes after confirmation`
            }]
          }
        };
      } catch (error) {
        return {
          jsonrpc: '2.0',
          id: requestData.id,
          result: {
            content: [{
              type: 'text',
              text: `❌ **Bridge Preparation Failed**\n\n` +
                    `**Error**: ${error instanceof Error ? error.message : 'Unknown error'}\n\n` +
                    `Please check:\n` +
                    `• Amount is ≥1 USDC\n` +
                    `• Valid Stacks address (SP...)\n` +
                    `• Valid Ethereum address (0x...)\n` +
                    `• Network connection`
            }]
          }
        };
      }
    }

    return {
      jsonrpc: '2.0',
      id: requestData.id,
      error: {
        code: -32601,
        message: `Method not found: ${name}`
      }
    };
  }

  return {
    jsonrpc: '2.0',
    id: requestData.id,
    error: {
      code: -32601,
      message: `Method not found: ${method}`
    }
  };
}

// SSE endpoint for ChatGPT integration
app.post('/mcp', async (req, res) => {
  try {
    console.log('MCP request:', JSON.stringify(req.body, null, 2));

    // Set SSE headers
    res.writeHead(200, {
      'Content-Type': 'text/event-stream',
      'Cache-Control': 'no-cache',
      'Connection': 'keep-alive',
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Headers': 'Cache-Control'
    });

    // Add timeout for ChatGPT requests (5 seconds)
    const timeoutPromise = new Promise((_, reject) => {
      setTimeout(() => reject(new Error('Request timeout')), 5000);
    });

    // Handle MCP request directly for better performance
    const mcpResponse = await Promise.race([
      handleMCPRequest(req.body),
      timeoutPromise
    ]);

    console.log('MCP response:', JSON.stringify(mcpResponse, null, 2));

    // Send as SSE event
    res.write(`data: ${JSON.stringify(mcpResponse)}\n\n`);
    res.end();

  } catch (error) {
    console.error('MCP error:', error);

    const errorResponse = {
      jsonrpc: '2.0',
      id: req.body?.id || null,
      error: {
        code: -32603,
        message: 'Internal error',
        data: error instanceof Error ? error.message : 'Unknown error'
      }
    };

    res.writeHead(200, {
      'Content-Type': 'text/event-stream',
      'Cache-Control': 'no-cache',
      'Connection': 'keep-alive'
    });
    res.write(`data: ${JSON.stringify(errorResponse)}\n\n`);
    res.end();
  }
});

// Alternative JSON endpoint for testing
app.post('/mcp-json', async (req, res) => {
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
      mcp: '/mcp (SSE)',
      mcpJson: '/mcp-json (JSON)',
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