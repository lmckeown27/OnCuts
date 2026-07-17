/**
 * Client-only "Pay Later" deferral for post-service payment takeovers.
 * Does not call the API — booking stays COMPLETED until card/cash succeeds.
 * Cleared on intentional reopen, undo-complete, logout, or socket disconnect.
 */
import { useEffect, useState } from 'react';

const deferredIds = new Set<string>();
const listeners = new Set<() => void>();

function notify() {
  listeners.forEach((listener) => listener());
}

export function deferPaymentTakeover(bookingId: string): void {
  if (!bookingId || deferredIds.has(bookingId)) return;
  deferredIds.add(bookingId);
  notify();
}

export function clearDeferredPaymentTakeover(bookingId: string): void {
  if (!bookingId || !deferredIds.has(bookingId)) return;
  deferredIds.delete(bookingId);
  notify();
}

export function clearAllDeferredPaymentTakeovers(): void {
  if (deferredIds.size === 0) return;
  deferredIds.clear();
  notify();
}

export function isPaymentTakeoverDeferred(bookingId: string): boolean {
  return Boolean(bookingId) && deferredIds.has(bookingId);
}

export function getDeferredPaymentBookingIds(): string[] {
  return Array.from(deferredIds);
}

export function subscribeDeferredPaymentBookings(listener: () => void): () => void {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}

export function useDeferredPaymentBookings() {
  const [, setTick] = useState(0);
  useEffect(() => subscribeDeferredPaymentBookings(() => setTick((t) => t + 1)), []);

  return {
    deferredIds: getDeferredPaymentBookingIds(),
    isDeferred: isPaymentTakeoverDeferred,
    defer: deferPaymentTakeover,
    clearDeferred: clearDeferredPaymentTakeover,
    clearAll: clearAllDeferredPaymentTakeovers,
  };
}
