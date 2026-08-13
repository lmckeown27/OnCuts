import { useState } from 'react';
import { Copy, Check, Link2 } from 'lucide-react';
import Button from './Button';
import Card from './Card';
import toast from 'react-hot-toast';

export function buildBarberBookingPageUrl(barberRecordId: string): string {
  return `${window.location.origin}/web/consumer/book/${barberRecordId}`;
}

export default function BarberBookingLinkCard({
  barberRecordId,
}: {
  barberRecordId: string;
}) {
  const [copied, setCopied] = useState(false);
  const bookingPageUrl = buildBarberBookingPageUrl(barberRecordId);

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(bookingPageUrl);
      setCopied(true);
      toast.success('Booking link copied');
      window.setTimeout(() => setCopied(false), 2000);
    } catch {
      toast.error('Could not copy link');
    }
  };

  return (
    <Card>
      <h3 className="text-lg font-semibold mb-2 flex items-center gap-2">
        <Link2 className="w-5 h-5 text-gray-700" />
        Booking link
      </h3>
      <p className="text-sm text-gray-600 mb-4">
        Share this link so clients can book you directly without searching.
      </p>
      <div className="flex items-stretch gap-2">
        <input
          type="text"
          readOnly
          value={bookingPageUrl}
          onFocus={(e) => e.currentTarget.select()}
          className="flex-1 min-w-0 px-3 py-2 border border-gray-300 rounded-lg bg-gray-50 text-sm text-gray-700 truncate"
          aria-label="Your booking page link"
        />
        <Button
          type="button"
          variant="secondary"
          size="sm"
          onClick={() => void handleCopy()}
          className="shrink-0 whitespace-nowrap"
        >
          {copied ? (
            <>
              <Check className="w-4 h-4 mr-1.5 text-emerald-600" />
              Copied
            </>
          ) : (
            <>
              <Copy className="w-4 h-4 mr-1.5" />
              Copy
            </>
          )}
        </Button>
      </div>
    </Card>
  );
}
