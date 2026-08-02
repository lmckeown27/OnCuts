/**
 * Three-face satisfaction rating (maps to 1 / 3 / 5 for the review API).
 */

import { SadFaceIcon, NeutralFaceIcon, SmileyFaceIcon } from '@assets';

export type SatisfactionValue = 1 | 3 | 5;

const OPTIONS: Array<{
  value: SatisfactionValue;
  label: string;
  src: string;
  alt: string;
}> = [
  { value: 1, label: 'Dissatisfied', src: SadFaceIcon, alt: 'Dissatisfied' },
  { value: 3, label: 'Neutral', src: NeutralFaceIcon, alt: 'Neutral' },
  { value: 5, label: 'Satisfied', src: SmileyFaceIcon, alt: 'Satisfied' },
];

interface SatisfactionRatingProps {
  value: number;
  onChange: (value: SatisfactionValue) => void;
  disabled?: boolean;
}

export default function SatisfactionRating({
  value,
  onChange,
  disabled = false,
}: SatisfactionRatingProps) {
  return (
    <div className="flex justify-center gap-4 sm:gap-6" role="radiogroup" aria-label="Satisfaction rating">
      {OPTIONS.map((option) => {
        const selected = value === option.value;
        return (
          <button
            key={option.value}
            type="button"
            role="radio"
            aria-checked={selected}
            aria-label={option.label}
            disabled={disabled}
            onClick={() => onChange(option.value)}
            className={`flex flex-col items-center gap-2 transition-transform disabled:opacity-50 ${
              selected ? 'scale-110' : 'opacity-55 hover:opacity-90 hover:scale-105'
            }`}
          >
            <span
              className={`rounded-full p-0.5 ${
                selected ? 'ring-2 ring-offset-2 ring-gray-900' : ''
              }`}
            >
              <img
                src={option.src}
                alt=""
                className="w-14 h-14 sm:w-16 sm:h-16 rounded-full object-cover"
                draggable={false}
              />
            </span>
            <span
              className={`text-xs font-medium ${
                selected ? 'text-gray-900' : 'text-gray-500'
              }`}
            >
              {option.label}
            </span>
          </button>
        );
      })}
    </div>
  );
}
