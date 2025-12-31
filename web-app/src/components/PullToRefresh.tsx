/**
 * PullToRefresh Component
 * 
 * Wraps content and provides pull-to-refresh functionality for mobile devices.
 * Shows a loading indicator when pulling down from the top of the page.
 */

import { ReactNode } from 'react';
import { RefreshCw } from 'lucide-react';
import usePullToRefresh from '../hooks/usePullToRefresh';

interface PullToRefreshProps {
  children: ReactNode;
  onRefresh: () => Promise<void> | void;
  className?: string;
  disabled?: boolean;
}

export default function PullToRefresh({
  children,
  onRefresh,
  className = '',
  disabled = false,
}: PullToRefreshProps) {
  const {
    isPulling,
    isRefreshing,
    pullDistance,
    pullProgress,
    containerRef,
  } = usePullToRefresh({
    onRefresh: disabled ? async () => {} : onRefresh,
  });

  // Only show on touch devices
  const isTouchDevice = 'ontouchstart' in window || navigator.maxTouchPoints > 0;

  if (!isTouchDevice || disabled) {
    return <div className={className}>{children}</div>;
  }

  return (
    <div ref={containerRef} className={`relative ${className}`}>
      {/* Pull Indicator */}
      <div
        className="absolute left-0 right-0 flex justify-center pointer-events-none z-50"
        style={{
          top: -60,
          transform: `translateY(${pullDistance}px)`,
          opacity: pullProgress,
          transition: isPulling ? 'none' : 'transform 0.3s ease-out, opacity 0.3s ease-out',
        }}
      >
        <div
          className={`
            w-10 h-10 rounded-full bg-white shadow-lg 
            flex items-center justify-center
            border border-gray-200
          `}
        >
          <RefreshCw
            className={`w-5 h-5 text-primary-500 transition-transform ${
              isRefreshing ? 'animate-spin' : ''
            }`}
            style={{
              transform: isRefreshing ? 'none' : `rotate(${pullProgress * 180}deg)`,
            }}
          />
        </div>
      </div>

      {/* Content with pull transform */}
      <div
        style={{
          transform: `translateY(${pullDistance > 0 ? Math.min(pullDistance, 60) : 0}px)`,
          transition: isPulling ? 'none' : 'transform 0.3s ease-out',
        }}
      >
        {children}
      </div>

      {/* Refreshing overlay */}
      {isRefreshing && (
        <div className="fixed top-0 left-0 right-0 z-50 flex justify-center pt-4 pointer-events-none">
          <div className="px-4 py-2 bg-primary-500 text-white text-sm font-medium rounded-full shadow-lg flex items-center gap-2">
            <RefreshCw className="w-4 h-4 animate-spin" />
            Refreshing...
          </div>
        </div>
      )}
    </div>
  );
}

