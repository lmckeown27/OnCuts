/**
 * Aptos Wallet Provider
 * 
 * Wraps the app with Aptos wallet adapter for wallet connection
 * Supports Petra, Martian, Pontem, and other Aptos wallets
 */

import React from 'react';
import { AptosWalletAdapterProvider } from '@aptos-labs/wallet-adapter-react';

interface WalletProviderProps {
  children: React.ReactNode;
}

export default function WalletProvider({ children }: WalletProviderProps) {
  // Auto-detect installed wallets (Petra, Martian, Pontem, etc.)
  // The adapter will automatically discover wallets from browser extensions
  return (
    <AptosWalletAdapterProvider 
      autoConnect={false}
      onError={(error) => {
        console.error('Wallet adapter error:', error);
      }}
    >
      {children}
    </AptosWalletAdapterProvider>
  );
}

