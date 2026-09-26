import { useEffect, useRef, useState, type FormEvent } from "react";
import { Link } from "react-router-dom";
import { useCatalogAuth } from "../hooks/CatalogAuthContext";
import { phoneMask } from "../lib/format";

declare global {
  interface Window {
    google?: {
      accounts: {
        id: {
          initialize: (config: {
            client_id: string;
            callback: (response: { credential: string }) => void;
            auto_select?: boolean;
            cancel_on_tap_outside?: boolean;
          }) => void;
          renderButton: (
            parent: HTMLElement,
            options: Record<string, unknown>,
          ) => void;
        };
      };
    };
  }
}

type Mode = "login" | "register";

function loadGoogleScript(): Promise<void> {
  if (window.google?.accounts?.id) return Promise.resolve();
  const existing = document.querySelector<HTMLScriptElement>(
    'script[data-google-gsi="1"]',
  );
  if (existing) {
    return new Promise((resolve, reject) => {
      existing.addEventListener("load", () => resolve());
      existing.addEventListener("error", () =>
        reject(new Error("Falha ao carregar Google")),
      );
    });
  }

  return new Promise((resolve, reject) => {
    const script = document.createElement("script");
    script.src = "https://accounts.google.com/gsi/client";
    script.async = true;
    script.defer = true;
    script.dataset.googleGsi = "1";
    script.onload = () => resolve();
    script.onerror = () => reject(new Error("Falha ao carregar Google"));
    document.head.appendChild(script);
  });
}

export function GuestAuthPanel() {
  const auth = useCatalogAuth();
  const [mode, setMode] = useState<Mode>("login");
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [phone, setPhone] = useState("");
  const [password, setPassword] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const googleBtnRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!auth.config.googleEnabled || !auth.config.googleClientId) return;
    if (auth.user) return;

    const clientId = auth.config.googleClientId;
    let cancelled = false;
    void loadGoogleScript()
      .then(() => {
        if (cancelled || !googleBtnRef.current || !window.google) return;
        window.google.accounts.id.initialize({
          client_id: clientId,
          callback: (response) => {
            setBusy(true);
            setError(null);
            void auth
              .loginWithGoogle(response.credential)
              .catch((err: Error) => setError(err.message))
              .finally(() => setBusy(false));
          },
          cancel_on_tap_outside: true,
        });
        googleBtnRef.current.innerHTML = "";
        window.google.accounts.id.renderButton(googleBtnRef.current, {
          theme: "outline",
          size: "large",
          width: Math.max(googleBtnRef.current.offsetWidth || 0, 280),
          text: "continue_with",
          shape: "rectangular",
          logo_alignment: "left",
        });
      })
      .catch(() => {
        if (!cancelled) {
          setError("Não foi possível carregar o login com Google.");
        }
      });

    return () => {
      cancelled = true;
    };
  }, [
    auth.config.googleClientId,
    auth.config.googleEnabled,
    auth.user,
    auth.loginWithGoogle,
  ]);

  async function onSubmit(event: FormEvent) {
    event.preventDefault();
    setBusy(true);
    setError(null);
    try {
      if (mode === "login") {
        await auth.login(email.trim(), password);
      } else {
        await auth.register({
          name: name.trim(),
          email: email.trim(),
          phone: phone.replace(/\D/g, ""),
          password,
        });
      }
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setBusy(false);
    }
  }

  if (auth.status === "loading") {
    return <p className="muted">Carregando conta…</p>;
  }

  if (auth.user) {
    return (
      <div className="guest-auth-session">
        <div className="guest-auth-user">
          {auth.user.avatarUrl ? (
            <img src={auth.user.avatarUrl} alt="" className="guest-auth-avatar" />
          ) : (
            <div className="guest-auth-avatar fallback" aria-hidden>
              {auth.user.name.slice(0, 1).toUpperCase()}
            </div>
          )}
          <div>
            <strong>{auth.user.name}</strong>
            <p className="muted">{auth.user.email}</p>
          </div>
        </div>
        <div className="guest-auth-session-actions">
          <Link className="btn btn-ghost" to="/conta">
            Minha conta
          </Link>
          <button type="button" className="btn btn-ghost" onClick={auth.logout}>
            Sair
          </button>
        </div>
      </div>
    );
  }

  return (
    <section className="guest-auth-panel">
      <header className="guest-auth-header">
        <h2>Entre para solicitar a reserva</h2>
        <p className="muted">
          Crie uma conta ou entre para confirmar o pedido ao hotel.
        </p>
      </header>

      {auth.config.googleEnabled ? (
        <div className="guest-auth-google">
          <div ref={googleBtnRef} className="guest-auth-google-btn" />
          <div className="guest-auth-divider">
            <span>ou</span>
          </div>
        </div>
      ) : null}

      <div className="guest-auth-tabs" role="tablist">
        <button
          type="button"
          role="tab"
          className={mode === "login" ? "active" : ""}
          aria-selected={mode === "login"}
          onClick={() => {
            setMode("login");
            setError(null);
          }}
        >
          Entrar
        </button>
        <button
          type="button"
          role="tab"
          className={mode === "register" ? "active" : ""}
          aria-selected={mode === "register"}
          onClick={() => {
            setMode("register");
            setError(null);
          }}
        >
          Cadastrar
        </button>
      </div>

      {error ? <p className="error-banner">{error}</p> : null}

      <form className="reserve-form guest-auth-form" onSubmit={(e) => void onSubmit(e)}>
        {mode === "register" ? (
          <>
            <label className="field">
              <span>Nome completo</span>
              <input
                value={name}
                onChange={(e) => setName(e.target.value)}
                required
                autoComplete="name"
              />
            </label>
            <label className="field">
              <span>WhatsApp</span>
              <input
                value={phone}
                onChange={(e) => setPhone(phoneMask(e.target.value))}
                inputMode="tel"
                placeholder="(11) 99999-9999"
                required
                autoComplete="tel"
              />
            </label>
          </>
        ) : null}

        <label className="field">
          <span>E-mail</span>
          <input
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            required
            autoComplete="email"
          />
        </label>
        <label className="field">
          <span>Senha</span>
          <input
            type="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            required
            minLength={mode === "register" ? 6 : 1}
            autoComplete={mode === "login" ? "current-password" : "new-password"}
          />
        </label>

        <button
          type="submit"
          className="btn btn-primary btn-block"
          disabled={busy}
        >
          {busy
            ? "Aguarde…"
            : mode === "login"
              ? "Entrar"
              : "Criar conta"}
        </button>
      </form>
    </section>
  );
}
