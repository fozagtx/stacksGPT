// Deposit Widget: Bridge USDC from Ethereum to Stacks
import React, { useState, useEffect } from 'react';
import { createRoot } from 'react-dom/client';
import { useMetaMask } from './hooks/useMetaMask';
import type { Address, Hex } from 'viem';

interface DepositWidgetProps {
  amount: string;
  stacksRecipient: string;
  transactionData: {
    to: Address;
    data: Hex;
    value: bigint;
    estimatedGas: bigint;
    requiresApproval: boolean;
    approvalTx?: {
      to: Address;
      data: Hex;
    };
  };
}

function DepositWidget({ amount, stacksRecipient, transactionData }: DepositWidgetProps) {
  const { address, isConnected, isConnecting, error: walletError, connect, sendTransaction } = useMetaMask();
  const [step, setStep] = useState<'connect' | 'approve' | 'deposit' | 'confirming' | 'success'>('connect');
  const [txHash, setTxHash] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (isConnected) {
      if (transactionData.requiresApproval) {
        setStep('approve');
      } else {
        setStep('deposit');
      }
    }
  }, [isConnected, transactionData.requiresApproval]);

  const handleApprove = async () => {
    if (!transactionData.approvalTx) return;
    
    setLoading(true);
    setError(null);

    try {
      const hash = await sendTransaction(
        transactionData.approvalTx.to,
        transactionData.approvalTx.data
      );
      setTxHash(hash);
      setStep('deposit');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Approval failed');
    } finally {
      setLoading(false);
    }
  };

  const handleDeposit = async () => {
    setLoading(true);
    setError(null);

    try {
      const hash = await sendTransaction(
        transactionData.to,
        transactionData.data,
        transactionData.value
      );
      setTxHash(hash);
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
        <h2 style={styles.title}>🌉 Bridge USDC to Stacks</h2>
        
        <div style={styles.info}>
          <div style={styles.infoRow}>
            <span style={styles.label}>Amount:</span>
            <span style={styles.value}>{amount} USDC → {amount} USDCx</span>
          </div>
          <div style={styles.infoRow}>
            <span style={styles.label}>Destination:</span>
            <span style={styles.value}>{stacksRecipient.slice(0, 8)}...{stacksRecipient.slice(-6)}</span>
          </div>
          <div style={styles.infoRow}>
            <span style={styles.label}>Network:</span>
            <span style={styles.value}>Ethereum Sepolia → Stacks Testnet</span>
          </div>
          <div style={styles.infoRow}>
            <span style={styles.label}>Time:</span>
            <span style={styles.value}>~15 minutes</span>
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
            disabled={isConnecting}
            style={styles.button}
          >
            {isConnecting ? 'Connecting...' : '🦊 Connect MetaMask'}
          </button>
        )}

        {step === 'approve' && (
          <div>
            <p style={styles.stepInfo}>
              ⚠️ First, you need to approve USDC spending
            </p>
            <button 
              onClick={handleApprove} 
              disabled={loading}
              style={styles.button}
            >
              {loading ? '⏳ Approving...' : '✅ Approve USDC'}
            </button>
          </div>
        )}

        {step === 'deposit' && (
          <div>
            <p style={styles.stepInfo}>
              ✅ Ready to bridge {amount} USDC
            </p>
            <button 
              onClick={handleDeposit} 
              disabled={loading}
              style={styles.button}
            >
              {loading ? '⏳ Bridging...' : '🚀 Bridge to Stacks'}
            </button>
          </div>
        )}

        {step === 'confirming' && (
          <div style={styles.success}>
            <div style={styles.spinner}>⏳</div>
            <p>Transaction submitted!</p>
            {txHash && (
              <a 
                href={`https://sepolia.etherscan.io/tx/${txHash}`}
                target="_blank"
                rel="noopener noreferrer"
                style={styles.link}
              >
                View on Etherscan →
              </a>
            )}
            <p style={styles.note}>
              Waiting for confirmations... Your USDCx will arrive on Stacks in ~15 minutes.
            </p>
          </div>
        )}

        {step === 'success' && (
          <div style={styles.success}>
            <div style={styles.successIcon}>✅</div>
            <h3>Bridge Initiated!</h3>
            <p>Your {amount} USDC is being bridged to Stacks</p>
            {txHash && (
              <a 
                href={`https://sepolia.etherscan.io/tx/${txHash}`}
                target="_blank"
                rel="noopener noreferrer"
                style={styles.link}
              >
                View Transaction →
              </a>
            )}
            <p style={styles.note}>
              USDCx will arrive at {stacksRecipient.slice(0, 8)}... in approximately 15 minutes
            </p>
          </div>
        )}

        {isConnected && address && (
          <div style={styles.footer}>
            Connected: {address.slice(0, 6)}...{address.slice(-4)}
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
    background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
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
    color: '#667eea',
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
  const props: DepositWidgetProps = {
    amount: urlParams.get('amount') || '0',
    stacksRecipient: urlParams.get('recipient') || '',
    transactionData: JSON.parse(decodeURIComponent(urlParams.get('data') || '{}'))
  };

  const root = createRoot(document.getElementById('root')!);
  root.render(<DepositWidget {...props} />);
}

export default DepositWidget;