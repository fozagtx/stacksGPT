// Leather/Stacks wallet connection hook
import { useState, useEffect } from 'react';
import { AppConfig, UserSession, showConnect } from '@stacks/connect';
import { openContractCall } from '@stacks/connect';
import { STACKS_TESTNET, STACKS_MAINNET } from '@stacks/network';
import type { ContractCallPayload } from '@stacks/transactions';

export interface LeatherHook {
  address: string | null;
  isConnected: boolean;
  error: string | null;
  connect: () => void;
  disconnect: () => void;
  callContract: (payload: Omit<ContractCallPayload, 'network'>) => Promise<string>;
}

const isMainnet = process.env.STACKS_NETWORK === 'mainnet';
const network = isMainnet ? STACKS_MAINNET : STACKS_TESTNET;

const appConfig = new AppConfig(['store_write', 'publish_data']);
const userSession = new UserSession({ appConfig });

export function useLeather(): LeatherHook {
  const [address, setAddress] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    // Check if already connected
    if (userSession.isUserSignedIn()) {
      const userData = userSession.loadUserData();
      setAddress(userData.profile.stxAddress[isMainnet ? 'mainnet' : 'testnet']);
    }
  }, []);

  const connect = () => {
    setError(null);

    showConnect({
      appDetails: {
        name: 'USDCx Bridge',
        icon: window.location.origin + '/icon.png'
      },
      redirectTo: '/',
      onFinish: () => {
        const userData = userSession.loadUserData();
        setAddress(userData.profile.stxAddress[isMainnet ? 'mainnet' : 'testnet']);
      },
      onCancel: () => {
        setError('Connection cancelled');
      },
      userSession
    });
  };

  const disconnect = () => {
    userSession.signUserOut();
    setAddress(null);
  };

  const callContract = async (payload: Omit<ContractCallPayload, 'network'>): Promise<string> => {
    if (!address) {
      throw new Error('Wallet not connected');
    }

    return new Promise((resolve, reject) => {
      openContractCall({
        ...payload,
        network,
        onFinish: (data) => {
          resolve(data.txId);
        },
        onCancel: () => {
          reject(new Error('Transaction cancelled'));
        }
      });
    });
  };

  return {
    address,
    isConnected: !!address,
    error,
    connect,
    disconnect,
    callContract
  };
}