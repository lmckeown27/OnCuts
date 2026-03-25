import type { ReactNode } from 'react';
import { EnokiFlowProvider } from '@mysten/enoki/react';
import { ENOKI_PUBLIC_API_KEY, isEnokiWalletlessEnabled } from '../config/constants';

/**
 * Wraps the app with Mysten `EnokiFlowProvider` when Enoki + Google OAuth env are set.
 * Enables `useEnokiFlow` / zkLogin redirect flow for the invisible wallet.
 */
export function EnokiFlowProviderGate({ children }: { children: ReactNode }) {
  if (!isEnokiWalletlessEnabled()) {
    return <>{children}</>;
  }
  return <EnokiFlowProvider apiKey={ENOKI_PUBLIC_API_KEY}>{children}</EnokiFlowProvider>;
}
