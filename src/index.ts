import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { McpAgent } from "agents/mcp";
import { z } from "zod";

// Import bridge services
import {
	prepareDepositTransaction,
	getUSDCBalance,
	getEthereumTransactionStatus,
	checkContractHealth,
} from './server/lib/ethereum.js';
import {
	prepareWithdrawalTransaction,
	getUSDCxBalance,
	getStacksTransactionStatus,
	checkStacksContractHealth,
	estimateWithdrawalTime,
} from './server/lib/stacks.js';
import {
	isValidStacksAddress,
	isValidEthereumAddress,
} from './server/lib/helpers.js';

// Define our MCP agent with USDCx Bridge tools
export class USDCxBridgeMCP extends McpAgent {
	server = new McpServer({
		name: "USDCx Bridge",
		version: "1.0.0",
	});

	async init() {
		// TOOL 1: Prepare USDC deposit to Stacks
		this.server.tool(
			"prepareDeposit",
			{
				amount: z.string().describe('Amount of USDC to bridge (e.g., "10.5")'),
				stacksRecipient: z.string().describe('Stacks address to receive USDCx (starts with ST)'),
				userEthereumAddress: z.string().describe("User's Ethereum address (for allowance checking)"),
			},
			async ({ amount, stacksRecipient, userEthereumAddress }) => {
				try {
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
							type: "text",
							text: `✅ Prepared deposit of ${amount} USDC to ${stacksRecipient.slice(0, 8)}...\n\n` +
								`💰 Amount: ${amount} USDC → ${amount} USDCx\n` +
								`⏰ Estimated time: ~15 minutes\n` +
								`🔧 ${txData.requiresApproval ? 'Approval required first' : 'Ready to bridge'}\n\n` +
								`Connect your MetaMask wallet to sign and execute the transaction.`
						}],
					};
				} catch (error) {
					return {
						content: [{
							type: "text",
							text: `❌ Error: ${error instanceof Error ? error.message : 'Unknown error occurred'}`
						}],
					};
				}
			}
		);

		// TOOL 2: Prepare USDCx withdrawal to Ethereum
		this.server.tool(
			"prepareWithdrawal",
			{
				amount: z.string().describe('Amount of USDCx to withdraw (minimum 4.80)'),
				ethereumRecipient: z.string().describe('Ethereum address to receive USDC'),
				stacksAddress: z.string().describe('Stacks address initiating the withdrawal'),
			},
			async ({ amount, ethereumRecipient, stacksAddress }) => {
				try {
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
							type: "text",
							text: `✅ Prepared withdrawal of ${amount} USDCx to ${ethereumRecipient.slice(0, 8)}...\n\n` +
								`💰 Amount: ${amount} USDCx → ${amount} USDC\n` +
								`⏰ Estimated time: ${estimates.normal}\n` +
								`📝 Estimated fee: ${txData.estimatedFee}\n\n` +
								`Connect your Leather wallet to sign and execute the transaction.`
						}],
					};
				} catch (error) {
					return {
						content: [{
							type: "text",
							text: `❌ Error: ${error instanceof Error ? error.message : 'Unknown error occurred'}`
						}],
					};
				}
			}
		);

		// TOOL 3: Check transaction status
		this.server.tool(
			"checkStatus",
			{
				txHash: z.string().describe('Transaction hash to check'),
				chain: z.enum(['ethereum', 'stacks']).describe('Which chain the transaction is on'),
			},
			async ({ txHash, chain }) => {
				try {
					const status = chain === 'ethereum'
						? await getEthereumTransactionStatus(txHash as `0x${string}`)
						: await getStacksTransactionStatus(txHash);

					const statusEmoji: Record<string, string> = {
						pending: '⏳',
						confirming: '🔄',
						attesting: '🔐',
						completed: '✅',
						failed: '❌'
					};

					return {
						content: [{
							type: "text",
							text: `${statusEmoji[status.state]} **Transaction Status: ${status.state.toUpperCase()}**\n\n` +
								`🔗 Transaction: ${txHash.slice(0, 12)}...${txHash.slice(-8)}\n` +
								`⛓️ Chain: ${chain === 'ethereum' ? 'Ethereum (Sepolia)' : 'Stacks (Testnet)'}\n` +
								`✅ Confirmations: ${status.confirmations}\n` +
								`🌐 [View on Explorer](${status.explorerUrl})\n\n` +
								`${status.eta ? `⏰ ETA: ${status.eta}` : ''}` +
								`${status.errorMessage ? `❌ Error: ${status.errorMessage}` : ''}`
						}],
					};
				} catch (error) {
					return {
						content: [{
							type: "text",
							text: `❌ Error: ${error instanceof Error ? error.message : 'Unknown error occurred'}`
						}],
					};
				}
			}
		);

		// TOOL 4: Get balances
		this.server.tool(
			"getBalances",
			{
				ethereumAddress: z.string().optional().describe('Ethereum address (optional)'),
				stacksAddress: z.string().optional().describe('Stacks address (optional)'),
			},
			async ({ ethereumAddress, stacksAddress }) => {
				try {
					const balances: { usdc?: string; usdcx?: string } = {};

					if (ethereumAddress && isValidEthereumAddress(ethereumAddress)) {
						balances.usdc = await getUSDCBalance(ethereumAddress as `0x${string}`);
					}

					if (stacksAddress && isValidStacksAddress(stacksAddress)) {
						balances.usdcx = await getUSDCxBalance(stacksAddress);
					}

					return {
						content: [{
							type: "text",
							text: `💰 **Your USDCx Bridge Balances**\n\n` +
								`${ethereumAddress ? `🔵 **Ethereum (USDC)**: ${balances.usdc || '0.00'} USDC\n` +
									`   Address: ${ethereumAddress.slice(0, 8)}...${ethereumAddress.slice(-6)}\n\n` : ''}` +
								`${stacksAddress ? `🟠 **Stacks (USDCx)**: ${balances.usdcx || '0.000000'} USDCx\n` +
									`   Address: ${stacksAddress.slice(0, 8)}...${stacksAddress.slice(-6)}` : ''}` +
								`${!ethereumAddress && !stacksAddress ? '⚠️ No addresses provided' : ''}`
						}],
					};
				} catch (error) {
					return {
						content: [{
							type: "text",
							text: `❌ Error: ${error instanceof Error ? error.message : 'Unknown error occurred'}`
						}],
					};
				}
			}
		);

		// TOOL 5: Health check
		this.server.tool(
			"healthCheck",
			{},
			async () => {
				try {
					const [ethHealth, stacksHealth] = await Promise.all([
						checkContractHealth(),
						checkStacksContractHealth()
					]);

					const isHealthy = ethHealth.healthy && stacksHealth.healthy;

					return {
						content: [{
							type: "text",
							text: `🏥 **USDCx Bridge Health Check**\n\n` +
								`🔵 **Ethereum Contracts**: ${ethHealth.healthy ? '✅ Healthy' : `❌ Error: ${ethHealth.error}`}\n` +
								`🟠 **Stacks Contracts**: ${stacksHealth.healthy ? '✅ Healthy' : `❌ Error: ${stacksHealth.error}`}\n\n` +
								`**Overall Status**: ${isHealthy ? '✅ All systems operational' : '⚠️ Some issues detected'}`
						}],
					};
				} catch (error) {
					return {
						content: [{
							type: "text",
							text: `❌ Error: ${error instanceof Error ? error.message : 'Unknown error occurred'}`
						}],
					};
				}
			}
		);
	}
}

export default {
	fetch(request: Request, env: Env, ctx: ExecutionContext) {
		const url = new URL(request.url);

		if (url.pathname === "/mcp") {
			return USDCxBridgeMCP.serve("/mcp").fetch(request, env, ctx);
		}

		return new Response("Not found", { status: 404 });
	},
};