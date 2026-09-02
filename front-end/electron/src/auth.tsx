import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from "react";
import {
  api,
  clearSession,
  getStoredHotel,
  getStoredToken,
  saveSession,
  type AuthHotel,
} from "./api";

type AuthContextValue = {
  hotel: AuthHotel | null;
  loading: boolean;
  login: (phone: string, password: string) => Promise<void>;
  register: (input: {
    name: string;
    ownerName: string;
    phone: string;
    password: string;
  }) => Promise<void>;
  updateHotel: (input: {
    name?: string;
    ownerName?: string;
    phone?: string;
    password?: string;
    currentPassword?: string;
  }) => Promise<void>;
  logout: () => void;
};

const AuthContext = createContext<AuthContextValue | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [hotel, setHotel] = useState<AuthHotel | null>(getStoredHotel);
  const [loading, setLoading] = useState(Boolean(getStoredToken()));

  useEffect(() => {
    const token = getStoredToken();
    if (!token) {
      setLoading(false);
      return;
    }

    api.auth
      .me()
      .then(({ hotel: current }) => {
        setHotel(current);
        saveSession({ token, hotel: current });
      })
      .catch(() => {
        clearSession();
        setHotel(null);
      })
      .finally(() => setLoading(false));
  }, []);

  useEffect(() => {
    function onUnauthorized() {
      setHotel(null);
    }
    window.addEventListener("hospeda:unauthorized", onUnauthorized);
    return () =>
      window.removeEventListener("hospeda:unauthorized", onUnauthorized);
  }, []);

  const login = useCallback(async (phone: string, password: string) => {
    const session = await api.auth.login({ phone, password });
    saveSession(session);
    setHotel(session.hotel);
  }, []);

  const register = useCallback(
    async (input: {
      name: string;
      ownerName: string;
      phone: string;
      password: string;
    }) => {
      const session = await api.auth.register(input);
      saveSession(session);
      setHotel(session.hotel);
    },
    [],
  );

  const logout = useCallback(() => {
    clearSession();
    setHotel(null);
  }, []);

  const updateHotel = useCallback(
    async (input: {
      name?: string;
      ownerName?: string;
      phone?: string;
      password?: string;
      currentPassword?: string;
    }) => {
      const { hotel: updated } = await api.auth.update(input);
      const token = getStoredToken();
      if (token) saveSession({ token, hotel: updated });
      setHotel(updated);
    },
    [],
  );

  const value = useMemo(
    () => ({ hotel, loading, login, register, updateHotel, logout }),
    [hotel, loading, login, register, updateHotel, logout],
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (!context) throw new Error("useAuth must be used within AuthProvider");
  return context;
}
