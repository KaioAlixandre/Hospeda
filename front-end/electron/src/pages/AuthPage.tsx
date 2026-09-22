import { useEffect, useState, type FormEvent } from "react";
import { API_BASE_URL, isInsecureApiUrl } from "../config";
import { Button, Feedback, Field, Loading } from "../components/ui";
import { useAuth } from "../auth";

export function AuthPage() {
  const { login, register } = useAuth();
  const [mode, setMode] = useState<"login" | "register">("login");
  const [name, setName] = useState("");
  const [ownerName, setOwnerName] = useState("");
  const [phone, setPhone] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const canEditApi = Boolean(window.hospeda?.apiConfig?.save);
  const [apiUrl, setApiUrl] = useState(API_BASE_URL);
  const [apiEditable, setApiEditable] = useState(canEditApi);
  const [apiBusy, setApiBusy] = useState(false);
  const [apiMessage, setApiMessage] = useState<string | null>(null);
  const [showApiConfig, setShowApiConfig] = useState(false);

  useEffect(() => {
    if (!window.hospeda?.apiConfig?.get) return;
    void window.hospeda.apiConfig.get().then((cfg) => {
      setApiUrl(cfg.apiBaseUrl);
      setApiEditable(cfg.editable);
    });
  }, []);

  async function submit(event: FormEvent) {
    event.preventDefault();
    setBusy(true);
    setError(null);
    try {
      if (mode === "login") {
        await login(phone, password);
      } else {
        await register({ name, ownerName, phone, password });
      }
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setBusy(false);
    }
  }

  async function saveApiUrl(event: FormEvent) {
    event.preventDefault();
    if (!window.hospeda?.apiConfig?.save || !apiEditable) return;
    setApiBusy(true);
    setApiMessage(null);
    setError(null);
    try {
      await window.hospeda.apiConfig.save(apiUrl);
      setApiMessage("Endereço salvo neste computador. Recarregando…");
      window.setTimeout(() => window.location.reload(), 900);
    } catch (err) {
      setError((err as Error).message);
      setApiBusy(false);
    }
  }

  return (
    <div className="auth-screen">
      <div className="auth-backdrop" aria-hidden />
      <div className="auth-card">
        <div className="auth-brand">
          <span className="brand-mark">H</span>
          <div>
            <strong>Hospeda</strong>
            <p>Gestão de hospedagem</p>
          </div>
        </div>

        <div className="auth-tabs" role="tablist" aria-label="Modo de acesso">
          <button
            type="button"
            role="tab"
            aria-selected={mode === "login"}
            className={mode === "login" ? "active" : undefined}
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
            aria-selected={mode === "register"}
            className={mode === "register" ? "active" : undefined}
            onClick={() => {
              setMode("register");
              setError(null);
            }}
          >
            Cadastrar
          </button>
        </div>

        <h1>{mode === "login" ? "Bem-vindo de volta" : "Cadastrar hotel"}</h1>
        <p className="muted">
          {mode === "login"
            ? "Acesse com o número e a senha do hotel."
            : "Crie a conta do seu estabelecimento para começar."}
        </p>

        <Feedback error={error} message={apiMessage} />

        <form className="auth-form" onSubmit={submit}>
          {mode === "register" ? (
            <>
              <Field label="Nome do hotel">
                <input
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  placeholder="Ex.: Pousada Sol"
                  required
                />
              </Field>
              <Field label="Nome do proprietário">
                <input
                  value={ownerName}
                  onChange={(e) => setOwnerName(e.target.value)}
                  placeholder="Seu nome"
                  required
                />
              </Field>
            </>
          ) : null}

          <Field label="Número (WhatsApp)">
            <input
              value={phone}
              onChange={(e) => setPhone(e.target.value)}
              placeholder="11999999999"
              inputMode="tel"
              required
            />
          </Field>
          <Field label="Senha">
            <input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder={mode === "register" ? "Mínimo 6 caracteres" : ""}
              minLength={mode === "register" ? 6 : 1}
              required
            />
          </Field>

          <Button variant="primary" loading={busy} type="submit">
            {mode === "login" ? "Entrar" : "Criar conta"}
          </Button>
        </form>

        {canEditApi ? (
          <div className="auth-api-config">
            <button
              type="button"
              className="auth-api-toggle"
              onClick={() => setShowApiConfig((v) => !v)}
            >
              {showApiConfig ? "Ocultar servidor" : "Alterar servidor…"}
            </button>

            {showApiConfig ? (
              <form className="auth-api-form" onSubmit={(e) => void saveApiUrl(e)}>
                <p className="muted">
                  Em uso: {API_BASE_URL}. Só precisa mudar se o servidor
                  mudar — o valor fica salvo neste PC.
                </p>
                {isInsecureApiUrl(apiUrl) ? (
                  <p className="muted">
                    Aviso: HTTP fora de localhost — preferível usar HTTPS.
                  </p>
                ) : null}
                <Field label="URL da API">
                  <input
                    type="url"
                    value={apiUrl}
                    onChange={(e) => setApiUrl(e.target.value)}
                    placeholder="https://api.seudominio.com.br"
                    required
                    disabled={!apiEditable || apiBusy}
                  />
                </Field>
                {!apiEditable ? (
                  <p className="muted">
                    Definido por HOSPEDA_API_URL — não editável aqui.
                  </p>
                ) : (
                  <Button type="submit" loading={apiBusy}>
                    Salvar neste computador
                  </Button>
                )}
              </form>
            ) : null}
          </div>
        ) : null}
      </div>
    </div>
  );
}

export function AuthLoading() {
  return (
    <div className="auth-screen">
      <div className="auth-backdrop" aria-hidden />
      <Loading label="Verificando sessão…" />
    </div>
  );
}
