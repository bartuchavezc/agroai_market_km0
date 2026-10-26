"use client";

// What this browser remembers for the buyer: the cart, their details for the next order, the orders they placed
// (code + token: the only way back to an order without an account) and the place distances are measured from.
// localStorage only: nothing here is shared, and the page works without it.

import { useSyncExternalStore } from "react";

import type { Buyer } from "./api";

/** Where the buyer's kitchen is: from their address, their device's location, or the pin moved on the map. */
export interface Place {
  lat: number;
  lng: number;
  label: string;
  /** The geocoded address, offered as the delivery address at checkout. */
  address?: string | null;
}

export interface SavedOrder {
  code: number;
  token: string;
  created_at: string;
  total: number;
  delivery_date: string;
}

interface State {
  /** listing id → kg */
  cart: Record<string, number>;
  recurring: boolean;
  buyer: Buyer | null;
  orders: SavedOrder[];
  place: Place | null;
}

const KEY = "redkm0";
const EMPTY: State = { cart: {}, recurring: true, buyer: null, orders: [], place: null };
let state: State = EMPTY;
let loaded = false;
const listeners = new Set<() => void>();

function load() {
  if (loaded || typeof window === "undefined") return;
  loaded = true;
  try {
    const raw = window.localStorage.getItem(KEY);
    if (raw) state = { ...EMPTY, ...JSON.parse(raw) };
  } catch {
    // private mode or blocked storage: start empty
  }
}

function set(patch: Partial<State> | ((s: State) => Partial<State>)) {
  load();
  state = { ...state, ...(typeof patch === "function" ? patch(state) : patch) };
  try {
    window.localStorage.setItem(KEY, JSON.stringify(state));
  } catch {
    // not persisted; the session still works
  }
  listeners.forEach((l) => l());
}

function subscribe(listener: () => void) {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

export function useStore<T>(select: (s: State) => T): T {
  return useSyncExternalStore(
    subscribe,
    () => {
      load();
      return select(state);
    },
    () => select(EMPTY),
  );
}

export const store = {
  setQty: (id: string, kg: number) =>
    set((s) => {
      const cart = { ...s.cart };
      if (kg > 0) cart[id] = kg;
      else delete cart[id];
      return { cart };
    }),
  clearCart: () => set({ cart: {} }),
  setRecurring: (recurring: boolean) => set({ recurring }),
  saveBuyer: (buyer: Buyer) => set({ buyer }),
  addOrder: (order: SavedOrder) => set((s) => ({ orders: [order, ...s.orders.filter((o) => o.code !== order.code)].slice(0, 30) })),
  setPlace: (place: Place | null) => set({ place }),
};
