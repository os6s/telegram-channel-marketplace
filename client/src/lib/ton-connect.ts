import { TonConnectUI } from '@tonconnect/ui-react';

export interface TonWallet {
  address: string;
  balance: string;
  network: 'mainnet' | 'testnet';
}

export interface TonTransaction {
  to: string;
  amount: string;
  comment?: string;
}

// Real TON Connect implementation using @tonconnect/ui-react
export class TonConnect {
  private static instance: TonConnect;
  private tonConnectUI: TonConnectUI | null = null;
  private wallet: TonWallet | null = null;
  private isConnecting = false;

  constructor() {
    this.initializeTonConnect();
  }

  private async initializeTonConnect() {
    if (typeof window !== 'undefined') {
      try {
        this.tonConnectUI = new TonConnectUI({
          manifestUrl: `${window.location.origin}/tonconnect-manifest.json`,
        });

        // Listen for wallet status changes
        this.tonConnectUI.onStatusChange((wallet) => {
          if (wallet) {
            this.wallet = {
              address: wallet.account.address,
              balance: '0',
              network: wallet.account.chain === '-239' ? 'mainnet' : 'testnet'
            };
            this.fetchBalance();
          } else {
            this.wallet = null;
          }
        });

        // Try to restore existing connection
        const currentWallet = this.tonConnectUI.wallet;
        if (currentWallet?.account) {
          this.wallet = {
            address: currentWallet.account.address,
            balance: '0',
            network: currentWallet.account.chain === '-239' ? 'mainnet' : 'testnet'
          };
          this.fetchBalance();
        }
      } catch (error) {
        console.error('Failed to initialize TonConnect:', error);
      }
    }
  }

  private async fetchBalance() {
    if (!this.wallet) return;
    
    try {
      // Use TON API to fetch real balance
      const response = await fetch(`https://toncenter.com/api/v2/getAddressInformation?address=${this.wallet.address}`);
      const data = await response.json();
      
      if (data.ok && data.result.balance) {
        // Convert nanoTON to TON (divide by 10^9)
        const balanceInTon = (parseInt(data.result.balance) / 1000000000).toFixed(3);
        this.wallet.balance = balanceInTon;
      }
    } catch (error) {
      console.error('Failed to fetch balance:', error);
      // Use a reasonable placeholder balance
      this.wallet.balance = '0.000';
    }
  }

  static getInstance(): TonConnect {
    if (!TonConnect.instance) {
      TonConnect.instance = new TonConnect();
    }
    return TonConnect.instance;
  }

  get isConnected(): boolean {
    return !!this.wallet && !!this.tonConnectUI?.wallet;
  }

  get connectedWallet(): TonWallet | null {
    return this.wallet;
  }

  async connect(): Promise<TonWallet> {
    if (this.isConnecting) {
      throw new Error('Connection already in progress');
    }

    if (!this.tonConnectUI) {
      throw new Error('TonConnect UI not initialized');
    }

    this.isConnecting = true;

    try {
      // Open TON Connect modal
      await this.tonConnectUI.openModal();
      
      // Wait for connection to complete
      return new Promise((resolve, reject) => {
        const timeout = setTimeout(() => {
          this.isConnecting = false;
          reject(new Error('Connection timeout'));
        }, 30000);

        const unsubscribe = this.tonConnectUI!.onStatusChange((wallet) => {
          if (wallet && this.wallet) {
            clearTimeout(timeout);
            unsubscribe();
            this.isConnecting = false;
            resolve(this.wallet);
          }
        });
      });
    } catch (error) {
      this.isConnecting = false;
      throw error;
    }
  }

  async disconnect(): Promise<void> {
    if (this.tonConnectUI) {
      await this.tonConnectUI.disconnect();
    }
    this.wallet = null;
  }

  async sendTransaction(transaction: TonTransaction): Promise<string> {
    if (!this.wallet || !this.tonConnectUI) {
      throw new Error('Wallet not connected');
    }

    const txRequest = {
      validUntil: Math.floor(Date.now() / 1000) + 300, // Valid for 5 minutes
      messages: [
        {
          address: transaction.to,
          amount: (parseFloat(transaction.amount) * 1000000000).toString(), // Convert TON to nanoTON
          payload: transaction.comment ? btoa(transaction.comment) : undefined
        }
      ]
    };

    const result = await this.tonConnectUI.sendTransaction(txRequest);
    return result.boc;
  }

  async getBalance(): Promise<string> {
    if (!this.wallet) {
      throw new Error('Wallet not connected');
    }

    await this.fetchBalance();
    return this.wallet.balance;
  }

  // Try to restore connection from TonConnect UI
  async restoreConnection(): Promise<TonWallet | null> {
    if (this.tonConnectUI?.wallet?.account) {
      if (!this.wallet) {
        this.wallet = {
          address: this.tonConnectUI.wallet.account.address,
          balance: '0',
          network: this.tonConnectUI.wallet.account.chain === '-239' ? 'mainnet' : 'testnet'
        };
        this.fetchBalance();
      }
      return this.wallet;
    }
    
    return null;
  }
}

export const tonConnect = TonConnect.getInstance();
