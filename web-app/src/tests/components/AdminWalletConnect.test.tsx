/**
 * AdminWalletConnect Component Tests
 */

import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { describe, it, expect, vi } from 'vitest';
import AdminWalletConnect from '../../components/AdminWalletConnect';

// Mock window.aptos (Petra wallet)
const mockAptos = {
  connect: vi.fn().mockResolvedValue({ address: '0x123' }),
  disconnect: vi.fn().mockResolvedValue(undefined),
  account: vi.fn().mockResolvedValue({
    address: '0x1234567890abcdef',
    publicKey: '0xabcdef',
  }),
  signAndSubmitTransaction: vi.fn().mockResolvedValue({
    hash: '0xtxhash123',
  }),
};

describe('AdminWalletConnect', () => {
  beforeEach(() => {
    // Mock window.aptos
    (window as any).aptos = mockAptos;
    
    // Mock fetch
    global.fetch = vi.fn();
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  it('should render wallet connection options', () => {
    render(<AdminWalletConnect />);
    
    expect(screen.getByText('Admin Wallet Connection')).toBeInTheDocument();
    expect(screen.getByText('Petra')).toBeInTheDocument();
    expect(screen.getByText('Martian')).toBeInTheDocument();
    expect(screen.getByText('Fewcha')).toBeInTheDocument();
  });

  it('should connect to Petra wallet', async () => {
    render(<AdminWalletConnect />);
    
    const petraButton = screen.getByText('Petra').closest('button');
    fireEvent.click(petraButton!);
    
    await waitFor(() => {
      expect(mockAptos.connect).toHaveBeenCalled();
      expect(screen.getByText(/Wallet Connected/i)).toBeInTheDocument();
    });
  });

  it('should display admin wallet balance', async () => {
    // Mock balance API response
    (global.fetch as any).mockResolvedValueOnce({
      ok: true,
      json: async () => ({
        data: { coin: { value: '1000000000' } }, // 10 APT
      }),
    });

    render(<AdminWalletConnect />);
    
    const petraButton = screen.getByText('Petra').closest('button');
    fireEvent.click(petraButton!);
    
    await waitFor(() => {
      expect(screen.getByText(/10\\.0000 APT/i)).toBeInTheDocument();
    });
  });

  it('should handle wallet connection error', async () => {
    mockAptos.connect.mockRejectedValueOnce(new Error('User rejected'));
    
    render(<AdminWalletConnect />);
    
    const petraButton = screen.getByText('Petra').closest('button');
    fireEvent.click(petraButton!);
    
    await waitFor(() => {
      expect(screen.getByText(/User rejected/i)).toBeInTheDocument();
    });
  });

  it('should disconnect wallet', async () => {
    render(<AdminWalletConnect />);
    
    // Connect first
    const petraButton = screen.getByText('Petra').closest('button');
    fireEvent.click(petraButton!);
    
    await waitFor(() => {
      expect(screen.getByText(/Wallet Connected/i)).toBeInTheDocument();
    });
    
    // Disconnect
    const disconnectButton = screen.getByText('Disconnect');
    fireEvent.click(disconnectButton);
    
    await waitFor(() => {
      expect(mockAptos.disconnect).toHaveBeenCalled();
      expect(screen.getByText('Petra')).toBeInTheDocument(); // Back to connect view
    });
  });
});

