/**
 * Zero-UI Sui layer: no "Connect wallet" — users only see Sign in with Google (zkLogin).
 * Exposes a read-only SuiClient for balance / settlement checks when needed.
 */

import React, { createContext, useContext, useMemo } from 'react';
import { SuiClient } from '@mysten/sui/client';
import { SUI_RPC_URL } from '../config/constants';

const SuiEnvContext = createContext<{ client: SuiClient } | null>(null);

export function useSuiClient(): SuiClient {
  const ctx = useContext(SuiEnvContext);
  if (!ctx) {
    throw new Error('WalletProvider missing');
  }
  return ctx.client;
}

interface WalletProviderProps {
  children: React.ReactNode;
}

export default function WalletProvider({ children }: WalletProviderProps) {
  const client = useMemo(
    () =>
      new SuiClient({
        url: SUI_RPC_URL,
      }),
    []
  );

  return <SuiEnvContext.Provider value={{ client }}>{children}</SuiEnvContext.Provider>;
}
