// Withdrawal Widget: Bridge USDCx from Stacks to Ethereum
import React, { useState, useEffect } from 'react';
import { createRoot } from 'react-dom/client';
import { useLeather } from './hooks/useLeather';
import { AnchorMode, PostConditionMode } from '@stacks/transactions';

interface WithdrawalWidgetProps {
  amount: string;
  ethereumRecipient: string;
  transactionData: {
    contractAddress: string;
    contractName: string;
    functionName: string;
    functionArgs: any[];
    postConditions: any[];
    estimatedFee: string;
  };
}

function WithdrawalWidget({ amount, ethereumRecipient, transactionData }: WithdrawalWidgetProps) {
  const { address, isConnected, error: walletError, connect, callContract } = useLeather();
  const [step, setStep] = useState<'connect' | 'ready' | 'confirming' | 'success'>('connect');
  const [txId, setTxId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (isConnected) {
      setStep('ready');
    }
  }, [isConnected]);

  const handleWithdraw = async () => {
    setLoading(true);
    setError(null);

    try {
      const txid = await callContract({
        contractAddress: transactionData.contractAddress,
        contractName: transactionData.contractName,
        functionName: transactionData.functionName,
        functionArgs: transactionData.functionArgs,
        postConditions: transactionData.postConditions,
        postConditionMode: PostConditionMode.Deny,
        anchorMode: AnchorMode.Any,
      });
      
      setTxId(txid);
      setStep('confirming');
      
      // After a few seconds, show success
      setTimeout(() => setStep('success'), 3000);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Transaction failed');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div style={styles.container}>
      <div style={styles.card}>
        <h2 style={styles.title}>🌉 Bridge USDCx to Ethereum</h2>
        
        <div style={styles.info}>
          <div style={styles.infoRow}>
            <span style={styles.label}>Amount:</span>
            <span style={styles.value}>{amount} USDCx → {amount} USDC</span>
          </div>
          <div style={styles.infoRow}>
            <span style={styles.label}>Destination:</span>
            <span style={styles.value}>{ethereumRecipient.slice(0, 8)}...{ethereumRecipient.slice(-6)}</span>
          </div>
          <div style={styles.infoRow}>
            <span style={styles.label}>Network:</span>
            <span style={styles.value}>Stacks Testnet → Ethereum Sepolia</span>
          </div>
          <div style={styles.infoRow}>
            <span style={styles.label}>Time:</span>
            <span style={styles.value}>~25-45 minutes</span>
          </div>
          <div style={styles.infoRow}>
            <span style={styles.label}>Fee:</span>
            <span style={styles.value}>{transactionData.estimatedFee}</span>
          </div>
        </div>

        {walletError && (
          <div style={styles.error}>{walletError}</div>
        )}

        {error && (
          <div style={styles.error}>{error}</div>
        )}

        {step === 'connect' && (
          <button 
            onClick={connect} 
            style={styles.button}
          >
            🔗 Connect Leather Wallet
          </button>
        )}

        {step === 'ready' && (
          <div>
            <p style={styles.stepInfo}>
              ✅ Ready to burn {amount} USDCx and receive USDC on Ethereum
            </p>
            <button 
              onClick={handleWithdraw} 
              disabled={loading}
              style={styles.button}
            >
              {loading ? '⏳ Processing...' : '🚀 Bridge to Ethereum'}
            </button>
          </div>
        )}

        {step === 'confirming' && (
          <div style={styles.success}>
            <div style={styles.spinner}>⏳</div>
            <p>Transaction submitted!</p>
            {txId && (
              <a 
                href={`https://explorer.hiro.so/txid/${txId}?chain=testnet`}
                target="_blank"
                rel="noopener noreferrer"
                style={styles.link}
              >
                View on Stacks Explorer →
              </a>
            )}
            <p style={styles.note}>
              Waiting for confirmations... Your USDC will arrive on Ethereum in 25-45 minutes.
            </p>
          </div>
        )}

        {step === 'success' && (
          <div style={styles.success}>
            <div style={styles.successIcon}>✅</div>
            <h3>Withdrawal Initiated!</h3>
            <p>Your {amount} USDCx is being bridged to Ethereum</p>
            {txId && (
              <a 
                href={`https://explorer.hiro.so/txid/${txId}?chain=testnet`}
                target="_blank"
                rel="noopener noreferrer"
                style={styles.link}
              >
                View Transaction →
              </a>
            )}
            <p style={styles.note}>
              USDC will arrive at {ethereumRecipient.slice(0, 8)}... in approximately 25-45 minutes
            </p>
          </div>
        )}

        {isConnected && address && (
          <div style={styles.footer}>
            Connected: {address.slice(0, 8)}...{address.slice(-6)}
          </div>
        )}
      </div>
    </div>
  );
}

const styles = {
  container: {
    fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif',
    padding: '20px',
    maxWidth: '500px',
    margin: '0 auto',
  },
  card: {
    background: 'linear-gradient(135deg, #f093fb 0%, #f5576c 100%)',
    borderRadius: '16px',
    padding: '24px',
    boxShadow: '0 8px 32px rgba(0, 0, 0, 0.1)',
    color: 'white',
  },
  title: {
    margin: '0 0 20px 0',
    fontSize: '24px',
    fontWeight: '600',
    textAlign: 'center' as const,
  },
  info: {
    background: 'rgba(255, 255, 255, 0.1)',
    borderRadius: '12px',
    padding: '16px',
    marginBottom: '20px',
  },
  infoRow: {
    display: 'flex',
    justifyContent: 'space-between',
    marginBottom: '8px',
  },
  label: {
    opacity: 0.8,
    fontSize: '14px',
  },
  value: {
    fontWeight: '600',
    fontSize: '14px',
  },
  button: {
    width: '100%',
    padding: '14px',
    fontSize: '16px',
    fontWeight: '600',
    border: 'none',
    borderRadius: '10px',
    background: 'white',
    color: '#f5576c',
    cursor: 'pointer',
    transition: 'transform 0.2s',
  },
  error: {
    background: 'rgba(255, 0, 0, 0.2)',
    border: '1px solid rgba(255, 0, 0, 0.3)',
    borderRadius: '8px',
    padding: '12px',
    marginBottom: '16px',
    fontSize: '14px',
  },
  stepInfo: {
    textAlign: 'center' as const,
    marginBottom: '16px',
    fontSize: '14px',
  },
  success: {
    textAlign: 'center' as const,
  },
  successIcon: {
    fontSize: '48px',
    marginBottom: '16px',
  },
  spinner: {
    fontSize: '48px',
    marginBottom: '16px',
    animation: 'spin 2s linear infinite',
  },
  link: {
    color: 'white',
    textDecoration: 'underline',
    display: 'block',
    marginTop: '12px',
  },
  note: {
    fontSize: '12px',
    opacity: 0.8,
    marginTop: '12px',
  },
  footer: {
    marginTop: '16px',
    textAlign: 'center' as const,
    fontSize: '12px',
    opacity: 0.7,
  },
};

// Initialize widget when loaded
if (typeof window !== 'undefined') {
  const urlParams = new URLSearchParams(window.location.search);
  const props: WithdrawalWidgetProps = {
    amount: urlParams.get('amount') || '0',
    ethereumRecipient: urlParams.get('recipient') || '',
    transactionData: JSON.parse(decodeURIComponent(urlParams.get('data') || '{}'))
  };

  const root = createRoot(document.getElementById('root')!);
  root.render(<WithdrawalWidget {...props} />);
}

export default WithdrawalWidget;