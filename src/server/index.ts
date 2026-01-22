#!/usr/bin/env node

// USDCx Bridge MCP Server for ChatGPT Apps SDK
import { Server } from '@modelcontextprotocol/sdk/server/index.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import {
  CallToolRequestSchema,
  ListToolsRequestSchema,
  type Tool
} from '@modelcontextprotocol/sdk/types.js';
import { z } from 'zod';

// Import bridge services
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

const server = new Server(
  {
    name: 'usdcx-bridge',
    version: '1.0.0'
  },
  {
    capabilities: {
      tools: {}
    }
  }
);

// TOOL 1: Prepare USDC deposit to Stacks
server.setRequestHandler(ListToolsRequestSchema, async () => {
  return {
    tools: [
      {
        name: 'prepareDeposit',
        description: 'Prepare transaction to bridge USDC from Ethereum to Stacks as USDCx',
        inputSchema: {
          type: 'object',
          properties: {
            amount: {
              type: 'string',
              description: 'Amount of USDC to bridge (e.g., "10.5")'
            },
            stacksRecipient: {
              type: 'string',
              description: 'Stacks address to receive USDCx (starts with ST)'
            },
            userEthereumAddress: {
              type: 'string',
              description: 'User\'s Ethereum address (for allowance checking)'
            }
          },
          required: ['amount', 'stacksRecipient', 'userEthereumAddress']
        }
      },
      {
        name: 'prepareWithdrawal',
        description: 'Prepare transaction to withdraw USDCx from Stacks to Ethereum as USDC',
        inputSchema: {
          type: 'object',
          properties: {
            amount: {
              type: 'string',
              description: 'Amount of USDCx to withdraw (minimum 4.80)'
            },
            ethereumRecipient: {
              type: 'string',
              description: 'Ethereum address to receive USDC'
            },
            stacksAddress: {
              type: 'string',
              description: 'Stacks address initiating the withdrawal'
            }
          },
          required: ['amount', 'ethereumRecipient', 'stacksAddress']
        }
      },
      {
        name: 'checkStatus',
        description: 'Check the current status of a bridge transaction',
        inputSchema: {
          type: 'object',
          properties: {
            txHash: {
              type: 'string',
              description: 'Transaction hash to check'
            },
            chain: {
              type: 'string',
              enum: ['ethereum', 'stacks'],
              description: 'Which chain the transaction is on'
            }
          },
          required: ['txHash', 'chain']
        }
      },
      {
        name: 'getBalances',
        description: 'Get USDC and USDCx balances for user addresses',
        inputSchema: {
          type: 'object',
          properties: {
            ethereumAddress: {
              type: 'string',
              description: 'Ethereum address (optional)'
            },
            stacksAddress: {
              type: 'string',
              description: 'Stacks address (optional)'
            }
          }
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
    ] as Tool[]
  };
});

// Handle tool calls
server.setRequestHandler(CallToolRequestSchema, async (request) => {
  const { name, arguments: args } = request.params;

  try {
    switch (name) {
      case 'prepareDeposit': {
        const { amount, stacksRecipient, userEthereumAddress } = args as {
          amount: string;
          stacksRecipient: string;
          userEthereumAddress: string;
        };

        // Validate inputs
        if (!isValidStacksAddress(stacksRecipient)) {
          throw new Error('Invalid Stacks address format');
        }
        if (!isValidEthereumAddress(userEthereumAddress)) {
          throw new Error('Invalid Ethereum address format');
        }
        if (parseFloat(amount) < 1) {
          throw new Error('Minimum deposit is 1 USDC on testnet');
        }

        const txData = await prepareDepositTransaction(
          amount,
          stacksRecipient,
          userEthereumAddress as `0x${string}`
        );

        return {
          content: [{
            type: 'text',
            text: `✅ Prepared deposit of ${amount} USDC to ${stacksRecipient.slice(0, 8)}...\n\n` +
                  `💰 Amount: ${amount} USDC → ${amount} USDCx\n` +
                  `⏰ Estimated time: ~15 minutes\n` +
                  `🔧 ${txData.requiresApproval ? 'Approval required first' : 'Ready to bridge'}\n\n` +
                  `Connect your MetaMask wallet in the widget below to sign and execute the transaction.`
          }],
          _meta: {
            transactionData: txData,
            bridgeType: 'deposit',
            fromChain: 'ethereum',
            toChain: 'stacks',
            amount,
            recipient: stacksRecipient
          }
        };
      }

      case 'prepareWithdrawal': {
        const { amount, ethereumRecipient, stacksAddress } = args as {
          amount: string;
          ethereumRecipient: string;
          stacksAddress: string;
        };

        // Validate inputs
        if (!isValidEthereumAddress(ethereumRecipient)) {
          throw new Error('Invalid Ethereum address format');
        }
        if (!isValidStacksAddress(stacksAddress)) {
          throw new Error('Invalid Stacks address format');
        }
        if (parseFloat(amount) < 4.80) {
          throw new Error('Minimum withdrawal is 4.80 USDCx');
        }

        const txData = await prepareWithdrawalTransaction(
          amount,
          ethereumRecipient,
          stacksAddress
        );

        const estimates = estimateWithdrawalTime();

        return {
          content: [{
            type: 'text',
            text: `✅ Prepared withdrawal of ${amount} USDCx to ${ethereumRecipient.slice(0, 8)}...\n\n` +
                  `💰 Amount: ${amount} USDCx → ${amount} USDC\n` +
                  `⏰ Estimated time: ${estimates.normal}\n` +
                  `📝 Estimated fee: ${txData.estimatedFee}\n\n` +
                  `Connect your Leather wallet in the widget below to sign and execute the transaction.`
          }],
          _meta: {
            transactionData: txData,
            bridgeType: 'withdrawal',
            fromChain: 'stacks',
            toChain: 'ethereum',
            amount,
            recipient: ethereumRecipient
          }
        };
      }

      case 'checkStatus': {
        const { txHash, chain } = args as {
          txHash: string;
          chain: 'ethereum' | 'stacks';
        };

        const status = chain === 'ethereum'
          ? await getEthereumTransactionStatus(txHash as `0x${string}`)
          : await getStacksTransactionStatus(txHash);

        const statusEmoji = {
          pending: '⏳',
          confirming: '🔄',
          attesting: '🔐',
          completed: '✅',
          failed: '❌'
        }[status.state];

        return {
          content: [{
            type: 'text',
            text: `${statusEmoji} **Transaction Status: ${status.state.toUpperCase()}**\n\n` +
                  `🔗 Transaction: ${txHash.slice(0, 12)}...${txHash.slice(-8)}\n` +
                  `⛓️ Chain: ${chain === 'ethereum' ? 'Ethereum (Sepolia)' : 'Stacks (Testnet)'}\n` +
                  `✅ Confirmations: ${status.confirmations}\n` +
                  `🌐 [View on Explorer](${status.explorerUrl})\n\n` +
                  `${status.eta ? `⏰ ETA: ${status.eta}` : ''}` +
                  `${status.errorMessage ? `❌ Error: ${status.errorMessage}` : ''}`
          }],
          _meta: {
            transactionHash: txHash,
            chain,
            status: status.state,
            confirmations: status.confirmations,
            explorerUrl: status.explorerUrl
          }
        };
      }

      case 'getBalances': {
        const { ethereumAddress, stacksAddress } = args as {
          ethereumAddress?: string;
          stacksAddress?: string;
        };

        const balances: { usdc?: string; usdcx?: string } = {};

        if (ethereumAddress && isValidEthereumAddress(ethereumAddress)) {
          balances.usdc = await getUSDCBalance(ethereumAddress as `0x${string}`);
        }

        if (stacksAddress && isValidStacksAddress(stacksAddress)) {
          balances.usdcx = await getUSDCxBalance(stacksAddress);
        }

        return {
          content: [{
            type: 'text',
            text: `💰 **Your USDCx Bridge Balances**\n\n` +
                  `${ethereumAddress ? `🔵 **Ethereum (USDC)**: ${balances.usdc || '0.00'} USDC\n` +
                  `   Address: ${ethereumAddress.slice(0, 8)}...${ethereumAddress.slice(-6)}\n\n` : ''}` +
                  `${stacksAddress ? `🟠 **Stacks (USDCx)**: ${balances.usdcx || '0.000000'} USDCx\n` +
                  `   Address: ${stacksAddress.slice(0, 8)}...${stacksAddress.slice(-6)}` : ''}` +
                  `${!ethereumAddress && !stacksAddress ? '⚠️ No addresses provided' : ''}`
          }],
          _meta: {
            balances,
            ethereumAddress,
            stacksAddress
          }
        };
      }

      case 'healthCheck': {
        const [ethHealth, stacksHealth] = await Promise.all([
          checkContractHealth(),
          checkStacksContractHealth()
        ]);

        const isHealthy = ethHealth.healthy && stacksHealth.healthy;

        return {
          content: [{
            type: 'text',
            text: `🏥 **USDCx Bridge Health Check**\n\n` +
                  `🔵 **Ethereum Contracts**: ${ethHealth.healthy ? '✅ Healthy' : `❌ Error: ${ethHealth.error}`}\n` +
                  `🟠 **Stacks Contracts**: ${stacksHealth.healthy ? '✅ Healthy' : `❌ Error: ${stacksHealth.error}`}\n\n` +
                  `**Overall Status**: ${isHealthy ? '✅ All systems operational' : '⚠️ Some issues detected'}`
          }],
          _meta: {
            ethereum: ethHealth,
            stacks: stacksHealth,
            overall: isHealthy
          }
        };
      }

      default:
        throw new Error(`Unknown tool: ${name}`);
    }
  } catch (error) {
    console.error(`Error in tool ${name}:`, error);
    return {
      content: [{
        type: 'text',
        text: `❌ **Error**: ${error instanceof Error ? error.message : 'Unknown error occurred'}`
      }],
      isError: true
    };
  }
});

// Start the server
async function main() {
  const transport = new StdioServerTransport();
  await server.connect(transport);
  console.error('USDCx Bridge MCP server running on stdio');
}

main().catch(console.error);