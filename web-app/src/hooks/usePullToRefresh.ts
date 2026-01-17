/**
 * usePullToRefresh Hook
 * 
 * Implements native-style pull-to-refresh functionality for mobile devices.
 * Detects when user swipes down from the top of the page and triggers a refresh.
 */

import { useState, useEffect, useCallback, useRef } from 'react';

interface UsePullToRefreshOptions {
  onRefresh: () => Promise<void> | void;
  threshold?: number; // Distance in pixels to trigger refresh (default: 70)
  resistance?: number; // How much to resist the pull (default: 2.5)
  maxPull?: number; // Maximum pull distance (default: 120)
}

interface UsePullToRefreshReturn {
  isPulling: boolean;
  isRefreshing: boolean;
  pullDistance: number;
  pullProgress: number; // 0 to 1, where 1 means threshold reached
  containerRef: React.RefObject<HTMLDivElement>;
  indicatorStyle: React.CSSProperties;
}

export function usePullToRefresh({
  onRefresh,
  threshold = 70,
  resistance = 2.5,
  maxPull = 120,
}: UsePullToRefreshOptions): UsePullToRefreshReturn {
  const [isPulling, setIsPulling] = useState(false);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [pullDistance, setPullDistance] = useState(0);
  
  const containerRef = useRef<HTMLDivElement>(null);
  const startY = useRef(0);
  const currentY = useRef(0);
  const canPull = useRef(false);
  const pullDistanceRef = useRef(0);
  const onRefreshRef = useRef(onRefresh);
  const isRefreshingRef = useRef(false);
  const touchMoveCount = useRef(0);
  const maxRawMovement = useRef(0);
  
  // Minimum requirements for a valid pull gesture
  const MIN_TOUCH_MOVES = 3; // Must have at least 3 touchmove events
  const MIN_RAW_MOVEMENT = 50; // Must have at least 50px of raw movement (before resistance)
  
  // Keep refs in sync with state/props
  useEffect(() => {
    onRefreshRef.current = onRefresh;
  }, [onRefresh]);
  
  useEffect(() => {
    pullDistanceRef.current = pullDistance;
  }, [pullDistance]);
  
  useEffect(() => {
    isRefreshingRef.current = isRefreshing;
  }, [isRefreshing]);

  const handleTouchStart = useCallback((e: TouchEvent) => {
    // Reset gesture tracking
    touchMoveCount.current = 0;
    maxRawMovement.current = 0;
    
    // Only activate if at the very top of the page (or nearly so)
    if (window.scrollY > 5) {
      canPull.current = false;
      return;
    }
    if (isRefreshingRef.current) {
      canPull.current = false;
      return;
    }
    
    // Don't activate pull-to-refresh if touch started on an interactive element
    // This prevents accidental triggers when tapping on buttons, cards, links, etc.
    const target = e.target as HTMLElement;
    if (target) {
      // Check if the target or any of its ancestors is an interactive element
      const interactiveElement = target.closest('button, a, [role="button"], [onclick], .cursor-pointer, .card, [data-clickable]');
      if (interactiveElement) {
        canPull.current = false;
        return;
      }
    }
    
    canPull.current = true;
    startY.current = e.touches[0].clientY;
    setIsPulling(true);
  }, []);

  const handleTouchMove = useCallback((e: TouchEvent) => {
    if (!canPull.current || isRefreshingRef.current) return;
    
    // Track touch move count for gesture validation
    touchMoveCount.current++;
    
    // If user scrolled down, cancel pull
    if (window.scrollY > 5) {
      canPull.current = false;
      setIsPulling(false);
      setPullDistance(0);
      pullDistanceRef.current = 0;
      return;
    }

    currentY.current = e.touches[0].clientY;
    const diff = currentY.current - startY.current;
    
    // Track maximum raw movement for gesture validation
    if (diff > maxRawMovement.current) {
      maxRawMovement.current = diff;
    }

    if (diff > 0) {
      // Apply resistance to make it feel natural (like rubber band)
      const resistedDiff = Math.min(diff / resistance, maxPull);
      setPullDistance(resistedDiff);
      pullDistanceRef.current = resistedDiff;
      
      // Prevent default scroll when pulling down
      if (resistedDiff > 5) {
        e.preventDefault();
      }
    } else {
      // User is scrolling up, reset
      setPullDistance(0);
      pullDistanceRef.current = 0;
    }
  }, [resistance, maxPull]);

  const handleTouchEnd = useCallback(async () => {
    if (!canPull.current) return;
    
    setIsPulling(false);
    canPull.current = false;

    // Use refs to get the latest values, avoiding stale closure issues
    const currentPullDistance = pullDistanceRef.current;
    const currentIsRefreshing = isRefreshingRef.current;
    const moves = touchMoveCount.current;
    const rawMovement = maxRawMovement.current;
    
    // Validate this was a legitimate pull gesture, not a tap or accidental touch
    const isValidGesture = moves >= MIN_TOUCH_MOVES && rawMovement >= MIN_RAW_MOVEMENT;

    if (currentPullDistance >= threshold && !currentIsRefreshing && isValidGesture) {
      setIsRefreshing(true);
      isRefreshingRef.current = true;
      // Keep spinner visible during refresh
      setPullDistance(threshold);
      
      try {
        await onRefreshRef.current();
      } catch (error) {
        console.error('Refresh failed:', error);
      } finally {
        // Small delay before hiding spinner for better UX
        await new Promise(resolve => setTimeout(resolve, 300));
        setIsRefreshing(false);
        isRefreshingRef.current = false;
        setPullDistance(0);
        pullDistanceRef.current = 0;
      }
    } else {
      // Snap back to top
      setPullDistance(0);
      pullDistanceRef.current = 0;
    }
  }, [threshold]);

  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;

    // Reset state when container mounts (prevents stale state issues)
    canPull.current = false;
    setPullDistance(0);
    pullDistanceRef.current = 0;
    setIsPulling(false);

    // Use passive: false for touchmove to allow preventDefault
    container.addEventListener('touchstart', handleTouchStart, { passive: true });
    container.addEventListener('touchmove', handleTouchMove, { passive: false });
    container.addEventListener('touchend', handleTouchEnd, { passive: true });
    container.addEventListener('touchcancel', handleTouchEnd, { passive: true });

    return () => {
      container.removeEventListener('touchstart', handleTouchStart);
      container.removeEventListener('touchmove', handleTouchMove);
      container.removeEventListener('touchend', handleTouchEnd);
      container.removeEventListener('touchcancel', handleTouchEnd);
      // Reset state when container unmounts
      canPull.current = false;
      setPullDistance(0);
      pullDistanceRef.current = 0;
    };
  }, [handleTouchStart, handleTouchMove, handleTouchEnd]);

  const pullProgress = Math.min(pullDistance / threshold, 1);

  const indicatorStyle: React.CSSProperties = {
    transform: `translateY(${pullDistance}px)`,
    transition: isPulling ? 'none' : 'transform 0.3s ease-out',
  };

  return {
    isPulling,
    isRefreshing,
    pullDistance,
    pullProgress,
    containerRef,
    indicatorStyle,
  };
}

export default usePullToRefresh;
