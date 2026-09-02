import { useState, type FormEvent } from "react";
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

  return (
    <div className="auth-screen">
      <div className="auth-card">
        <div className="auth-brand">
          <span className="brand-mark">H</span>
          <div>
            <strong>Hospeda</strong>
            <p>Gestão de hospedagem</p>
          </div>
        </div>

        <h1>{mode === "login" ? "Entrar" : "Cadastrar hotel"}</h1>
        <p className="muted">
          {mode === "login"
            ? "Acesse com o número e a senha do hotel."
            : "Crie a conta do seu estabelecimento para começar."}
        </p>

        <Feedback error={error} />

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

        <button
          type="button"
          className="auth-switch"
          onClick={() => {
            setMode(mode === "login" ? "register" : "login");
            setError(null);
          }}
        >
          {mode === "login"
            ? "Não tem conta? Cadastre o hotel"
            : "Já tem conta? Fazer login"}
        </button>
      </div>
    </div>
  );
}

export function AuthLoading() {
  return (
    <div className="auth-screen">
      <Loading label="Verificando sessão…" />
    </div>
  );
}
