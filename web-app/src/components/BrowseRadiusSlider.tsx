import { useCallback, useRef, useState } from 'react';

interface BrowseRadiusSliderProps {
  min: number;
  max: number;
  value: number;
  onChange: (value: number) => void;
  onChangeCommitted?: (value: number) => void;
  className?: string;
  'aria-label'?: string;
}

function clampMiles(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, Math.round(value)));
}

export default function BrowseRadiusSlider({
  min,
  max,
  value,
  onChange,
  onChangeCommitted,
  className = '',
  'aria-label': ariaLabel = 'Search radius in miles',
}: BrowseRadiusSliderProps) {
  const trackRef = useRef<HTMLDivElement>(null);
  const isDraggingRef = useRef(false);
  const [isDragging, setIsDragging] = useState(false);
  const [dragValue, setDragValue] = useState(value);
  const displayValue = isDragging ? dragValue : value;
  const fillPercent = ((displayValue - min) / (max - min)) * 100;

  const valueFromClientX = useCallback(
    (clientX: number) => {
      const track = trackRef.current;
      if (!track) return value;
      const rect = track.getBoundingClientRect();
      if (rect.width <= 0) return value;
      const ratio = (clientX - rect.left) / rect.width;
      return clampMiles(min + ratio * (max - min), min, max);
    },
    [max, min, value]
  );

  const beginDrag = (clientX: number) => {
    const next = valueFromClientX(clientX);
    isDraggingRef.current = true;
    setIsDragging(true);
    setDragValue(next);
    onChange(next);
  };

  const moveDrag = (clientX: number) => {
    const next = valueFromClientX(clientX);
    setDragValue(next);
    onChange(next);
  };

  const endDrag = (clientX?: number) => {
    if (!isDraggingRef.current) return;
    const finalValue = clientX != null ? valueFromClientX(clientX) : dragValue;
    isDraggingRef.current = false;
    setIsDragging(false);
    setDragValue(finalValue);
    onChange(finalValue);
    onChangeCommitted?.(finalValue);
  };

  const handlePointerDown = (event: React.PointerEvent<HTMLDivElement>) => {
    event.preventDefault();
    event.stopPropagation();
    trackRef.current?.setPointerCapture(event.pointerId);
    beginDrag(event.clientX);
  };

  const handlePointerMove = (event: React.PointerEvent<HTMLDivElement>) => {
    if (!isDraggingRef.current) return;
    event.preventDefault();
    event.stopPropagation();
    moveDrag(event.clientX);
  };

  const handlePointerUp = (event: React.PointerEvent<HTMLDivElement>) => {
    if (!isDraggingRef.current) return;
    event.preventDefault();
    event.stopPropagation();
    trackRef.current?.releasePointerCapture(event.pointerId);
    endDrag(event.clientX);
  };

  const handlePointerCancel = (event: React.PointerEvent<HTMLDivElement>) => {
    if (!isDraggingRef.current) return;
    event.preventDefault();
    trackRef.current?.releasePointerCapture(event.pointerId);
    isDraggingRef.current = false;
    setIsDragging(false);
    setDragValue(value);
    onChange(value);
  };

  const handleKeyDown = (event: React.KeyboardEvent<HTMLDivElement>) => {
    let next = displayValue;
    if (event.key === 'ArrowRight' || event.key === 'ArrowUp') {
      next = clampMiles(displayValue + 1, min, max);
    } else if (event.key === 'ArrowLeft' || event.key === 'ArrowDown') {
      next = clampMiles(displayValue - 1, min, max);
    } else if (event.key === 'Home') {
      next = min;
    } else if (event.key === 'End') {
      next = max;
    } else {
      return;
    }

    event.preventDefault();
    onChange(next);
    onChangeCommitted?.(next);
    setDragValue(next);
  };

  return (
    <div className={className}>
      <div
        ref={trackRef}
        role="slider"
        tabIndex={0}
        aria-label={ariaLabel}
        aria-valuemin={min}
        aria-valuemax={max}
        aria-valuenow={displayValue}
        aria-valuetext={`${displayValue} miles`}
        onPointerDown={handlePointerDown}
        onPointerMove={handlePointerMove}
        onPointerUp={handlePointerUp}
        onPointerCancel={handlePointerCancel}
        onKeyDown={handleKeyDown}
        className={`relative h-10 select-none touch-none cursor-pointer ${isDragging ? 'cursor-grabbing' : 'cursor-grab'}`}
        style={{ touchAction: 'none' }}
      >
        <div className="absolute inset-x-0 top-1/2 -translate-y-1/2 h-2 rounded-full bg-gray-200" />
        <div
          className="absolute top-1/2 -translate-y-1/2 left-0 h-2 rounded-full bg-gray-900 pointer-events-none"
          style={{ width: `${fillPercent}%` }}
        />
        <div
          className={`absolute top-1/2 -translate-y-1/2 -translate-x-1/2 w-5 h-5 rounded-full border-2 border-white bg-gray-900 shadow-md pointer-events-none ${
            isDragging ? 'scale-110' : ''
          } transition-transform`}
          style={{ left: `${fillPercent}%` }}
        />
      </div>
    </div>
  );
}
