/**
 * Wallet Helper Utilities
 * 
 * Common wallet operations for Aptos/Petra wallet
 */

import { Aptos, AptosConfig, Network } from '@aptos-labs/ts-sdk';

const aptosConfig = new AptosConfig({
  network: (import.meta.env.VITE_APTOS_NETWORK as Network) || Network.DEVNET,
});

const aptos = new Aptos(aptosConfig);

/**
 * Check if wallet has sufficient APT for transaction fees
 * @param walletAddress - Aptos wallet address
 * @returns Balance in APT
 * @throws Error if balance is insufficient
 */
export async function checkGasBalance(walletAddress: string): Promise<number> {
  try {
    const resources = await aptos.getAccountResources({ accountAddress: walletAddress });
    const accountResource = resources.find((r: any) => r.type === '0x1::coin::CoinStore<0x1::aptos_coin::AptosCoin>');
    
    if (!accountResource) {
      throw new Error('APT balance not found');
    }
    
    const balance = Number((accountResource.data as any).coin.value);
    const aptBalance = balance / 100000000; // Convert octas to APT
    
    if (aptBalance < 0.001) {
      throw new Error(
        `Insufficient APT for gas fees. Balance: ${aptBalance.toFixed(4)} APT. ` +
        `Please fund your wallet from the faucet: https://aptoslabs.com/testnet-faucet`
      );
    }
    
    return aptBalance;
  } catch (error) {
    console.error('Failed to check gas balance:', error);
    throw error;
  }
}

/**
 * Wait for transaction confirmation with timeout
 * @param txHash - Transaction hash
 * @param timeoutMs - Timeout in milliseconds (default: 30000)
 * @returns true on success
 * @throws Error on timeout or failure
 */
export async function waitForTransactionWithTimeout(
  txHash: string,
  timeoutMs: number = 30000
): Promise<boolean> {
  const startTime = Date.now();
  
  while (Date.now() - startTime < timeoutMs) {
    try {
      const txn = await aptos.waitForTransaction({
        transactionHash: txHash,
        options: { checkSuccess: true }
      });
      
      if (txn.success) {
        console.log('✅ Transaction confirmed:', txHash);
        return true;
      }
    } catch (error: any) {
      if (error.message?.includes('not found')) {
        // Transaction not yet indexed, wait and retry
        await new Promise(resolve => setTimeout(resolve, 1000));
        continue;
      }
      throw error;
    }
  }
  
  throw new Error(`Transaction confirmation timeout after ${timeoutMs}ms. Hash: ${txHash}`);
}

/**
 * Format wallet address for display
 * @param address - Full wallet address
 * @param startLength - Characters to show at start (default: 6)
 * @param endLength - Characters to show at end (default: 4)
 * @returns Formatted address (e.g., "0x1234...abcd")
 */
export function formatAddress(
  address: string,
  startLength: number = 6,
  endLength: number = 4
): string {
  if (!address || address.length < startLength + endLength) {
    return address;
  }
  
  return `${address.slice(0, startLength)}...${address.slice(-endLength)}`;
}

/**
 * Get Aptos Explorer URL for transaction
 * @param txHash - Transaction hash
 * @param network - Network name (default: from env)
 * @returns Explorer URL
 */
export function getExplorerTxUrl(
  txHash: string,
  network?: string
): string {
  const net = network || import.meta.env.VITE_APTOS_NETWORK || 'devnet';
  return `https://explorer.aptoslabs.com/txn/${txHash}?network=${net}`;
}

/**
 * Get Aptos Explorer URL for account
 * @param address - Wallet address
 * @param network - Network name (default: from env)
 * @returns Explorer URL
 */
export function getExplorerAccountUrl(
  address: string,
  network?: string
): string {
  const net = network || import.meta.env.VITE_APTOS_NETWORK || 'devnet';
  return `https://explorer.aptoslabs.com/account/${address}?network=${net}`;
}

/**
 * Get Petra wallet instance from window
 * @returns Petra wallet object
 * @throws Error if Petra not found
 */
export function getPetraWallet(): any {
  const petra = (window as any).aptos || (window as any).petra;
  
  if (!petra) {
    throw new Error('Petra wallet not detected. Please install Petra wallet from https://petra.app/');
  }
  
  return petra;
}

