import { MapPin } from 'lucide-react';
import type { Barber } from '../types';
import BarberPhotoTile from './BarberPhotoTile';
import type { MyBarberEntry } from '../utils/myBarbersDiscover';
import {
  groupBarbersByLocationLabel,
  publicBroadLocationLabel,
} from '../utils/myBarbersDiscover';

interface MyBarbersViewProps {
  entries: MyBarberEntry[];
  loading: boolean;
  onSelectBarber: (barber: Barber) => void;
  onGoDiscover: () => void;
  isAuthenticated: boolean;
}

export default function MyBarbersView({
  entries,
  loading,
  onSelectBarber,
  onGoDiscover,
  isAuthenticated,
}: MyBarbersViewProps) {
  const groups = groupBarbersByLocationLabel(entries);
  const groupedIds = new Set(groups.flatMap((g) => g.items.map((b) => b.id)));
  const unlocated = entries.filter(
    (e) => !groupedIds.has(e.barber.id) && !publicBroadLocationLabel(e.barber)
  );

  return (
    <div className="mt-2 sm:mt-4">
      {loading && (
        <div className="py-16 text-center text-gray-500 text-sm">Loading your barbers…</div>
      )}

      {!loading && !isAuthenticated && (
        <div className="rounded-2xl border border-stone-200 bg-gradient-to-b from-stone-50 to-white px-6 py-12 text-center">
          <h3 className="text-lg font-semibold text-gray-900">Sign in to see My Barbers</h3>
          <p className="mt-2 text-sm text-gray-600 max-w-sm mx-auto">
            Or go to &apos;Discover&apos; to find your Operator
          </p>
          <button
            type="button"
            onClick={onGoDiscover}
            className="mt-6 px-5 py-2.5 rounded-xl bg-brand-500 hover:bg-brand-600 text-white font-semibold transition-colors"
          >
            Go to Discover
          </button>
        </div>
      )}

      {!loading && isAuthenticated && entries.length === 0 && (
        <div className="rounded-2xl border border-stone-200 bg-gradient-to-b from-stone-50 to-white px-6 py-12 text-center">
          <MapPin className="w-10 h-10 text-gray-400 mx-auto mb-3" />
          <h3 className="text-lg font-semibold text-gray-900">No barbers yet</h3>
          <p className="mt-2 text-sm text-gray-600 max-w-sm mx-auto">
            Book once and they&apos;ll land here as a regular. Find someone new on Discover.
          </p>
          <button
            type="button"
            onClick={onGoDiscover}
            className="mt-6 px-5 py-2.5 rounded-xl bg-brand-500 hover:bg-brand-600 text-white font-semibold transition-colors"
          >
            Discover barbers
          </button>
        </div>
      )}

      {!loading &&
        groups.map(({ location, items }) => (
          <section key={location} className="mb-8 sm:mb-10">
            <h2 className="text-base sm:text-lg font-semibold text-gray-900 mb-3 flex items-center gap-2">
              <MapPin className="w-4 h-4 text-brand-600 shrink-0" />
              {location}
            </h2>
            <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-3 sm:gap-4">
              {items.map((barber) => {
                const entry = entries.find((e) => e.barber.id === barber.id);
                return (
                  <BarberPhotoTile
                    key={barber.id}
                    barber={barber}
                    isMain={entry?.isMain}
                    onClick={() => onSelectBarber(barber)}
                  />
                );
              })}
            </div>
          </section>
        ))}

      {!loading && unlocated.length > 0 && (
        <section className="mb-8 sm:mb-10">
          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-3 sm:gap-4">
            {unlocated.map((entry) => (
              <BarberPhotoTile
                key={entry.barber.id}
                barber={entry.barber}
                isMain={entry.isMain}
                onClick={() => onSelectBarber(entry.barber)}
              />
            ))}
          </div>
        </section>
      )}
    </div>
  );
}
