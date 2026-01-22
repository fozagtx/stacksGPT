// USDCx Bridge Widget Implementation
class USDCxBridge {
  constructor() {
    this.ethereum = null;
    this.stacksProvider = null;
    this.currentDirection = 'deposit'; // 'deposit' or 'withdraw'
    this.connectedEthereum = false;
    this.connectedStacks = false;
    this.userEthAddress = null;
    this.userStacksAddress = null;

    this.init();
  }

  init() {
    this.setupEventListeners();
    this.checkWalletConnections();
    this.updateUI();
  }

  setupEventListeners() {
    // Direction toggle
    document.querySelectorAll('.direction-option').forEach(option => {
      option.addEventListener('click', (e) => {
        document.querySelector('.direction-option.active').classList.remove('active');
        e.target.classList.add('active');
        this.currentDirection = e.target.dataset.direction;
        this.updateUI();
      });
    });

    // Wallet connections
    document.getElementById('connectEthereumBtn').addEventListener('click', () => {
      this.connectEthereum();
    });

    document.getElementById('connectStacksBtn').addEventListener('click', () => {
      this.connectStacks();
    });

    // Bridge button
    document.getElementById('bridgeBtn').addEventListener('click', () => {
      this.initiateBridge();
    });

    // Input validation
    document.getElementById('amount').addEventListener('input', () => {
      this.validateInputs();
    });

    document.getElementById('recipient').addEventListener('input', () => {
      this.validateInputs();
    });
  }

  async checkWalletConnections() {
    // Check MetaMask
    if (typeof window.ethereum !== 'undefined') {
      try {
        const accounts = await window.ethereum.request({
          method: 'eth_accounts'
        });
        if (accounts.length > 0) {
          this.connectedEthereum = true;
          this.userEthAddress = accounts[0];
          this.ethereum = window.ethereum;
        }
      } catch (error) {
        console.log('Ethereum wallet check failed:', error);
      }
    }

    // Check Leather wallet
    if (typeof window.btc !== 'undefined' && window.btc.request) {
      try {
        const response = await window.btc.request('getAddresses');
        if (response.result && response.result.addresses) {
          this.connectedStacks = true;
          this.userStacksAddress = response.result.addresses.find(
            addr => addr.type === 'stacks'
          )?.address;
          this.stacksProvider = window.btc;
        }
      } catch (error) {
        console.log('Stacks wallet check failed:', error);
      }
    }
  }

  async connectEthereum() {
    if (typeof window.ethereum === 'undefined') {
      this.showStatus('MetaMask not found. Please install MetaMask.', 'error');
      return;
    }

    try {
      const accounts = await window.ethereum.request({
        method: 'eth_requestAccounts'
      });

      // Switch to Sepolia testnet
      await window.ethereum.request({
        method: 'wallet_switchEthereumChain',
        params: [{ chainId: '0xaa36a7' }], // Sepolia
      });

      this.connectedEthereum = true;
      this.userEthAddress = accounts[0];
      this.ethereum = window.ethereum;

      this.updateUI();
      this.showStatus('Ethereum wallet connected!', 'success');
    } catch (error) {
      console.error('Ethereum connection failed:', error);
      this.showStatus(`Failed to connect Ethereum wallet: ${error.message}`, 'error');
    }
  }

  async connectStacks() {
    if (typeof window.btc === 'undefined') {
      this.showStatus('Leather wallet not found. Please install Leather.', 'error');
      return;
    }

    try {
      const response = await window.btc.request('getAddresses');

      if (response.result && response.result.addresses) {
        this.connectedStacks = true;
        this.userStacksAddress = response.result.addresses.find(
          addr => addr.type === 'stacks'
        )?.address;
        this.stacksProvider = window.btc;

        this.updateUI();
        this.showStatus('Stacks wallet connected!', 'success');
      }
    } catch (error) {
      console.error('Stacks connection failed:', error);
      this.showStatus(`Failed to connect Stacks wallet: ${error.message}`, 'error');
    }
  }

  validateInputs() {
    const amount = document.getElementById('amount').value;
    const recipient = document.getElementById('recipient').value;

    const isValidAmount = amount && parseFloat(amount) > 0;
    const isValidRecipient = recipient && recipient.trim().length > 0;
    const hasRequiredWallets = this.currentDirection === 'deposit'
      ? this.connectedEthereum
      : this.connectedStacks;

    const bridgeBtn = document.getElementById('bridgeBtn');
    const isValid = isValidAmount && isValidRecipient && hasRequiredWallets;

    bridgeBtn.disabled = !isValid;
    bridgeBtn.textContent = isValid
      ? `Bridge ${this.currentDirection === 'deposit' ? 'to Stacks' : 'to Ethereum'}`
      : this.getButtonText();
  }

