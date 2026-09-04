export type ConsumerHomeSegment = 'my_barbers' | 'discover';

interface ConsumerHomeSegmentPillProps {
  value: ConsumerHomeSegment;
  onChange: (value: ConsumerHomeSegment) => void;
  className?: string;
}

const SEGMENTS: { id: ConsumerHomeSegment; label: string }[] = [
  { id: 'my_barbers', label: 'My Barbers' },
  { id: 'discover', label: 'Discover' },
];

export default function ConsumerHomeSegmentPill({
  value,
  onChange,
  className = '',
}: ConsumerHomeSegmentPillProps) {
  return (
    <div
      className={`inline-flex p-0.5 sm:p-1 rounded-full bg-stone-200/90 border border-stone-300/80 ${className}`}
      role="tablist"
      aria-label="Home sections"
    >
      {SEGMENTS.map((seg) => {
        const selected = value === seg.id;
        return (
          <button
            key={seg.id}
            type="button"
            role="tab"
            aria-selected={selected}
            onClick={() => onChange(seg.id)}
            className={`px-3 sm:px-5 py-1 sm:py-1.5 text-xs sm:text-sm font-semibold rounded-full transition-colors whitespace-nowrap ${
              selected
                ? 'bg-white text-gray-900 shadow-sm'
                : 'text-gray-600 hover:text-gray-900'
            }`}
          >
            {seg.label}
          </button>
        );
      })}
    </div>
  );
}
