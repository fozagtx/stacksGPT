// MetaMask/Ethereum wallet connection hook
import { useState, useEffect } from 'react';
import { createPublicClient, createWalletClient, custom, http, type Address, type Hex } from 'viem';
import { sepolia, mainnet } from 'viem/chains';

export interface MetaMaskHook {
  address: Address | null;
  isConnected: boolean;
  isConnecting: boolean;
  error: string | null;
  connect: () => Promise<void>;
  disconnect: () => void;
  sendTransaction: (to: Address, data: Hex, value?: bigint) => Promise<Hex>;
}

const isMainnet = process.env.ETHEREUM_NETWORK === 'mainnet';
const chain = isMainnet ? mainnet : sepolia;

export function useMetaMask(): MetaMaskHook {
  const [address, setAddress] = useState<Address | null>(null);
  const [isConnecting, setIsConnecting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    // Check if already connected
    if (typeof window !== 'undefined' && window.ethereum) {
      window.ethereum.request({ method: 'eth_accounts' })
        .then((accounts: string[]) => {
          if (accounts.length > 0) {
            setAddress(accounts[0] as Address);
          }
        })
        .catch(console.error);

      // Listen for account changes
      const handleAccountsChanged = (accounts: string[]) => {
        if (accounts.length > 0) {
          setAddress(accounts[0] as Address);
        } else {
          setAddress(null);
        }
      };

      window.ethereum.on('accountsChanged', handleAccountsChanged);
      return () => {
        window.ethereum?.removeListener('accountsChanged', handleAccountsChanged);
      };
    }
  }, []);

  const connect = async () => {
    if (typeof window === 'undefined' || !window.ethereum) {
      setError('MetaMask not installed. Please install MetaMask to continue.');
      return;
    }

    setIsConnecting(true);
    setError(null);

    try {
      const accounts = await window.ethereum.request({
        method: 'eth_requestAccounts'
      });

      if (accounts.length > 0) {
        setAddress(accounts[0] as Address);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to connect to MetaMask');
      console.error('MetaMask connection error:', err);
    } finally {
      setIsConnecting(false);
    }
  };

  const disconnect = () => {
    setAddress(null);
  };

  const sendTransaction = async (to: Address, data: Hex, value: bigint = BigInt(0)): Promise<Hex> => {
    if (!address) {
      throw new Error('Wallet not connected');
    }

    if (!window.ethereum) {
      throw new Error('MetaMask not found');
    }

    const walletClient = createWalletClient({
      account: address,
      chain,
      transport: custom(window.ethereum)
    });

    const hash = await walletClient.sendTransaction({
      to,
      data,
      value,
      account: address,
      chain
    });

    return hash;
  };

  return {
    address,
    isConnected: !!address,
    isConnecting,
    error,
    connect,
    disconnect,
    sendTransaction
  };
}