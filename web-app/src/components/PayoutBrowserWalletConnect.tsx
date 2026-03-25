/**
 * Connect Chrome / Edge Sui extension (Wallet Standard) and copy address into payout flow.
 */
import { ConnectButton, useCurrentAccount } from '@mysten/dapp-kit';
import { normalizeSuiAddress, isValidSuiAddress } from '@mysten/sui/utils';
import Button from './Button';

type Props = {
  onAddressChosen: (normalizedAddress: string) => void;
  disabled?: boolean;
};

export default function PayoutBrowserWalletConnect({ onAddressChosen, disabled }: Props) {
  const account = useCurrentAccount();

  const handleUseConnected = () => {
    if (!account?.address) return;
    const n = normalizeSuiAddress(account.address);
    if (!isValidSuiAddress(n)) return;
    onAddressChosen(n);
  };

  return (
    <div className="rounded-xl border border-gray-200 bg-slate-50/80 p-4 mb-5">
      <p className="text-sm font-medium text-gray-900 mb-1">Browser extension wallet</p>
      <p className="text-xs text-gray-600 mb-3">
        Use Sui Wallet, Suiet, or any Wallet Standard extension. Your address is read locally—CampusCuts never
        sees your keys.
      </p>
      <div className="flex flex-col sm:flex-row sm:flex-wrap sm:items-center gap-3">
        <ConnectButton
          type="button"
          disabled={disabled}
          connectText="Connect extension wallet"
          className="inline-flex items-center justify-center rounded-lg bg-primary-600 px-4 py-2.5 text-sm font-medium text-white hover:bg-primary-700 focus:outline-none focus:ring-2 focus:ring-primary-500 focus:ring-offset-2 disabled:opacity-50"
        />
        {account?.address && (
          <>
            <span className="text-xs font-mono text-gray-700 truncate max-w-full sm:max-w-[220px]" title={account.address}>
              {normalizeSuiAddress(account.address)}
            </span>
            <Button
              type="button"
              variant="secondary"
              size="sm"
              disabled={disabled}
              onClick={handleUseConnected}
            >
              Fill payout address
            </Button>
          </>
        )}
      </div>
      <p className="text-[11px] text-gray-500 mt-2">
        After filling, tap <strong>Save payout address</strong> below to store it on your account.
      </p>
    </div>
  );
}
