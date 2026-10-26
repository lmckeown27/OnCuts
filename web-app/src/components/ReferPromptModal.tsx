import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import api from '../services/api.service';
import { useAuthStore } from '../store/useAuthStore';

/**
 * Post-booking / milestone thank-you prompt to refer someone.
 * At most once per cooldown; stops after max dismissals (server-enforced).
 */
export default function ReferPromptModal() {
  const user = useAuthStore((s) => s.user);
  const [open, setOpen] = useState(false);
  const [message, setMessage] = useState('');
  const [rewardPts, setRewardPts] = useState(0);

  useEffect(() => {
    if (!user?.id) return;
    let cancelled = false;
    void (async () => {
      try {
        const res = await api.get<{
          show: boolean;
          message?: string;
          rewardPts?: number;
        }>('/referrals/prompts/refer');
        if (cancelled || !res.show) return;
        setMessage(res.message || 'Know a great operator? Refer them and earn points.');
        setRewardPts(res.rewardPts || 0);
        setOpen(true);
        await api.post('/referrals/prompts/refer', { action: 'shown' });
      } catch {
        /* ignore */
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [user?.id]);

  if (!open) return null;

  const dismiss = async () => {
    try {
      await api.post('/referrals/prompts/refer', { action: 'dismiss' });
    } catch {
      /* ignore */
    }
    setOpen(false);
  };

  return (
    <div className="fixed inset-0 z-[1200] flex items-end sm:items-center justify-center bg-black/40 p-4">
      <div className="bg-white rounded-2xl shadow-2xl max-w-md w-full p-6 space-y-4">
        <h2 className="text-xl font-bold text-gray-900">Thanks — and one more thing</h2>
        <p className="text-sm text-gray-600 leading-relaxed">{message}</p>
        {rewardPts > 0 && (
          <p className="text-sm font-semibold text-emerald-800">
            Up to {rewardPts.toLocaleString()} pts
          </p>
        )}
        <div className="flex gap-2 pt-1">
          <button
            type="button"
            onClick={() => void dismiss()}
            className="flex-1 rounded-xl border border-stone-300 py-2.5 text-sm font-medium text-gray-700"
          >
            Not now
          </button>
          <Link
            to="/web/referrals"
            onClick={() => setOpen(false)}
            className="flex-1 rounded-xl bg-brand-600 text-white py-2.5 text-sm font-semibold text-center"
          >
            Refer someone
          </Link>
        </div>
      </div>
    </div>
  );
}
