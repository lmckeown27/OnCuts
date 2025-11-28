/**
 * Aptos Wallet Provider
 * 
 * Wraps the app with Aptos wallet adapter context
 * Supports Petra, Pontem, and other Aptos wallets
 */

import { AptosWalletAdapterProvider } from '@aptos-labs/wallet-adapter-react';
import { PetraWallet } from '@aptos-labs/wallet-adapter-petra';
import { PontemWallet } from '@aptos-labs/wallet-adapter-pontem';
import { Network } from '@aptos-labs/ts-sdk';
import { ReactNode } from 'react';

interface Props {
  children: ReactNode;
}

export default function AptosWalletProvider({ children }: Props) {
  const wallets = [
    new PetraWallet(),
    new PontemWallet(),
  ];

  // Use devnet for development, mainnet for production
  const network = (import.meta.env.VITE_APTOS_NETWORK || 'devnet') as Network;

  return (
    <AptosWalletAdapterProvider
      plugins={wallets}
      autoConnect={false}
      dappConfig={{
        network,
        aptosConnectDappId: 'campuscuts-gas-wallet',
      }}
      onError={(error) => {
        console.error('Wallet adapter error:', error);
      }}
    >
      {children}
    </AptosWalletAdapterProvider>
  );
}

