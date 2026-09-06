import { createContext, useContext, useState, ReactNode } from "react";

export interface Requester {
  id: number;
  name: string;
  email: string;
}

const STORAGE_KEY = "toktickit.selectedRequester";

interface RequesterContextValue {
  requester: Requester | null;
  selectRequester: (r: Requester) => void;
  clearRequester: () => void;
}

const RequesterContext = createContext<RequesterContextValue | undefined>(undefined);

function readStoredRequester(): Requester | null {
  const stored = localStorage.getItem(STORAGE_KEY);
  if (!stored) return null;
  try {
    return JSON.parse(stored);
  } catch {
    localStorage.removeItem(STORAGE_KEY);
    return null;
  }
}

export function RequesterProvider({ children }: { children: ReactNode }) {
  // BR-07: read synchronously on first render, not in useEffect, so
  // RequireRequester never sees a false "null" during the initial render.
  const [requester, setRequester] = useState<Requester | null>(readStoredRequester);

  function selectRequester(r: Requester) {
    setRequester(r);
    localStorage.setItem(STORAGE_KEY, JSON.stringify(r));
  }

  function clearRequester() {
    setRequester(null);
    localStorage.removeItem(STORAGE_KEY);
  }

  return (
    <RequesterContext.Provider value={{ requester, selectRequester, clearRequester }}>
      {children}
    </RequesterContext.Provider>
  );
}

export function useRequester() {
  const ctx = useContext(RequesterContext);
  if (!ctx) throw new Error("useRequester must be used within a RequesterProvider");
  return ctx;
}