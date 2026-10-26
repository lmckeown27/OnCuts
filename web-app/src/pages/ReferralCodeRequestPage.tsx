import { FormEvent, useState } from 'react';
import { useParams } from 'react-router-dom';
import api from '../services/api.service';

/**
 * Public page: request a referral code from an operator (peer of booking link).
 * Route: /web/refer/:operatorUserId
 */
export default function ReferralCodeRequestPage() {
  const { operatorUserId } = useParams<{ operatorUserId: string }>();
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [phone, setPhone] = useState('');
  const [message, setMessage] = useState('');
  const [done, setDone] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const onSubmit = async (e: FormEvent) => {
    e.preventDefault();
    if (!operatorUserId) return;
    try {
      setBusy(true);
      setError(null);
      await api.post(`/referrals/code-requests/${operatorUserId}`, {
        name,
        email,
        phone,
        message,
      });
      setDone(true);
    } catch (err: any) {
      setError(err?.message || 'Could not send request');
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="min-h-screen bg-stone-50 flex items-end sm:items-center justify-center p-4">
      <div className="w-full max-w-md bg-white rounded-2xl shadow-xl border border-stone-200 overflow-hidden">
        <div className="bg-brand-600 text-white px-5 py-4">
          <h1 className="text-xl font-bold">Request a referral code</h1>
          <p className="text-sm text-white/85 mt-1">
            Ask this operator for a code to join OnCuts. Beauty pros welcome.
          </p>
        </div>
        {done ? (
          <div className="p-6 text-sm text-gray-700 space-y-2">
            <p className="font-medium text-gray-900">Request sent.</p>
            <p>They’ll see it on their Referrals page and can share a code with you.</p>
          </div>
        ) : (
          <form onSubmit={onSubmit} className="p-5 space-y-4">
            {error && (
              <div className="rounded-lg bg-red-50 border border-red-200 text-red-800 text-sm px-3 py-2">
                {error}
              </div>
            )}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Name</label>
              <input
                className="w-full rounded-xl border border-stone-300 px-3 py-2.5 text-sm"
                value={name}
                onChange={(e) => setName(e.target.value)}
                required
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Email</label>
              <input
                type="email"
                className="w-full rounded-xl border border-stone-300 px-3 py-2.5 text-sm"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Phone</label>
              <input
                className="w-full rounded-xl border border-stone-300 px-3 py-2.5 text-sm"
                value={phone}
                onChange={(e) => setPhone(e.target.value)}
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Message</label>
              <textarea
                className="w-full rounded-xl border border-stone-300 px-3 py-2.5 text-sm min-h-[88px]"
                value={message}
                onChange={(e) => setMessage(e.target.value)}
              />
            </div>
            <button
              type="submit"
              disabled={busy}
              className="w-full rounded-xl bg-brand-600 hover:bg-brand-700 text-white font-semibold py-3 disabled:opacity-50"
            >
              {busy ? 'Sending…' : 'Request code'}
            </button>
          </form>
        )}
      </div>
    </div>
  );
}
