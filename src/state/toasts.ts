import { create } from "zustand";

export interface Toast {
  id: number;
  text: string;
  action?: { label: string; run: () => void };
  tone?: "default" | "error";
}

interface ToastState {
  toasts: Toast[];
  show: (t: Omit<Toast, "id">, ms?: number) => void;
  dismiss: (id: number) => void;
}

let n = 0;
const timers = new Map<number, ReturnType<typeof setTimeout>>();

export const useToasts = create<ToastState>((set, get) => ({
  toasts: [],
  show: (t, ms) => {
    const id = ++n;
    set({ toasts: [...get().toasts.slice(-2), { ...t, id }] });
    const life = ms ?? (t.action ? 10000 : 4000);
    timers.set(id, setTimeout(() => get().dismiss(id), life));
  },
  dismiss: (id) => {
    clearTimeout(timers.get(id));
    timers.delete(id);
    set({ toasts: get().toasts.filter((t) => t.id !== id) });
  },
}));

/** Pause/resume a toast's timer (on hover or focus). */
export function holdToast(id: number) {
  clearTimeout(timers.get(id));
}
export function releaseToast(id: number) {
  timers.set(id, setTimeout(() => useToasts.getState().dismiss(id), 4000));
}

export const toast = (t: Omit<Toast, "id">, ms?: number) => useToasts.getState().show(t, ms);
