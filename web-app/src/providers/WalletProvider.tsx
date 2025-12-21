// @ts-nocheck
/**
 * Aptos Wallet Provider
 * 
 * Wraps the app with Aptos wallet adapter for wallet connection
 * Supports Petra and other Aptos wallets (auto-detected)
 * Network: Devnet by default (configurable via env)
 * 
 * Note: Uses Wallet Adapter v7+ which auto-detects installed wallets
 * No need for explicit wallet plugins (deprecated approach)
 */

import React, { useEffect } from 'react';
import { AptosWalletAdapterProvider } from '@aptos-labs/wallet-adapter-react';

interface WalletProviderProps {
  children: React.ReactNode;
}

export default function WalletProvider({ children }: WalletProviderProps) {
  // Get network from env or default to devnet
  const network = import.meta.env.VITE_APTOS_NETWORK || 'devnet';
  
  useEffect(() => {
    console.log('🌐 Wallet Provider initializing with network:', network);
    console.log('🌐 Checking for window.petra...', typeof (window as any).petra);
    console.log('🌐 Checking for window.aptos...', typeof (window as any).aptos);
    
    // Check again after delay to see if extensions loaded
    const timer = setTimeout(() => {
      console.log('✅ Wallet provider ready after delay');
      console.log('🌐 After delay - window.petra:', typeof (window as any).petra);
      console.log('🌐 After delay - window.aptos:', typeof (window as any).aptos);
    }, 500);
    
    return () => clearTimeout(timer);
  }, [network]);
  
  return (
    <AptosWalletAdapterProvider 
      plugins={[]}
      autoConnect={false}
      onError={(error) => {
        console.error('❌ Wallet adapter error:', error);
      }}
    >
      {children}
    </AptosWalletAdapterProvider>
  );
}

