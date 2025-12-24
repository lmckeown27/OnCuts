// @ts-nocheck
/**
 * Aptos Wallet Provider
 * 
 * DISABLED - Wallet/blockchain functionality not currently in use.
 * Platform uses Stripe for payments.
 * 
 * This file is kept for future blockchain integration.
 * All wallet adapter imports and detection code are commented out
 * to prevent MetaMask/Petra detection errors.
 */

import React from 'react';

interface WalletProviderProps {
  children: React.ReactNode;
}

// Disabled provider - just passes through children, no wallet detection
export default function WalletProvider({ children }: WalletProviderProps) {
  // Wallet functionality disabled - no detection, no errors
  return <>{children}</>;
}

/*
// ORIGINAL WALLET PROVIDER CODE - COMMENTED OUT
// Uncomment when ready to re-enable blockchain functionality

import { AptosWalletAdapterProvider } from '@aptos-labs/wallet-adapter-react';

export default function WalletProvider({ children }: WalletProviderProps) {
  const network = import.meta.env.VITE_APTOS_NETWORK || 'devnet';
  
  useEffect(() => {
    console.log('🌐 Wallet Provider initializing with network:', network);
    console.log('🌐 Checking for window.petra...', typeof (window as any).petra);
    console.log('🌐 Checking for window.aptos...', typeof (window as any).aptos);
    
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
*/
