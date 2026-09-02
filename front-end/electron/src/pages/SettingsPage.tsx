import {
  CheckCircle2,
  QrCode,
  RefreshCw,
  Save,
  Smartphone,
  Trash2,
  Unplug,
} from "lucide-react";
import { useCallback, useEffect, useRef, useState, type FormEvent } from "react";
import { api, type WhatsAppStatus } from "../api";
import { useAuth } from "../auth";
import { Button, Feedback, Field, Loading, Panel } from "../components/ui";

export function SettingsPage() {
  const { hotel, updateHotel } = useAuth();
  const [name, setName] = useState(hotel?.name ?? "");
  const [ownerName, setOwnerName] = useState(hotel?.ownerName ?? "");
  const [phone, setPhone] = useState(hotel?.phone ?? "");
  const [street, setStreet] = useState(hotel?.address?.street ?? "");
  const [number, setNumber] = useState(hotel?.address?.number ?? "");
  const [complement, setComplement] = useState(hotel?.address?.complement ?? "");
  const [neighborhood, setNeighborhood] = useState(
    hotel?.address?.neighborhood ?? "",
  );
  const [city, setCity] = useState(hotel?.address?.city ?? "");
  const [state, setState] = useState(hotel?.address?.state ?? "");
  const [zipCode, setZipCode] = useState(hotel?.address?.zipCode ?? "");
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
    setStreet(hotel.address?.street ?? "");
    setNumber(hotel.address?.number ?? "");
    setComplement(hotel.address?.complement ?? "");
    setNeighborhood(hotel.address?.neighborhood ?? "");
    setCity(hotel.address?.city ?? "");
    setState(hotel.address?.state ?? "");
    setZipCode(hotel.address?.zipCode ?? "");
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
        street,
        number,
        complement,
        neighborhood,
        city,
        state,
        zipCode,
        ...(password ? { password, currentPassword } : {}),
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

      <Panel title="WhatsApp">
        <WhatsAppSettings />
      </Panel>

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
            <h3>Endereço</h3>
            <p className="muted">
              Usado na mensagem de confirmação enviada ao hóspede.
            </p>
          </div>

          <Field label="Rua / avenida">
            <input
              value={street}
              onChange={(e) => setStreet(e.target.value)}
              placeholder="Ex.: Rua das Flores"
            />
          </Field>
          <Field label="Número">
            <input
              value={number}
              onChange={(e) => setNumber(e.target.value)}
              placeholder="123"
            />
          </Field>
          <Field label="Complemento" hint="Opcional">
            <input
              value={complement}
              onChange={(e) => setComplement(e.target.value)}
              placeholder="Bloco A"
            />
          </Field>
          <Field label="Bairro">
            <input
              value={neighborhood}
              onChange={(e) => setNeighborhood(e.target.value)}
            />
          </Field>
          <Field label="Cidade">
            <input value={city} onChange={(e) => setCity(e.target.value)} />
          </Field>
          <Field label="UF">
            <input
              value={state}
              onChange={(e) => setState(e.target.value.toUpperCase())}
              maxLength={2}
              placeholder="SP"
            />
          </Field>
          <Field label="CEP">
            <input
              value={zipCode}
              onChange={(e) => setZipCode(e.target.value)}
              inputMode="numeric"
              placeholder="00000-000"
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

function WhatsAppSettings() {
  const [status, setStatus] = useState<WhatsAppStatus | null>(null);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [polling, setPolling] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const pollRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const stopPolling = useCallback(() => {
    if (pollRef.current) {
      clearInterval(pollRef.current);
      pollRef.current = null;
    }
    setPolling(false);
  }, []);

  const applyStatus = useCallback(
    (data: WhatsAppStatus) => {
      setStatus(data);
      if (data.connected) stopPolling();
    },
    [stopPolling],
  );

  const loadStatus = useCallback(async () => {
    try {
      const data = await api.whatsapp.status();
      applyStatus(data);
      setError(null);
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setLoading(false);
    }
  }, [applyStatus]);

  const startPolling = useCallback(() => {
    stopPolling();
    setPolling(true);
    pollRef.current = setInterval(async () => {
      try {
        const data = await api.whatsapp.pollQr();
        applyStatus(data);
        if (data.connected) {
          setMessage("WhatsApp conectado com sucesso!");
          stopPolling();
        }
      } catch {
        // silencioso durante o poll
      }
    }, 2500);
  }, [applyStatus, stopPolling]);

  useEffect(() => {
    void loadStatus();
    return () => stopPolling();
  }, [loadStatus, stopPolling]);

  async function handleSetup() {
    setBusy(true);
    setError(null);
    setMessage(null);
    try {
      const data = await api.whatsapp.setup();
      applyStatus(data);
      if (data.connected) {
        setMessage(data.message || "WhatsApp já está conectado.");
      } else {
        setMessage(data.message || "Escaneie o QR Code com o WhatsApp.");
        startPolling();
      }
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setBusy(false);
    }
  }

  async function handleRefreshQr() {
    setBusy(true);
    setError(null);
    setMessage(null);
    try {
      const data = await api.whatsapp.refreshQr();
      applyStatus(data);
      if (data.connected) {
        setMessage("WhatsApp já está conectado.");
      } else {
        setMessage("Novo QR Code gerado. Escaneie com o celular.");
        startPolling();
      }
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setBusy(false);
    }
  }

  async function handleDisconnect() {
    if (!window.confirm("Desconectar o WhatsApp deste hotel?")) return;
    setBusy(true);
    setError(null);
    setMessage(null);
    try {
      stopPolling();
      const data = await api.whatsapp.disconnect();
      applyStatus({ ...data, connected: false, qrCode: null });
      await loadStatus();
      setMessage(data.message || "WhatsApp desconectado.");
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setBusy(false);
    }
  }

  async function handleDelete() {
    if (
      !window.confirm(
        "Remover a instância do WhatsApp? Será necessário criar novamente.",
      )
    ) {
      return;
    }
    setBusy(true);
    setError(null);
    setMessage(null);
    try {
      stopPolling();
      const data = await api.whatsapp.removeInstance();
      applyStatus({
        ...data,
        configured: false,
        instanceId: null,
        connected: false,
        qrCode: null,
        phoneNumber: null,
        status: "NONE",
      });
      setMessage(data.message || "Instância removida.");
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setBusy(false);
    }
  }

  if (loading) return <Loading />;

  const connected = Boolean(status?.connected);
  const configured = Boolean(status?.configured);
  const statusLabel = connected
    ? "Conectado"
    : status?.status === "CONNECTING" || status?.qrCode
      ? "Aguardando leitura do QR"
      : configured
        ? "Desconectado"
        : "Não configurado";

  return (
    <div className="whatsapp-settings">
      <Feedback error={error} message={message} />
      <p className="muted">
        Crie e conecte uma instância na Send-API para envio automático de
        confirmações e avisos de limpeza.
      </p>

      <div
        className={`whatsapp-status ${connected ? "ok" : status?.qrCode ? "pending" : ""}`}
      >
        {connected ? <CheckCircle2 size={20} /> : <Smartphone size={20} />}
        <div>
          <strong>{statusLabel}</strong>
          {status?.phoneNumber ? (
            <p className="muted">Número: {status.phoneNumber}</p>
          ) : null}
          {status?.instanceId ? (
            <p className="mono muted">Instância: {status.instanceId}</p>
          ) : null}
          {polling && !connected ? (
            <p className="muted">Aguardando conexão...</p>
          ) : null}
        </div>
      </div>

      {status?.qrCode && !connected ? (
        <div className="whatsapp-qr">
          <div className="whatsapp-qr-title">
            <QrCode size={16} />
            Escaneie com o WhatsApp
          </div>
          <img src={status.qrCode} alt="QR Code WhatsApp" />
          <p className="muted">
            Abra o WhatsApp no celular → Aparelhos conectados → Conectar um
            aparelho e aponte para este QR Code.
          </p>
        </div>
      ) : null}

      <div className="whatsapp-actions">
        {!configured || (!connected && !status?.qrCode) ? (
          <Button
            variant="primary"
            loading={busy}
            icon={<QrCode size={16} />}
            onClick={() => void handleSetup()}
          >
            {configured ? "Conectar WhatsApp" : "Criar e conectar WhatsApp"}
          </Button>
        ) : null}

        {configured && !connected ? (
          <Button
            loading={busy}
            icon={<RefreshCw size={16} />}
            onClick={() => void handleRefreshQr()}
          >
            Atualizar QR
          </Button>
        ) : null}

        {connected ? (
          <Button
            loading={busy}
            icon={<Unplug size={16} />}
            onClick={() => void handleDisconnect()}
          >
            Desconectar
          </Button>
        ) : null}

        {configured ? (
          <Button
            variant="danger"
            loading={busy}
            icon={<Trash2 size={16} />}
            onClick={() => void handleDelete()}
          >
            Remover instância
          </Button>
        ) : null}

        <Button
          loading={busy}
          icon={<RefreshCw size={16} />}
          onClick={() => {
            setLoading(true);
            void loadStatus();
          }}
        >
          Atualizar status
        </Button>
      </div>
    </div>
  );
}
