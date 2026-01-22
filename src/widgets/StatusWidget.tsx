// Status Widget: Track bridge transaction status
import React, { useState, useEffect } from 'react';
import { createRoot } from 'react-dom/client';

interface StatusWidgetProps {
  txHash: string;
  chain: 'ethereum' | 'stacks';
  initialStatus?: {
    state: 'pending' | 'confirming' | 'attesting' | 'completed' | 'failed';
    confirmations: number;
    explorerUrl: string;
    eta?: string;
    errorMessage?: string;
  };
}

function StatusWidget({ txHash, chain, initialStatus }: StatusWidgetProps) {
  const [status, setStatus] = useState(initialStatus || {
    state: 'pending' as const,
    confirmations: 0,
    explorerUrl: '',
    eta: 'Loading...'
  });
  const [refreshing, setRefreshing] = useState(false);

  const statusConfig = {
    pending: { emoji: '⏳', color: '#fbbf24', label: 'Pending' },
    confirming: { emoji: '🔄', color: '#3b82f6', label: 'Confirming' },
    attesting: { emoji: '🔐', color: '#8b5cf6', label: 'Attesting' },
    completed: { emoji: '✅', color: '#10b981', label: 'Completed' },
    failed: { emoji: '❌', color: '#ef4444', label: 'Failed' }
  };

  const currentConfig = statusConfig[status.state];

  const refreshStatus = async () => {
    setRefreshing(true);
    try {
      // In a real implementation, this would call the MCP server
      // For now, we'll simulate a status check
      await new Promise(resolve => setTimeout(resolve, 1000));
      
      // Simulate status progression
      if (status.state === 'pending') {
        setStatus({
          ...status,
          state: 'confirming',
          confirmations: 1,
          eta: chain === 'ethereum' ? '~2 minutes' : '~1 minute'
        });
      } else if (status.state === 'confirming' && status.confirmations < 6) {
        setStatus({
          ...status,
          confirmations: status.confirmations + 1
        });
      }
    } catch (error) {
      console.error('Failed to refresh status:', error);
    } finally {
      setRefreshing(false);
    }
  };

  useEffect(() => {
    // Auto-refresh every 15 seconds if not completed or failed
    if (status.state !== 'completed' && status.state !== 'failed') {
      const interval = setInterval(refreshStatus, 15000);
      return () => clearInterval(interval);
    }
  }, [status.state]);

  return (
    <div style={styles.container}>
      <div style={{...styles.card, borderLeft: `4px solid ${currentConfig.color}`}}>
        <div style={styles.header}>
          <div style={styles.statusBadge}>
            <span style={styles.emoji}>{currentConfig.emoji}</span>
            <span style={styles.statusLabel}>{currentConfig.label}</span>
          </div>
          <button 
            onClick={refreshStatus} 
            disabled={refreshing || status.state === 'completed' || status.state === 'failed'}
            style={styles.refreshButton}
          >
            {refreshing ? '⏳' : '🔄'}
          </button>
        </div>

        <div style={styles.section}>
          <div style={styles.infoRow}>
            <span style={styles.label}>Transaction:</span>
            <code style={styles.txHash}>
              {txHash.slice(0, 8)}...{txHash.slice(-8)}
            </code>
          </div>
          <div style={styles.infoRow}>
            <span style={styles.label}>Chain:</span>
            <span style={styles.value}>
              {chain === 'ethereum' ? '🔵 Ethereum Sepolia' : '🟠 Stacks Testnet'}
            </span>
          </div>
          <div style={styles.infoRow}>
            <span style={styles.label}>Confirmations:</span>
            <span style={styles.value}>{status.confirmations}</span>
          </div>
          {status.eta && (
            <div style={styles.infoRow}>
              <span style={styles.label}>ETA:</span>
              <span style={styles.value}>{status.eta}</span>
            </div>
          )}
        </div>

        {status.errorMessage && (
          <div style={styles.error}>
            <strong>Error:</strong> {status.errorMessage}
          </div>
        )}

        {status.state === 'attesting' && (
          <div style={styles.alert}>
            <strong>⚡ Attestation in Progress</strong>
            <p style={styles.alertText}>
              Your transaction is being verified by Circle's attestation service. 
              This typically takes {chain === 'ethereum' ? '15-20' : '25-45'} minutes.
            </p>
          </div>
        )}

        {status.state === 'completed' && (
          <div style={{...styles.alert, background: '#d1fae5', borderColor: '#10b981'}}>
            <strong>🎉 Bridge Complete!</strong>
            <p style={styles.alertText}>
              Your funds have successfully arrived on the destination chain.
            </p>
          </div>
        )}

        <div style={styles.footer}>
          <a 
            href={status.explorerUrl || (
              chain === 'ethereum' 
                ? `https://sepolia.etherscan.io/tx/${txHash}`
                : `https://explorer.hiro.so/txid/${txHash}?chain=testnet`
            )}
            target="_blank"
            rel="noopener noreferrer"
            style={styles.link}
          >
            View on Explorer →
          </a>
        </div>

        {status.state === 'confirming' && (
          <div style={styles.progress}>
            <div 
              style={{
                ...styles.progressBar,
                width: `${(status.confirmations / 12) * 100}%`
              }}
            />
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
    maxWidth: '600px',
    margin: '0 auto',
  },
  card: {
    background: 'white',
    borderRadius: '12px',
    padding: '20px',
    boxShadow: '0 4px 16px rgba(0, 0, 0, 0.1)',
  },
  header: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: '20px',
  },
  statusBadge: {
    display: 'flex',
    alignItems: 'center',
    gap: '8px',
  },
  emoji: {
    fontSize: '24px',
  },
  statusLabel: {
    fontSize: '18px',
    fontWeight: '600',
    color: '#1f2937',
  },
  refreshButton: {
    padding: '8px 12px',
    border: '1px solid #e5e7eb',
    borderRadius: '6px',
    background: 'white',
    cursor: 'pointer',
    fontSize: '16px',
    transition: 'all 0.2s',
  },
  section: {
    background: '#f9fafb',
    borderRadius: '8px',
    padding: '16px',
    marginBottom: '16px',
  },
  infoRow: {
    display: 'flex',
    justifyContent: 'space-between',
    marginBottom: '12px',
    alignItems: 'center',
  },
  label: {
    color: '#6b7280',
    fontSize: '14px',
  },
  value: {
    color: '#1f2937',
    fontWeight: '500',
    fontSize: '14px',
  },
  txHash: {
    background: '#e5e7eb',
    padding: '4px 8px',
    borderRadius: '4px',
    fontSize: '12px',
    fontFamily: 'monospace',
    color: '#1f2937',
  },
  error: {
    background: '#fee2e2',
    border: '1px solid #fca5a5',
    borderRadius: '8px',
    padding: '12px',
    marginBottom: '16px',
    color: '#991b1b',
    fontSize: '14px',
  },
  alert: {
    background: '#dbeafe',
    border: '1px solid #93c5fd',
    borderRadius: '8px',
    padding: '12px',
    marginBottom: '16px',
    color: '#1e40af',
  },
  alertText: {
    margin: '8px 0 0 0',
    fontSize: '13px',
    lineHeight: '1.5',
  },
  footer: {
    textAlign: 'center' as const,
  },
  link: {
    color: '#3b82f6',
    textDecoration: 'none',
    fontSize: '14px',
    fontWeight: '500',
  },
  progress: {
    height: '4px',
    background: '#e5e7eb',
    borderRadius: '2px',
    marginTop: '16px',
    overflow: 'hidden',
  },
  progressBar: {
    height: '100%',
    background: 'linear-gradient(90deg, #3b82f6, #8b5cf6)',
    transition: 'width 0.3s ease',
  },
};

// Initialize widget when loaded
if (typeof window !== 'undefined') {
  const urlParams = new URLSearchParams(window.location.search);
  const props: StatusWidgetProps = {
    txHash: urlParams.get('txHash') || '',
    chain: (urlParams.get('chain') as 'ethereum' | 'stacks') || 'ethereum',
    initialStatus: urlParams.get('status') 
      ? JSON.parse(decodeURIComponent(urlParams.get('status')!))
      : undefined
  };

  const root = createRoot(document.getElementById('root')!);
  root.render(<StatusWidget {...props} />);
}

export default StatusWidget;