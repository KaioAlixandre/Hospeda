import { Save } from "lucide-react";
import { useEffect, useState, type FormEvent } from "react";
import { useAuth } from "../auth";
import { Button, Feedback, Field, Panel } from "../components/ui";

export function SettingsPage() {
  const { hotel, updateHotel } = useAuth();
  const [name, setName] = useState(hotel?.name ?? "");
  const [ownerName, setOwnerName] = useState(hotel?.ownerName ?? "");
  const [phone, setPhone] = useState(hotel?.phone ?? "");
  const [currentPassword, setCurrentPassword] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (!hotel) return;
    setName(hotel.name);
    setOwnerName(hotel.ownerName);
    setPhone(hotel.phone);
  }, [hotel]);

  async function submit(event: FormEvent) {
    event.preventDefault();
    setError(null);
    setMessage(null);

    if (password && password !== confirmPassword) {
      setError("A confirmação da nova senha não confere.");
      return;
    }

    if (password && !currentPassword) {
      setError("Informe a senha atual para alterá-la.");
      return;
    }

    setBusy(true);
    try {
      await updateHotel({
        name: name.trim(),
        ownerName: ownerName.trim(),
        phone,
        ...(password
          ? { password, currentPassword }
          : {}),
      });
      setPassword("");
      setConfirmPassword("");
      setCurrentPassword("");
      setMessage("Dados do hotel atualizados.");
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setBusy(false);
    }
  }

  return (
    <section className="page">
      <header className="page-header">
        <div>
          <p className="eyebrow">Conta</p>
          <h1>Configurações</h1>
        </div>
      </header>

      <Feedback error={error} message={message} />

      <Panel title="Dados do hotel">
        <form className="form-grid settings-form" onSubmit={submit}>
          <Field label="Nome do hotel">
            <input
              value={name}
              onChange={(e) => setName(e.target.value)}
              required
              minLength={2}
            />
          </Field>
          <Field label="Nome do proprietário">
            <input
              value={ownerName}
              onChange={(e) => setOwnerName(e.target.value)}
              required
              minLength={2}
            />
          </Field>
          <Field label="Número (WhatsApp)">
            <input
              value={phone}
              onChange={(e) => setPhone(e.target.value)}
              inputMode="tel"
              required
            />
          </Field>

          <div className="settings-section-title">
            <h3>Alterar senha</h3>
            <p className="muted">Opcional — deixe em branco para manter a atual.</p>
          </div>

          <Field label="Senha atual">
            <input
              type="password"
              value={currentPassword}
              onChange={(e) => setCurrentPassword(e.target.value)}
              autoComplete="current-password"
            />
          </Field>
          <Field label="Nova senha">
            <input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              minLength={6}
              autoComplete="new-password"
            />
          </Field>
          <Field label="Confirmar nova senha">
            <input
              type="password"
              value={confirmPassword}
              onChange={(e) => setConfirmPassword(e.target.value)}
              minLength={6}
              autoComplete="new-password"
            />
          </Field>

          <div className="settings-actions">
            <Button
              variant="primary"
              type="submit"
              loading={busy}
              icon={<Save size={16} />}
            >
              Salvar alterações
            </Button>
          </div>
        </form>
      </Panel>
    </section>
  );
}
