import { Users as UsersIcon } from 'lucide-react';
import type { Barber } from '../types';
import {
  barberDisplayName,
  barberPhotoUrl,
  minBarberPrice,
  nextOpenFromWeeklySchedule,
} from '../utils/myBarbersDiscover';

interface BarberPhotoTileProps {
  barber: Barber;
  onClick: () => void;
  isMain?: boolean;
  showDistance?: boolean;
  distanceLabel?: string | null;
  className?: string;
}

export default function BarberPhotoTile({
  barber,
  onClick,
  isMain = false,
  showDistance = false,
  distanceLabel = null,
  className = '',
}: BarberPhotoTileProps) {
  const name = barberDisplayName(barber);
  const photo = barberPhotoUrl(barber);
  const price = minBarberPrice(barber);
  const nextOpen = nextOpenFromWeeklySchedule(barber.weekly_schedule);

  return (
    <button
      type="button"
      onClick={onClick}
      className={`group text-left w-full focus:outline-none focus-visible:ring-2 focus-visible:ring-brand-500 focus-visible:ring-offset-2 rounded-lg ${className}`}
    >
      <div className="relative w-full aspect-square overflow-hidden rounded-lg bg-gray-200">
        {photo ? (
          <img
            src={photo}
            alt={name}
            className="w-full h-full object-cover transition-transform duration-200 group-hover:scale-[1.03]"
            loading="lazy"
          />
        ) : (
          <div className="w-full h-full flex items-center justify-center">
            <UsersIcon className="w-10 h-10 text-gray-400" />
          </div>
        )}

        <div className="absolute top-0 left-0 right-0 bg-gradient-to-b from-black/70 to-transparent p-2.5 sm:p-3">
          <div className="flex items-start justify-between gap-2">
            <h3 className="text-sm sm:text-base font-bold text-white leading-tight line-clamp-2">
              {name}
            </h3>
            {isMain && (
              <span className="shrink-0 text-[10px] font-bold tracking-wide uppercase bg-brand-500 text-white px-1.5 py-0.5 rounded">
                Main
              </span>
            )}
          </div>
        </div>

        {price !== undefined && (
          <div className="absolute bottom-0 left-0 bg-gray-900/90 backdrop-blur-sm px-2.5 sm:px-3 py-1.5 rounded-tr-lg rounded-bl-lg">
            <span className="font-bold text-sm text-white">${price}</span>
          </div>
        )}
      </div>

      <div className="mt-2 px-0.5 space-y-0.5">
        {nextOpen ? (
          <p className="text-xs sm:text-sm text-gray-600 truncate">{nextOpen}</p>
        ) : (
          <p className="text-xs sm:text-sm text-gray-400 truncate">Hours not listed</p>
        )}
        {showDistance && distanceLabel && (
          <p className="text-xs text-gray-500 truncate">{distanceLabel}</p>
        )}
      </div>
    </button>
  );
}
