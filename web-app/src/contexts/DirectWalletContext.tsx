/**
 * Direct Wallet Context
 * 
 * Enhanced wallet adapter with persistence
 * Features:
 * - Uses Aptos Wallet Adapter standard (compliant with Petra)
 * - Persistent connections via localStorage
 * - Auto-reconnection on page load
 * - Simple, reliable connection management
 */

import React, { createContext, useContext, useState, useEffect, ReactNode } from 'react';
import { useWallet } from '@aptos-labs/wallet-adapter-react';
import toast from 'react-hot-toast';

interface DirectWalletContextType {
  connected: boolean;
  address: string;
  petraInstalled: boolean;
  wallet: any;
  connectWallet: () => Promise<void>;
  disconnectWallet: () => Promise<void>;
  getAccount: () => { address: string } | null;
  signAndSubmitTransaction: (payload: any) => Promise<any>;
}

const DirectWalletContext = createContext<DirectWalletContextType | undefined>(undefined);

interface DirectWalletProviderProps {
  children: ReactNode;
}

export function DirectWalletProvider({ children }: DirectWalletProviderProps) {
  // Use wallet adapter hooks
  const { 
    connected: adapterConnected, 
    account, 
    connect, 
    disconnect, 
    wallet: adapterWallet,
    wallets,
    signAndSubmitTransaction: adapterSignAndSubmit
  } = useWallet();

  const [localConnected, setLocalConnected] = useState(false);
  const [localAddress, setLocalAddress] = useState('');
  const [petraInstalled, setPetraInstalled] = useState(false);

  // Check if wallets are available via wallet adapter
  useEffect(() => {
    let checkCount = 0;
    const maxChecks = 15; // Check for up to 15 seconds (wallet adapter can be slow)
    
    const checkWallets = () => {
      checkCount++;
      
      if (wallets && wallets.length > 0) {
        console.log(`✅ [${checkCount}/${maxChecks}] Wallets detected:`, wallets.map(w => ({
          name: w.name,
          readyState: w.readyState,
        })));
        
        setPetraInstalled(true);
        return;
      }
      
      console.log(`🔍 [${checkCount}/${maxChecks}] Waiting for wallet adapter to detect wallets...`);
      
      if (checkCount >= maxChecks) {
        console.error('❌ No wallets detected by adapter after 15 seconds.');
        console.error('⚠️ Please ensure:');
        console.error('   1. Petra wallet extension is installed');
        console.error('   2. Petra extension is enabled in chrome://extensions/');
        console.error('   3. Try refreshing the page');
        setPetraInstalled(false);
      }
    };

    // Initial check
    checkWallets();
    
    // Retry every 1 second
    const timers: NodeJS.Timeout[] = [];
    for (let i = 1; i <= maxChecks; i++) {
      timers.push(setTimeout(checkWallets, i * 1000));
    }
    
    return () => {
      timers.forEach(timer => clearTimeout(timer));
    };
  }, [wallets]);

  // Sync adapter state with local state
  useEffect(() => {
    if (adapterConnected && account?.address) {
      console.log('✅ Wallet connected via adapter:', account.address);
      setLocalConnected(true);
      setLocalAddress(account.address);
      
      // Persist to localStorage
      localStorage.setItem('ccWalletConnected', 'true');
      localStorage.setItem('ccWalletAddress', account.address);
    } else if (!adapterConnected) {
      setLocalConnected(false);
      setLocalAddress('');
    }
  }, [adapterConnected, account]);

  // Auto-reconnection on page load
  useEffect(() => {
    const autoReconnect = async () => {
      // Check if was previously connected
      const wasConnected = localStorage.getItem('ccWalletConnected') === 'true';
      
      if (!wasConnected) {
        console.log('⏸️ No previous connection found');
        return;
      }

      // If adapter says connected, we're good
      if (adapterConnected) {
        console.log('✅ Already connected via adapter');
        return;
      }

      console.log('🔄 Attempting auto-reconnection...');

      // Wait for wallets to load
      if (!wallets || wallets.length === 0) {
        console.log('⏸️ Wallets not loaded yet, will retry...');
        return;
      }

      try {
        const petra = wallets.find(w => w.name.toLowerCase().includes('petra'));
        if (petra) {
          await connect(petra.name);
          console.log('✅ Auto-reconnected to', petra.name);
          toast.success('Wallet reconnected');
        } else {
          console.log('⏸️ Petra not found in wallets, clearing stale data');
          localStorage.removeItem('ccWalletConnected');
          localStorage.removeItem('ccWalletAddress');
        }
      } catch (error) {
        console.error('❌ Auto-reconnect failed:', error);
        // Clear stale data
        localStorage.removeItem('ccWalletConnected');
        localStorage.removeItem('ccWalletAddress');
      }
    };

    // Wait longer for wallets to load (wallet adapter can be slow)
    const timer = setTimeout(autoReconnect, 2000);
    return () => clearTimeout(timer);
  }, [wallets, connect, adapterConnected]);

  const connectWallet = async () => {
    console.log('🔗 Connecting to wallet...');
    console.log('🔗 Wallets available:', wallets?.length || 0);

    if (!wallets || wallets.length === 0) {
      console.error('❌ No wallets detected by adapter');
      toast.error('No wallet detected. Please install Petra wallet and refresh the page.');
      
      const installUrl = 'https://petra.app/';
      const shouldInstall = window.confirm(
        'Petra wallet not detected. Would you like to install it?\n\nAfter installing, please refresh this page.'
      );
      
      if (shouldInstall) {
        window.open(installUrl, '_blank');
      }
      return;
    }

    console.log('🔗 Available wallets:', wallets.map(w => ({ name: w.name, readyState: w.readyState })));

    // Try to find Petra first
    let targetWallet = wallets.find(w => w.name.toLowerCase().includes('petra'));
    
    // If no Petra, use the first available wallet
    if (!targetWallet && wallets.length > 0) {
      console.log('⚠️ Petra not found, using first available wallet:', wallets[0].name);
      targetWallet = wallets[0];
    }
    
    if (!targetWallet) {
      console.error('❌ No connectable wallet found');
      toast.error('No wallet available. Please install Petra wallet.');
      return;
    }

    try {
      console.log('🔗 Connecting to:', targetWallet.name);
      console.log('🔗 Wallet ready state:', targetWallet.readyState);
      
      await connect(targetWallet.name);
      
      console.log('✅ Connected to wallet!');
      toast.success(`Connected to ${targetWallet.name}!`);
    } catch (error: any) {
      console.error('❌ Connection error:', error);
      console.error('❌ Error details:', {
        message: error.message,
        code: error.code,
        name: error.name
      });
      
      if (error.code === 4001) {
        toast.error('Connection cancelled by user');
      } else if (error.message?.includes('network')) {
        toast.error('Network mismatch. Please switch your wallet to Devnet.');
      } else if (error.message?.includes('User rejected')) {
        toast.error('Connection request rejected');
      } else {
        toast.error(`Failed to connect: ${error.message || 'Unknown error'}`);
      }
    }
  };

  const disconnectWallet = async () => {
    console.log('🔌 Disconnecting wallet...');

    try {
      await disconnect();
      
      // Clear localStorage
      localStorage.removeItem('ccWalletConnected');
      localStorage.removeItem('ccWalletAddress');
      
      console.log('✅ Wallet disconnected');
      toast.success('Wallet disconnected');
    } catch (error) {
      console.error('❌ Disconnect error:', error);
      
      // Clear state anyway
      localStorage.removeItem('ccWalletConnected');
      localStorage.removeItem('ccWalletAddress');
      
      toast.success('Wallet disconnected');
    }
  };

  const getAccount = () => {
    if (!localConnected || !localAddress) {
      return null;
    }
    
    return { address: localAddress };
  };

  const signAndSubmitTransaction = async (payload: any) => {
    if (!localConnected) {
      throw new Error('Wallet not connected');
    }
    
    if (!adapterSignAndSubmit) {
      throw new Error('Wallet adapter not available for transaction signing');
    }
    
    return await adapterSignAndSubmit(payload);
  };

  const value: DirectWalletContextType = {
    connected: localConnected,
    address: localAddress,
    petraInstalled,
    wallet: adapterWallet,
    connectWallet,
    disconnectWallet,
    getAccount,
    signAndSubmitTransaction,
  };

  return (
    <DirectWalletContext.Provider value={value}>
      {children}
    </DirectWalletContext.Provider>
  );
}

export function useDirectWallet() {
  const context = useContext(DirectWalletContext);
  
  if (context === undefined) {
    throw new Error('useDirectWallet must be used within a DirectWalletProvider');
  }
  
  return context;
}

