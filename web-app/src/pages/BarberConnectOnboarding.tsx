/**
 * Path B — Barber payout setup (Sui USDC)
 *
 * Legacy URL /web/barber/connect — Stripe Connect removed; this page explains Path B
 * and sends barbers to the dashboard payout modal.
 */

import { useNavigate } from 'react-router-dom';
import { Wallet, ArrowRight } from 'lucide-react';
import Button from '../components/Button';
import Card from '../components/Card';

export const BarberConnectOnboarding = () => {
  const navigate = useNavigate();

  return (
    <div className="min-h-screen bg-gray-50 flex items-center justify-center p-4">
      <Card className="max-w-lg w-full p-8 shadow-lg">
        <div className="flex items-center gap-3 text-primary-600 mb-4">
          <Wallet className="w-8 h-8" />
          <h1 className="text-2xl font-bold text-gray-900">Payout setup (Path B)</h1>
        </div>
        <p className="text-gray-600 mb-4">
          CampusCuts pays barbers in <strong>USDC on Sui</strong> after customers pay in USD through Stripe
          Checkout. You need a <strong>Sui wallet address</strong> on file—no Stripe Connect bank onboarding.
        </p>
        <ul className="text-sm text-gray-600 list-disc pl-5 space-y-2 mb-6">
          <li>Open your barber dashboard to enter or update your Sui address.</li>
          <li>Use any compatible wallet (Sui Wallet, Suiet, etc.).</li>
          <li>Mobile app zkLogin will use the same backend when it ships.</li>
        </ul>
        <Button
          variant="primary"
          size="lg"
          className="w-full"
          onClick={() => navigate('/web/barber?showPayoutSettings=true')}
        >
          Open payout settings
          <ArrowRight className="w-4 h-4 ml-2 inline" />
        </Button>
      </Card>
    </div>
  );
};

export default BarberConnectOnboarding;
