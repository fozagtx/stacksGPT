// Ethereum bridge service for USDCx using Circle xReserve
import {
  createPublicClient,
  http,
  parseUnits,
  type Address,
  type Hex,
  encodeFunctionData
} from 'viem';
import { sepolia } from 'viem/chains';
import { encodeStacksAddress } from './helpers.js';

// Contract ABIs from official docs
const XRESERVE_ABI = [
  {
    name: 'depositToRemote',
    type: 'function',
    stateMutability: 'nonpayable',
    inputs: [
      { name: 'value', type: 'uint256' },
      { name: 'remoteDomain', type: 'uint32' },
      { name: 'remoteRecipient', type: 'bytes32' },
      { name: 'localToken', type: 'address' },
      { name: 'maxFee', type: 'uint256' },
      { name: 'hookData', type: 'bytes' }
    ],
    outputs: []
  }
] as const;

const ERC20_ABI = [
  {
    name: 'approve',
    type: 'function',
    stateMutability: 'nonpayable',
    inputs: [
      { name: 'spender', type: 'address' },
      { name: 'amount', type: 'uint256' }
    ],
    outputs: [{ name: 'success', type: 'bool' }]
  },
  {
    name: 'balanceOf',
    type: 'function',
    stateMutability: 'view',
    inputs: [{ name: 'account', type: 'address' }],
    outputs: [{ name: 'balance', type: 'uint256' }]
  },
  {
    name: 'allowance',
    type: 'function',
    stateMutability: 'view',
    inputs: [
      { name: 'owner', type: 'address' },
      { name: 'spender', type: 'address' }
    ],
    outputs: [{ name: 'allowance', type: 'uint256' }]
  }
] as const;

// Constants from official docs
const STACKS_DOMAIN = 10003;
const XRESERVE_CONTRACT = process.env.XRESERVE_CONTRACT as Address || '0x008888878f94C0d87defdf0B07f46B93C1934442';
const USDC_CONTRACT = process.env.USDC_CONTRACT as Address || '0x1c7D4B196Cb0C7B01d743Fbc6116a902379C7238';

// Create public client for reading blockchain state
const publicClient = createPublicClient({
  chain: sepolia,
  transport: http(process.env.ETHEREUM_RPC_URL || 'https://ethereum-sepolia.publicnode.com')
});

export interface DepositTransactionData {
  to: Address;
  data: Hex;
  value: bigint;
  estimatedGas: bigint;
  requiresApproval: boolean;
  approvalTx?: {
    to: Address;
    data: Hex;
  };
}

export interface TransactionStatus {
  state: 'pending' | 'confirming' | 'attesting' | 'completed' | 'failed';
  confirmations: number;
  explorerUrl: string;
  eta?: string;
  errorMessage?: string;
}

/**
 * Prepare deposit transaction data (user signs in widget)
 */
export async function prepareDepositTransaction(
  amount: string,
  stacksRecipient: string,
  userAddress: Address
): Promise<DepositTransactionData> {
  // Validate inputs
  if (parseFloat(amount) < 1) {
    throw new Error('Minimum deposit is 1 USDC on testnet');
  }

  // Convert amount to wei (USDC has 6 decimals)
  const value = parseUnits(amount, 6);

  // Encode Stacks address to bytes32
  const remoteRecipient = encodeStacksAddress(stacksRecipient);

  // Check current allowance
  const currentAllowance = await publicClient.readContract({
    address: USDC_CONTRACT,
    abi: ERC20_ABI,
    functionName: 'allowance',
    args: [userAddress, XRESERVE_CONTRACT]
  });

  const requiresApproval = currentAllowance < value;

  // Prepare approval transaction if needed
  let approvalTx;
  if (requiresApproval) {
    approvalTx = {
      to: USDC_CONTRACT,
      data: encodeFunctionData({
        abi: ERC20_ABI,
        functionName: 'approve',
        args: [XRESERVE_CONTRACT, value]
      })
    };
  }

  // Prepare deposit transaction data
  const depositData = encodeFunctionData({
    abi: XRESERVE_ABI,
    functionName: 'depositToRemote',
    args: [
      value,
      STACKS_DOMAIN,
      remoteRecipient,
      USDC_CONTRACT,
      BigInt(0), // maxFee
      '0x' as Hex // hookData
    ]
  });

  // Estimate gas
  const estimatedGas = await publicClient.estimateGas({
    to: XRESERVE_CONTRACT,
    data: depositData,
    account: userAddress
  });

  return {
    to: XRESERVE_CONTRACT,
    data: depositData,
    value: BigInt(0), // No ETH value needed
    estimatedGas,
    requiresApproval,
    approvalTx
  };
}

/**
 * Get USDC balance for an address
 */
export async function getUSDCBalance(address: Address): Promise<string> {
  try {
    const balance = await publicClient.readContract({
      address: USDC_CONTRACT,
      abi: ERC20_ABI,
      functionName: 'balanceOf',
      args: [address]
    });

    return (Number(balance) / 1e6).toFixed(2);
  } catch (error) {
    console.error('Error fetching USDC balance:', error);
    return '0.00';
  }
}

/**
 * Check transaction status on Ethereum
 */
export async function getEthereumTransactionStatus(txHash: Hex): Promise<TransactionStatus> {
  try {
    const receipt = await publicClient.getTransactionReceipt({ hash: txHash });

    if (receipt.status === 'success') {
      const currentBlock = await publicClient.getBlockNumber();
      const confirmations = Number(currentBlock - receipt.blockNumber);

      let state: TransactionStatus['state'];
      let eta: string | undefined;

      if (confirmations < 12) {
        state = 'confirming';
        eta = `${(12 - confirmations) * 12} seconds`;
      } else {
        state = 'attesting';
        eta = '~15 minutes (attestation in progress)';
      }

      return {
        state,
        confirmations,
        explorerUrl: `https://sepolia.etherscan.io/tx/${txHash}`,
        eta
      };
    } else {
      return {
        state: 'failed',
        confirmations: 0,
        explorerUrl: `https://sepolia.etherscan.io/tx/${txHash}`,
        errorMessage: 'Transaction failed on Ethereum'
      };
    }
  } catch (error) {
    // Transaction not found yet
    return {
      state: 'pending',
      confirmations: 0,
      explorerUrl: `https://sepolia.etherscan.io/tx/${txHash}`,
      eta: 'Waiting for transaction to be mined'
    };
  }
}

/**
 * Check if USDCx contracts are working (health check)
 */
export async function checkContractHealth(): Promise<{ healthy: boolean; error?: string }> {
  try {
    // Try to read USDC total supply (should not fail if contract is working)
    await publicClient.readContract({
      address: USDC_CONTRACT,
      abi: ERC20_ABI,
      functionName: 'balanceOf',
      args: ['0x0000000000000000000000000000000000000000']
    });

    return { healthy: true };
  } catch (error) {
    return {
      healthy: false,
      error: error instanceof Error ? error.message : 'Unknown error'
    };
  }
}