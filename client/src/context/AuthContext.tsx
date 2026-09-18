import { createContext, useContext, useEffect, useState, ReactNode } from "react";
import * as authApi from "../api/auth.js";
import { CurrentUser } from "../api/auth.js";

interface AuthContextValue {
  user: CurrentUser | null;
  loading: boolean;
  error: string | null;
  login: (email: string, password: string) => Promise<void>;
  logout: () => Promise<void>;
  refresh: () => Promise<void>;
  changePassword: (currentPassword: string, newPassword: string) => Promise<void>;
}

const AuthContext = createContext<AuthContextValue | undefined>(undefined);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<CurrentUser | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  async function refresh() {
    try {
      const current = await authApi.fetchCurrentUser();
      setUser(current);
      setError(null);
    } catch (err) {
      setError((err as Error).message);
      setUser(null);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    refresh();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function login(email: string, password: string) {
    const current = await authApi.login(email, password);
    setUser(current);
  }

  async function logout() {
    await authApi.logout();
    setUser(null);
  }

  async function changePassword(currentPassword: string, newPassword: string) {
    await authApi.changePassword(currentPassword, newPassword);
    // BR-08: session stays valid — just clear the local mustChangePassword flag.
    setUser((prev) => (prev ? { ...prev, mustChangePassword: false } : prev));
  }

  return (
    <AuthContext.Provider value={{ user, loading, error, login, logout, refresh, changePassword }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth must be used within an AuthProvider");
  return ctx;
}
