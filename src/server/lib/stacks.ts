// Stacks bridge service for USDCx withdrawal
import {
  makeContractCall,
  AnchorMode,
  PostConditionMode,
  Cl,
  Pc,
  type ContractCallPayload,
  cvToString,
  fetchCallReadOnlyFunction
} from '@stacks/transactions';
import { STACKS_TESTNET, STACKS_MAINNET } from '@stacks/network';
import { padEthereumAddress, fromMicroUSDC } from './helpers.js';
import { type Hex } from 'viem';

// Constants from official docs
const ETHEREUM_DOMAIN = 0;
const STACKS_USDCX_CONTRACT = process.env.STACKS_USDCX_CONTRACT || 'ST1PQHQKV0RJXZFY1DGX8MNSNYVE3VGZJSRTPGZGM.usdcx-v1';
const USDCX_TOKEN_CONTRACT = 'ST1PQHQKV0RJXZFY1DGX8MNSNYVE3VGZJSRTPGZGM.usdcx';

// Network setup
const network = process.env.STACKS_NETWORK === 'mainnet' ? STACKS_MAINNET : STACKS_TESTNET;

export interface WithdrawalTransactionData {
  contractAddress: string;
  contractName: string;
  functionName: string;
  functionArgs: any[];
  postConditions: any[];
  network: typeof network;
  estimatedFee: string;
}

export interface StacksTransactionStatus {
  state: 'pending' | 'confirming' | 'attesting' | 'completed' | 'failed';
  confirmations: number;
  explorerUrl: string;
  eta?: string;
  errorMessage?: string;
}

/**
 * Prepare withdrawal transaction (user signs in Stacks wallet)
 */
export async function prepareWithdrawalTransaction(
  amount: string,
  ethereumRecipient: string,
  stacksAddress: string
): Promise<WithdrawalTransactionData> {
  // Convert to micro-USDC
  const microAmount = Math.floor(parseFloat(amount) * 1e6);

  // Validate minimum
  if (microAmount < 4_800_000) {
    throw new Error('Minimum withdrawal is 4.80 USDCx');
  }

  // Pad Ethereum address to 32 bytes
  const paddedEthAddress = padEthereumAddress(ethereumRecipient);

  // Parse contract parts
  const [contractAddress, contractName] = STACKS_USDCX_CONTRACT.split('.');

  // Function arguments for burn
  const functionArgs = [
    Cl.uint(microAmount),
    Cl.uint(ETHEREUM_DOMAIN),
    Cl.bufferFromHex(paddedEthAddress.slice(2)) // Remove 0x prefix
  ];

  // Post-condition: ensure USDCx is burned from sender
  const postCondition = Pc.principal(stacksAddress)
    .willSendEq(microAmount)
    .ft(USDCX_TOKEN_CONTRACT, 'usdcx-token');

  return {
    contractAddress,
    contractName,
    functionName: 'burn',
    functionArgs,
    postConditions: [postCondition],
    network,
    estimatedFee: '0.01 STX' // Rough estimate for testnet
  };
}

/**
 * Get USDCx balance for a Stacks address
 */
export async function getUSDCxBalance(address: string): Promise<string> {
  try {
    const [tokenContract, tokenName] = USDCX_TOKEN_CONTRACT.split('.');

    const balanceCall = await fetchCallReadOnlyFunction({
      contractAddress: tokenContract,
      contractName: tokenName,
      functionName: 'get-balance',
      functionArgs: [Cl.principal(address)],
      network,
      senderAddress: address,
    });

    const balanceValue = cvToString(balanceCall);
    const microBalance = BigInt(balanceValue.replace(/[^0-9]/g, '') || '0');

    return fromMicroUSDC(microBalance);
  } catch (error) {
    console.error('Error fetching USDCx balance:', error);
    return '0.000000';
  }
}

/**
 * Check transaction status on Stacks
 */
export async function getStacksTransactionStatus(txId: string): Promise<StacksTransactionStatus> {
  try {
    // Use Stacks API to check transaction status
    const isMainnet = process.env.STACKS_NETWORK === 'mainnet';
    const apiUrl = isMainnet
      ? 'https://api.stacks.co'
      : 'https://api.testnet.stacks.co';

    const response = await fetch(`${apiUrl}/extended/v1/tx/${txId}`);

    if (!response.ok) {
      // Transaction not found yet
      return {
        state: 'pending',
        confirmations: 0,
        explorerUrl: `https://explorer.hiro.so/txid/${txId}?chain=${isMainnet ? 'mainnet' : 'testnet'}`,
        eta: 'Waiting for transaction to be mined'
      };
    }

    const txData = await response.json();

    let state: StacksTransactionStatus['state'];
    let eta: string | undefined;

    switch (txData.tx_status) {
      case 'success':
        // Check confirmations
        if (txData.block_height) {
          const latestBlockResponse = await fetch(`${apiUrl}/v2/info`);
          const latestBlock = await latestBlockResponse.json();
          const confirmations = latestBlock.stacks_tip_height - txData.block_height + 1;

          if (confirmations >= 6) {
            state = 'attesting';
            eta = '~25 minutes (Circle attestation in progress)';
          } else {
            state = 'confirming';
            eta = `${(6 - confirmations) * 10} minutes`;
          }
        } else {
          state = 'confirming';
          eta = '~60 seconds';
        }

        return {
          state,
          confirmations: txData.block_height ?
            (await fetch(`${apiUrl}/v2/info`).then(r => r.json())).stacks_tip_height - txData.block_height + 1 : 0,
          explorerUrl: `https://explorer.hiro.so/txid/${txId}?chain=${isMainnet ? 'mainnet' : 'testnet'}`
        };

      case 'abort_by_response':
      case 'abort_by_post_condition':
        return {
          state: 'failed',
          confirmations: 0,
          explorerUrl: `https://explorer.hiro.so/txid/${txId}?chain=${isMainnet ? 'mainnet' : 'testnet'}`,
          errorMessage: `Transaction failed: ${txData.tx_result?.repr || 'Unknown error'}`
        };

      default:
        return {
          state: 'pending',
          confirmations: 0,
          explorerUrl: `https://explorer.hiro.so/txid/${txId}?chain=${isMainnet ? 'mainnet' : 'testnet'}`,
          eta: 'Transaction pending'
        };
    }
  } catch (error) {
    console.error('Error checking Stacks transaction:', error);
    return {
      state: 'pending',
      confirmations: 0,
      explorerUrl: `https://explorer.hiro.so/txid/${txId}?chain=${process.env.STACKS_NETWORK === 'mainnet' ? 'mainnet' : 'testnet'}`,
      errorMessage: 'Could not fetch transaction status'
    };
  }
}

/**
 * Check if USDCx contracts are working on Stacks (health check)
 */
export async function checkStacksContractHealth(): Promise<{ healthy: boolean; error?: string }> {
  try {
    const [contractAddress, contractName] = STACKS_USDCX_CONTRACT.split('.');

    // Try to read contract info
    const infoCall = await fetchCallReadOnlyFunction({
      contractAddress,
      contractName,
      functionName: 'get-token-uri',
      functionArgs: [],
      network,
      senderAddress: contractAddress, // Use contract address as sender for read-only
    });

    return { healthy: true };
  } catch (error) {
    return {
      healthy: false,
      error: error instanceof Error ? error.message : 'Unknown error'
    };
  }
}

/**
 * Estimate withdrawal completion time based on current network conditions
 */
export function estimateWithdrawalTime(): { fast: string; normal: string; slow: string } {
  return {
    fast: '20-30 minutes',
    normal: '25-45 minutes',
    slow: '45-90 minutes'
  };
}