  getButtonText() {
    if (!this.connectedEthereum && this.currentDirection === 'deposit') {
      return 'Connect MetaMask to Bridge';
    }
    if (!this.connectedStacks && this.currentDirection === 'withdraw') {
      return 'Connect Leather to Bridge';
    }
    return 'Enter Amount and Recipient';
  }

  async initiateBridge() {
    const amount = document.getElementById('amount').value;
    const recipient = document.getElementById('recipient').value;

    this.showStatus('Preparing transaction...', 'pending');

    try {
      if (this.currentDirection === 'deposit') {
        await this.executeDeposit(amount, recipient);
      } else {
        await this.executeWithdrawal(amount, recipient);
      }
    } catch (error) {
      console.error('Bridge failed:', error);
      this.showStatus(`Bridge failed: ${error.message}`, 'error');
    }
  }

  async executeDeposit(amount, stacksRecipient) {
    // Call ChatGPT/MCP to prepare deposit transaction
    const response = await this.callMCPTool('prepareDeposit', {
      amount,
      stacksRecipient,
      userAddress: this.userEthAddress
    });

    if (response.error) {
      throw new Error(response.error);
    }

    // Execute transaction with MetaMask
    const txHash = await this.ethereum.request({
      method: 'eth_sendTransaction',
      params: [response._meta.transactionData]
    });

    this.showStatus(`Deposit initiated! TX: ${txHash}`, 'success');
    this.trackTransaction(txHash, 'ethereum');
  }

  async executeWithdrawal(amount, ethereumRecipient) {
    // Call ChatGPT/MCP to prepare withdrawal transaction
    const response = await this.callMCPTool('prepareWithdrawal', {
      amount,
      ethereumRecipient,
      stacksAddress: this.userStacksAddress
    });

    if (response.error) {
      throw new Error(response.error);
    }

    // Execute transaction with Leather
    const txResult = await this.stacksProvider.request('stx_signTransaction', {
      txHex: response._meta.transactionData.txHex
    });

    if (txResult.result) {
      this.showStatus(`Withdrawal initiated! TX: ${txResult.result.txId}`, 'success');
      this.trackTransaction(txResult.result.txId, 'stacks');
    }
  }

  async callMCPTool(toolName, params) {
    // This would be handled by ChatGPT's MCP integration
    // For now, return mock response structure
    console.log(`Calling MCP tool: ${toolName}`, params);

    // In real implementation, ChatGPT handles this through MCP
    return new Promise((resolve) => {
      setTimeout(() => {
        resolve({
          _meta: {
            transactionData: {
              to: '0x008888878f94C0d87defdf0B07f46B93C1934442',
              data: '0x...',
              value: '0x0',
              txHex: 'mock-tx-hex'
            }
          }
        });
      }, 1000);
    });
  }

  async trackTransaction(txHash, network) {
    // Poll for transaction status
    const checkStatus = async () => {
      try {
        const response = await this.callMCPTool('checkStatus', {
          transactionHash: txHash,
          network
        });

        if (response.status === 'completed') {
          this.showStatus('Bridge completed successfully!', 'success');
        } else if (response.status === 'failed') {
          this.showStatus('Transaction failed!', 'error');
        } else {
          // Continue polling
          setTimeout(checkStatus, 10000);
        }
      } catch (error) {
        console.error('Status check failed:', error);
      }
    };

    setTimeout(checkStatus, 5000);
  }

  updateUI() {
    // Update wallet connection status
    const connectEthBtn = document.getElementById('connectEthereumBtn');
    const connectStacksBtn = document.getElementById('connectStacksBtn');
    const walletInfo = document.getElementById('walletInfo');

    connectEthBtn.textContent = this.connectedEthereum
      ? `✓ MetaMask (${this.truncateAddress(this.userEthAddress)})`
      : 'Connect MetaMask';

    connectStacksBtn.textContent = this.connectedStacks
      ? `✓ Leather (${this.truncateAddress(this.userStacksAddress)})`
      : 'Connect Leather Wallet';

    // Update recipient placeholder
    const recipientInput = document.getElementById('recipient');
    recipientInput.placeholder = this.currentDirection === 'deposit'
      ? 'Enter Stacks address (ST...)'
      : 'Enter Ethereum address (0x...)';

    this.validateInputs();
  }

  truncateAddress(address) {
    if (!address) return '';
    return `${address.slice(0, 6)}...${address.slice(-4)}`;
  }

  showStatus(message, type) {
    const statusEl = document.getElementById('statusMessage');
    statusEl.textContent = message;
    statusEl.className = `status-message status-${type}`;

    if (type === 'success') {
      setTimeout(() => {
        statusEl.textContent = '';
        statusEl.className = '';
      }, 5000);
    }
  }
}

// Initialize bridge when page loads
document.addEventListener('DOMContentLoaded', () => {
  new USDCxBridge();
});