/**
 * Aptos Wallet Provider
 * 
 * Wraps the app with Aptos wallet adapter for wallet connection
 * Supports Petra and other Aptos wallets
 */

import React from 'react';
import { AptosWalletAdapterProvider } from '@aptos-labs/wallet-adapter-react';
import { PetraWallet } from 'petra-plugin-wallet-adapter';

interface WalletProviderProps {
  children: React.ReactNode;
}

export default function WalletProvider({ children }: WalletProviderProps) {
  // Configure wallet plugins
  const wallets = [new PetraWallet()];
  
  return (
    <AptosWalletAdapterProvider 
      plugins={wallets}
      autoConnect={false}
      onError={(error) => {
        console.error('Wallet adapter error:', error);
      }}
    >
      {children}
    </AptosWalletAdapterProvider>
  );
}

