import { create } from "zustand";

/** The search text, shared by the floating card's search box and the search view. */
export const useSearch = create<{ q: string; pending: boolean }>(() => ({ q: "", pending: false }));
