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

  // Check if Petra is available
  useEffect(() => {
    const checkPetra = () => {
      if (!wallets || wallets.length === 0) {
        console.log('🔍 Checking for Petra wallet... Waiting for wallets to load');
        return;
      }
      
      const hasPetra = wallets.some(w => w.name.toLowerCase().includes('petra'));
      console.log('🔍 Checking for Petra wallet...', hasPetra ? 'Found!' : 'Not found');
      setPetraInstalled(hasPetra);
    };

    checkPetra();
    const timer = setTimeout(checkPetra, 1000);
    return () => clearTimeout(timer);
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

      try {
        // Check if wallets are loaded
        if (!wallets || wallets.length === 0) {
          console.log('⏸️ Wallets not loaded yet, skipping auto-reconnect');
          return;
        }
        
        // Try to reconnect
        const petra = wallets.find(w => w.name.toLowerCase().includes('petra'));
        if (petra) {
          await connect(petra.name);
          console.log('✅ Auto-reconnected to Petra');
          toast.success('Wallet reconnected');
        }
      } catch (error) {
        console.error('❌ Auto-reconnect failed:', error);
        // Clear stale data
        localStorage.removeItem('ccWalletConnected');
        localStorage.removeItem('ccWalletAddress');
      }
    };

    // Wait a bit for wallets to load
    const timer = setTimeout(autoReconnect, 1500);
    return () => clearTimeout(timer);
  }, [wallets, connect, adapterConnected]);

  const connectWallet = async () => {
    console.log('🔗 Connecting to Petra wallet...');

    if (!wallets || wallets.length === 0) {
      toast.error('Wallets not loaded yet. Please wait a moment and try again.');
      return;
    }

    const petra = wallets.find(w => w.name.toLowerCase().includes('petra'));
    
    if (!petra) {
      const installUrl = 'https://petra.app/';
      const shouldInstall = window.confirm(
        'Petra wallet not detected. Would you like to install it?'
      );
      
      if (shouldInstall) {
        window.open(installUrl, '_blank');
      }
      return;
    }

    try {
      await connect(petra.name);
      console.log('✅ Connected to Petra wallet!');
      toast.success('Wallet connected successfully!');
    } catch (error: any) {
      console.error('❌ Connection error:', error);
      
      if (error.code === 4001) {
        toast.error('Connection cancelled');
      } else {
        toast.error('Failed to connect wallet');
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

