/**
 * Direct Wallet Context
 * 
 * Primary wallet connection system using direct Petra API integration
 * Features:
 * - Direct window.aptos integration
 * - Persistent connections via localStorage
 * - Auto-reconnection on page load
 * - Simple, reliable connection management
 */

import React, { createContext, useContext, useState, useEffect, ReactNode } from 'react';
import toast from 'react-hot-toast';

interface DirectWalletContextType {
  connected: boolean;
  address: string;
  petraInstalled: boolean;
  wallet: any;
  connectWallet: () => Promise<void>;
  disconnectWallet: () => Promise<void>;
  getAccount: () => { address: string } | null;
}

const DirectWalletContext = createContext<DirectWalletContextType | undefined>(undefined);

interface DirectWalletProviderProps {
  children: ReactNode;
}

export function DirectWalletProvider({ children }: DirectWalletProviderProps) {
  const [connected, setConnected] = useState(false);
  const [address, setAddress] = useState('');
  const [petraInstalled, setPetraInstalled] = useState(false);
  const [wallet, setWallet] = useState<any>(null);

  // Check if Petra is installed (with delay for extension load)
  useEffect(() => {
    const checkPetra = () => {
      const petra = (window as any).aptos;
      const isInstalled = !!petra;
      
      console.log('🔍 Checking for Petra wallet...', isInstalled ? 'Found!' : 'Not found');
      setPetraInstalled(isInstalled);
      
      if (isInstalled) {
        setWallet(petra);
      }
    };

    // Check immediately
    checkPetra();
    
    // Check again after 1 second (extension might load late)
    const timer = setTimeout(checkPetra, 1000);
    
    return () => clearTimeout(timer);
  }, []);

  // Auto-reconnection logic on page load
  useEffect(() => {
    const autoReconnect = async () => {
      if (!petraInstalled || !wallet) {
        console.log('⏸️ Petra not installed, skipping auto-reconnect');
        return;
      }

      // Check if was previously connected
      const wasConnected = localStorage.getItem('ccWalletConnected') === 'true';
      const cachedAddress = localStorage.getItem('ccWalletAddress');

      if (!wasConnected) {
        console.log('⏸️ No previous connection found');
        return;
      }

      console.log('🔄 Attempting auto-reconnection...');

      try {
        // Check if still connected in Petra
        const isConnected = await wallet.isConnected();
        
        if (isConnected) {
          // Get current account
          const account = await wallet.account();
          
          if (account && account.address) {
            console.log('✅ Auto-reconnected:', account.address);
            setAddress(account.address);
            setConnected(true);
            localStorage.setItem('ccWalletAddress', account.address);
            toast.success('Wallet reconnected');
          }
        } else {
          // Petra says disconnected, clear stale data
          console.log('⚠️ Petra reports disconnected, clearing cache');
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

    if (petraInstalled && wallet) {
      autoReconnect();
    }
  }, [petraInstalled, wallet]);

  const connectWallet = async () => {
    console.log('🔗 Connecting to Petra wallet...');

    if (!petraInstalled || !wallet) {
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
      // Request connection
      const response = await wallet.connect();
      
      if (response && response.address) {
        console.log('✅ Connected to Petra wallet!');
        console.log('📍 Address:', response.address);
        
        setAddress(response.address);
        setConnected(true);
        
        // Persist connection state
        localStorage.setItem('ccWalletConnected', 'true');
        localStorage.setItem('ccWalletAddress', response.address);
        
        toast.success('Wallet connected successfully!');
      }
    } catch (error: any) {
      console.error('❌ Connection error:', error);
      
      if (error.code === 4001) {
        // User rejected connection
        toast.error('Connection cancelled');
      } else {
        toast.error('Failed to connect wallet');
      }
    }
  };

  const disconnectWallet = async () => {
    console.log('🔌 Disconnecting wallet...');

    try {
      if (wallet) {
        await wallet.disconnect();
      }
      
      // Clear state
      setAddress('');
      setConnected(false);
      
      // Clear localStorage
      localStorage.removeItem('ccWalletConnected');
      localStorage.removeItem('ccWalletAddress');
      
      console.log('✅ Wallet disconnected');
      toast.success('Wallet disconnected');
    } catch (error) {
      console.error('❌ Disconnect error:', error);
      
      // Clear state anyway
      setAddress('');
      setConnected(false);
      localStorage.removeItem('ccWalletConnected');
      localStorage.removeItem('ccWalletAddress');
    }
  };

  const getAccount = () => {
    if (!connected || !address) {
      return null;
    }
    
    return { address };
  };

  const value: DirectWalletContextType = {
    connected,
    address,
    petraInstalled,
    wallet,
    connectWallet,
    disconnectWallet,
    getAccount,
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

