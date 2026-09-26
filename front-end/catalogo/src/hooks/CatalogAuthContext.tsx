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
  setCatalogAuthToken,
  type CatalogAuthConfig,
  type CatalogUser,
} from "../api";

type CatalogAuthState = {
  status: "loading" | "ready";
  user: CatalogUser | null;
  config: CatalogAuthConfig;
  login: (email: string, password: string) => Promise<void>;
  register: (input: {
    name: string;
    email: string;
    phone: string;
    password: string;
  }) => Promise<void>;
  loginWithGoogle: (credential: string) => Promise<void>;
  logout: () => void;
  refresh: () => Promise<void>;
  updateProfile: (input: { name?: string; phone?: string }) => Promise<void>;
};

const CatalogAuthContext = createContext<CatalogAuthState | null>(null);

export function CatalogAuthProvider({ children }: { children: ReactNode }) {
  const [status, setStatus] = useState<"loading" | "ready">("loading");
  const [user, setUser] = useState<CatalogUser | null>(null);
  const [config, setConfig] = useState<CatalogAuthConfig>({
    googleClientId: null,
    googleEnabled: false,
  });

  const refresh = useCallback(async () => {
    try {
      const me = await api.auth.me();
      setUser(me.user);
    } catch {
      setCatalogAuthToken(null);
      setUser(null);
    }
  }, []);

  useEffect(() => {
    let cancelled = false;
    void (async () => {
      try {
        const authConfig = await api.auth.config();
        if (!cancelled) setConfig(authConfig);
      } catch {
        if (!cancelled) {
          setConfig({ googleClientId: null, googleEnabled: false });
        }
      }

      const token = localStorage.getItem("staydesck_catalog_token");
      if (token) {
        setCatalogAuthToken(token);
        try {
          const me = await api.auth.me();
          if (!cancelled) setUser(me.user);
        } catch {
          setCatalogAuthToken(null);
          if (!cancelled) setUser(null);
        }
      }

      if (!cancelled) setStatus("ready");
    })();

    return () => {
      cancelled = true;
    };
  }, []);

  const applySession = useCallback(
    (session: { token: string; user: CatalogUser }) => {
      setCatalogAuthToken(session.token);
      setUser(session.user);
    },
    [],
  );

  const login = useCallback(
    async (email: string, password: string) => {
      const session = await api.auth.login({ email, password });
      applySession(session);
    },
    [applySession],
  );

  const register = useCallback(
    async (input: {
      name: string;
      email: string;
      phone: string;
      password: string;
    }) => {
      const session = await api.auth.register(input);
      applySession(session);
    },
    [applySession],
  );

  const loginWithGoogle = useCallback(
    async (credential: string) => {
      const session = await api.auth.google({ credential });
      applySession(session);
    },
    [applySession],
  );

  const logout = useCallback(() => {
    setCatalogAuthToken(null);
    setUser(null);
  }, []);

  const updateProfile = useCallback(
    async (input: { name?: string; phone?: string }) => {
      const { user: updated } = await api.auth.updateMe(input);
      setUser(updated);
    },
    [],
  );

  const value = useMemo(
    () => ({
      status,
      user,
      config,
      login,
      register,
      loginWithGoogle,
      logout,
      refresh,
      updateProfile,
    }),
    [
      status,
      user,
      config,
      login,
      register,
      loginWithGoogle,
      logout,
      refresh,
      updateProfile,
    ],
  );

  return (
    <CatalogAuthContext.Provider value={value}>
      {children}
    </CatalogAuthContext.Provider>
  );
}

export function useCatalogAuth() {
  const ctx = useContext(CatalogAuthContext);
  if (!ctx) {
    throw new Error("useCatalogAuth must be used within CatalogAuthProvider");
  }
  return ctx;
}
