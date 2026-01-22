# USDCx Bridge

**Bridge USDC to Stacks using ChatGPT. No contracts. No complexity. Just conversation.**

![License](https://img.shields.io/badge/license-MIT-blue.svg)
![Version](https://img.shields.io/badge/version-1.0.0-green.svg)
![MCP](https://img.shields.io/badge/MCP-Compatible-purple.svg)

---

The first conversational bridge interface built on ChatGPT's Apps SDK and Model Context Protocol.

## What It Does

Talk to ChatGPT, connect your wallets (MetaMask + Leather), and bridge USDC between Ethereum and Stacks—all without leaving the chat interface.

## Why It Exists

Bridging USDC to Stacks today requires manual smart contract calls, complex address encoding (c32 → bytes32), and waiting 15-60 minutes with zero visibility.

**USDCx Bridge** makes it as easy as describing what you want in plain English.

## How It Works

1. **Natural language** - "Bridge 50 USDC to Stacks"
2. **Widget appears** - React component renders in ChatGPT
3. **Connect wallets** - MetaMask for Ethereum, Leather for Stacks
4. **Sign & bridge** - One click, you sign with your wallet
5. **Track live** - See confirmations and ETA in real-time

## Features

- ✅ **Conversational interface** - No technical knowledge required
- ✅ **Your wallets, your control** - We never custody funds
- ✅ **Live status tracking** - Know exactly what's happening
- ✅ **Built on official protocols** - Circle xReserve + Stacks attestation
- ✅ **Open source** - Verify everything
- ✅ **First MCP blockchain app** - Sets the standard

## Quick Start

### 1. Enable Developer Mode in ChatGPT settings

### 2. Create a custom app and add this MCP server:

```
https://usdcxbridge.fly.dev/mcp
```

### 3. Type in ChatGPT:

```
"Bridge USDC to Stacks"
```

**That's it.** The widget will appear and guide you through the rest.

## Tech Stack

### Backend

- **@modelcontextprotocol/sdk** - MCP server
- **viem** - Ethereum contract interactions
- **@stacks/transactions** - Stacks operations
- **Node.js + TypeScript**

### Frontend (Widgets)

- **React + TypeScript**
- **viem** - Ethereum wallet connections
- **@stacks/connect** - Stacks wallet integration

### Bridge Infrastructure

- **Circle xReserve** (Ethereum smart contracts)
- **Stacks attestation service**

## Security

- ✅ You connect your own wallets
- ✅ You sign every transaction
- ✅ We never custody your funds
- ✅ We never access your private keys
- ✅ Uses official Circle xReserve protocol

## Development

### Prerequisites

- Node.js 18+
- npm or pnpm

### Installation

```bash
# Clone repo
git clone https://github.com/yourusername/usdcx-bridge.git
cd usdcx-bridge

# Install dependencies
npm install

# Build everything (server + widgets)
npm run build

# Run MCP server locally (stdio mode)
npm start

# Run HTTP server (for ChatGPT integration)
npm run start:http

# Test with MCP inspector
npm test
```

### Environment Variables

Create a `.env` file:

```bash
# Ethereum Network (mainnet or testnet)
ETHEREUM_NETWORK=testnet
ETHEREUM_RPC_URL=https://ethereum-sepolia.publicnode.com

# Stacks Network
STACKS_NETWORK=testnet

# Contract Addresses (Testnet)
XRESERVE_CONTRACT=0x008888878f94C0d87defdf0B07f46B93C1934442
USDC_CONTRACT=0x1c7D4B196Cb0C7B01d743Fbc6116a902379C7238
STACKS_USDCX_CONTRACT=ST1PQHQKV0RJXZFY1DGX8MNSNYVE3VGZJSRTPGZGM.usdcx-v1

# HTTP Server
PORT=3001
BASE_URL=http://localhost:3001
```

### Project Structure

```
usdcx-bridge/
├── src/
│   ├── server/
│   │   ├── index.ts           # MCP server (stdio mode)
│   │   ├── http-server.ts     # HTTP wrapper for ChatGPT
│   │   └── lib/
│   │       ├── ethereum.ts    # Ethereum/xReserve logic
│   │       ├── stacks.ts      # Stacks/USDCx logic
│   │       └── helpers.ts     # Address encoding utilities
│   └── widgets/
│       ├── DepositWidget.tsx      # Ethereum → Stacks
│       ├── WithdrawalWidget.tsx   # Stacks → Ethereum
│       ├── StatusWidget.tsx       # Transaction tracking
│       └── hooks/
│           ├── useMetaMask.ts     # MetaMask integration
│           └── useLeather.ts      # Leather wallet integration
├── dist/                      # Built files
├── package.json
├── tsconfig.json
└── README.md
```

## Architecture

```
ChatGPT
    ↓
MCP Server (tools: prepareDeposit, prepareWithdrawal, checkStatus)
    ↓
React Widgets (wallet connection + transaction signing)
    ↓
Smart Contracts (xReserve on Ethereum, usdcx-v1 on Stacks)
```

## MCP Tools

The server exposes these tools to ChatGPT:

### `prepareDeposit`
Prepares USDC → USDCx bridge transaction (Ethereum to Stacks)

**Parameters:**
- `amount` - Amount of USDC to bridge
- `stacksRecipient` - Destination Stacks address
- `userEthereumAddress` - User's Ethereum address

**Returns:** Widget URL for MetaMask signing

### `prepareWithdrawal`
Prepares USDCx → USDC withdrawal transaction (Stacks to Ethereum)

**Parameters:**
- `amount` - Amount of USDCx to withdraw (minimum 4.80)
- `ethereumRecipient` - Destination Ethereum address
- `stacksAddress` - User's Stacks address

**Returns:** Widget URL for Leather signing

### `checkStatus`
Checks transaction status on either chain

**Parameters:**
- `txHash` - Transaction hash
- `chain` - Either "ethereum" or "stacks"

**Returns:** Status widget with live updates

### `getBalances`
Gets USDC and USDCx balances

**Parameters:**
- `ethereumAddress` (optional)
- `stacksAddress` (optional)

**Returns:** Balance information

### `healthCheck`
Verifies bridge contracts are operational

**Returns:** System status

## Deployment

### Docker

```bash
# Build image
docker build -t usdcx-bridge .

# Run container
docker run -p 3001:3001 usdcx-bridge
```

### Fly.io

```bash
# Install flyctl
curl -L https://fly.io/install.sh | sh

# Deploy
fly deploy
```

### Manual

```bash
# Build
npm run build

# Start
NODE_ENV=production npm run start:http
```

## Testing

### Local Testing with MCP Inspector

```bash
npm test
```

This opens the MCP inspector for testing tools locally.

### Test Deposit Flow

1. Get testnet USDC from Sepolia faucet
2. In ChatGPT: "Bridge 5 USDC to ST1PQHQKV0RJXZFY1DGX8MNSNYVE3VGZJSRTPGZGM"
3. Click widget link
4. Connect MetaMask
5. Approve USDC (if needed)
6. Sign bridge transaction
7. Wait ~15 minutes
8. Check USDCx balance on Stacks

### Test Withdrawal Flow

1. Ensure you have USDCx on Stacks testnet
2. In ChatGPT: "Withdraw 5 USDCx to 0xYourEthereumAddress"
3. Click widget link
4. Connect Leather wallet
5. Sign burn transaction
6. Wait ~25-45 minutes
7. Check USDC balance on Ethereum

## Troubleshooting

### Widget not loading

- Check that `npm run build` completed successfully
- Verify HTTP server is running on correct port
- Check browser console for errors

### MetaMask connection fails

- Install MetaMask extension
- Switch to Sepolia testnet
- Refresh page and try again

### Leather connection fails

- Install Leather wallet
- Create/import Stacks wallet
- Ensure on testnet mode

### Transaction stuck

- Check transaction on block explorer
- For Ethereum: https://sepolia.etherscan.io
- For Stacks: https://explorer.hiro.so (testnet)
- Bridge can take 15-60 minutes depending on attestation

## Contributing

Contributions welcome! Please:

1. Fork the repo
2. Create a feature branch
3. Make your changes
4. Add tests
5. Submit a pull request

## License

MIT License - see [LICENSE](LICENSE) file

## Links

- **Documentation**: [MCP Protocol Docs](https://modelcontextprotocol.io)
- **Circle xReserve**: [Official Docs](https://developers.circle.com)
- **Stacks USDCx**: [GitHub](https://github.com/stacks-network/usdcx)
- **Report Issues**: [GitHub Issues](https://github.com/yourusername/usdcx-bridge/issues)

## Acknowledgments

Built with:
- ChatGPT Apps SDK
- Model Context Protocol
- Circle's xReserve Protocol
- Stacks Blockchain
- Viem & wagmi
- React

---

**Made with ❤️ for the Bitcoin & Ethereum ecosystems**