# USDCx Bridge MCP Server

A Model Context Protocol (MCP) server for bridging USDC between Ethereum and Stacks networks, deployed on Cloudflare Workers.

## Features

- **Prepare Deposits**: Bridge USDC from Ethereum to Stacks (USDCx)
- **Prepare Withdrawals**: Bridge USDCx from Stacks back to Ethereum (USDC)
- **Check Transaction Status**: Monitor bridge transaction progress
- **Get Balances**: Check USDC and USDCx balances
- **Health Check**: Verify bridge contract status

## Architecture

This MCP server runs on Cloudflare Workers using the Streamable HTTP transport protocol, making it accessible from any MCP client including:
- Cloudflare AI Playground
- Claude Desktop (via mcp-remote proxy)
- MCP Inspector
- Other MCP-compatible clients

## Deployment

### Prerequisites

- Node.js 18+ installed
- Cloudflare account
- Wrangler CLI (installed via npm)

### Deploy to Cloudflare Workers

1. **Install dependencies**:
   ```bash
   npm install
   ```

2. **Authenticate with Cloudflare**:
   ```bash
   npx wrangler login
   ```

3. **Deploy**:
   ```bash
   npm run deploy
   ```

   Your MCP server will be live at: `https://usdcx-bridge-mcp.your-account.workers.dev/mcp`

### Local Development

1. **Start development server**:
   ```bash
   npm start
   ```

   Your MCP server will run on `http://localhost:8788/mcp`

2. **Test with MCP Inspector**:
   ```bash
   npx @modelcontextprotocol/inspector@latest
   ```

   Then connect to `http://localhost:8788/mcp`

## Configuration

Environment variables are configured in `wrangler.jsonc`:

- `ETHEREUM_RPC_URL`: Ethereum RPC endpoint (Sepolia testnet)
- `STACKS_NETWORK`: Stacks network (testnet)
- `XRESERVE_CONTRACT`: xReserve bridge contract address
- `USDC_CONTRACT`: USDC token contract address
- `STACKS_USDCX_CONTRACT`: USDCx contract on Stacks
- `STACKS_DOMAIN`: Stacks domain identifier
- `ETHEREUM_DOMAIN`: Ethereum domain identifier

## Available Tools

### 1. prepareDeposit
Prepare a USDC deposit from Ethereum to Stacks.

**Parameters:**
- `amount`: Amount of USDC to bridge (e.g., "10.5")
- `stacksRecipient`: Stacks address to receive USDCx
- `userEthereumAddress`: User's Ethereum address

### 2. prepareWithdrawal
Prepare a USDCx withdrawal from Stacks to Ethereum.

**Parameters:**
- `amount`: Amount of USDCx to withdraw (minimum 4.80)
- `ethereumRecipient`: Ethereum address to receive USDC
- `stacksAddress`: Stacks address initiating withdrawal

### 3. checkStatus
Check the status of a bridge transaction.

**Parameters:**
- `txHash`: Transaction hash
- `chain`: "ethereum" or "stacks"

### 4. getBalances
Get USDC and USDCx balances.

**Parameters:**
- `ethereumAddress`: (optional) Ethereum address
- `stacksAddress`: (optional) Stacks address

### 5. healthCheck
Check the health of bridge contracts.

**No parameters required**

## Connecting to MCP Clients

### Claude Desktop (via mcp-remote)

Add to your Claude Desktop config:

```json
{
  "mcpServers": {
    "usdcx-bridge": {
      "command": "npx",
      "args": [
        "mcp-remote",
        "https://usdcx-bridge-mcp.your-account.workers.dev/mcp"
      ]
    }
  }
}
```

### Cloudflare AI Playground

1. Go to https://playground.ai.cloudflare.com/
2. Click "Add MCP Server"
3. Enter your MCP server URL: `https://usdcx-bridge-mcp.your-account.workers.dev/mcp`

## Project Structure

```
stacksGPT/
├── src/
│   ├── index.ts              # Main Workers entry point & MCP server
│   └── server/
│       └── lib/
│           ├── ethereum.ts   # Ethereum bridge logic
│           ├── stacks.ts     # Stacks bridge logic
│           └── helpers.ts    # Utility functions
├── widgets/                  # Bridge UI widgets
├── wrangler.jsonc           # Cloudflare Workers config
├── package.json
├── tsconfig.json
└── README.md
```

## Development Scripts

- `npm run deploy` - Deploy to Cloudflare Workers
- `npm run dev` - Start local development server
- `npm start` - Alias for dev
- `npm run type-check` - Run TypeScript type checking
- `npm run cf-typegen` - Generate Cloudflare Workers types

## License

MIT