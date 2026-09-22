import {
  Building2,
  CheckCircle2,
  Eye,
  EyeOff,
  FileText,
  Image,
  KeyRound,
  MapPin,
  MessageSquare,
  Phone,
  Printer,
  QrCode,
  RefreshCw,
  Save,
  Server,
  Smartphone,
  Trash2,
  Unplug,
  Upload,
  User,
  X,
} from "lucide-react";
import {
  useCallback,
  useEffect,
  useRef,
  useState,
  type FormEvent,
  type ReactNode,
} from "react";
import { api, type WhatsAppStatus } from "../api";
import { useAuth } from "../auth";
import { Button, Feedback, Loading } from "../components/ui";
import { cnpjMask } from "../lib/format";
import { PrintSettingsTab } from "./settings/PrintSettingsTab";
import { ServerSettingsTab } from "./settings/ServerSettingsTab";

type SettingsTab = "hotel" | "whatsapp" | "print" | "server";

const TABS: Array<{
  id: SettingsTab;
  label: string;
  shortLabel: string;
  icon: ReactNode;
}> = [
  {
    id: "hotel",
    label: "Dados do hotel",
    shortLabel: "Hotel",
    icon: <Building2 size={16} />,
  },
  {
    id: "whatsapp",
    label: "WhatsApp",
    shortLabel: "WhatsApp",
    icon: <MessageSquare size={16} />,
  },
  {
    id: "print",
    label: "Impressão",
    shortLabel: "Impressão",
    icon: <Printer size={16} />,
  },
  {
    id: "server",
    label: "Servidor",
    shortLabel: "Servidor",
    icon: <Server size={16} />,
  },
];

export function SettingsPage() {
  const [activeTab, setActiveTab] = useState<SettingsTab>("hotel");

  return (
    <section className="page settings-page">
      <header className="settings-page-header">
        <h1>Configurações</h1>
        <p className="muted">
          Dados do estabelecimento, WhatsApp, impressão e servidor da API.
        </p>
      </header>

      <div className="settings-shell">
        <div className="settings-tabs-bar">
          <nav
            className="settings-tabs"
            role="tablist"
            aria-label="Seções de configurações"
          >
            {TABS.map((tab) => {
              const active = activeTab === tab.id;
              return (
                <button
                  key={tab.id}
                  type="button"
                  role="tab"
                  aria-selected={active}
                  className={active ? "active" : undefined}
                  onClick={() => setActiveTab(tab.id)}
                >
                  {tab.icon}
                  <span className="settings-tab-short">{tab.shortLabel}</span>
                  <span className="settings-tab-full">{tab.label}</span>
                  {active ? <span className="settings-tab-indicator" /> : null}
                </button>
              );
            })}
          </nav>
        </div>

        <div className="settings-tab-panel">
          {activeTab === "hotel" ? <HotelSettingsTab /> : null}
          {activeTab === "whatsapp" ? <WhatsAppSettings /> : null}
          {activeTab === "print" ? <PrintSettingsTab /> : null}
          {activeTab === "server" ? <ServerSettingsTab /> : null}
        </div>
      </div>
    </section>
  );
}

function HotelSettingsTab() {
  const { hotel, updateHotel } = useAuth();
  const [name, setName] = useState(hotel?.name ?? "");
  const [ownerName, setOwnerName] = useState(hotel?.ownerName ?? "");
  const [cnpj, setCnpj] = useState(cnpjMask(hotel?.cnpj ?? ""));
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
  const [showCurrent, setShowCurrent] = useState(false);
  const [showNew, setShowNew] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [selectedLogoFile, setSelectedLogoFile] = useState<File | null>(null);
  const [logoPreviewUrl, setLogoPreviewUrl] = useState<string | null>(null);
  const [logoUploading, setLogoUploading] = useState(false);

  useEffect(() => {
    if (!hotel) return;
    setName(hotel.name);
    setOwnerName(hotel.ownerName);
    setCnpj(cnpjMask(hotel.cnpj ?? ""));
    setPhone(hotel.phone);
    setStreet(hotel.address?.street ?? "");
    setNumber(hotel.address?.number ?? "");
    setComplement(hotel.address?.complement ?? "");
    setNeighborhood(hotel.address?.neighborhood ?? "");
    setCity(hotel.address?.city ?? "");
    setState(hotel.address?.state ?? "");
    setZipCode(hotel.address?.zipCode ?? "");
  }, [hotel]);

  useEffect(() => {
    if (!selectedLogoFile) {
      setLogoPreviewUrl(null);
      return;
    }
    const objectUrl = URL.createObjectURL(selectedLogoFile);
    setLogoPreviewUrl(objectUrl);
    return () => URL.revokeObjectURL(objectUrl);
  }, [selectedLogoFile]);

  async function uploadLogo() {
    if (!selectedLogoFile) return;
    setLogoUploading(true);
    setError(null);
    setMessage(null);
    try {
      const { urls } = await api.uploads.images(
        [selectedLogoFile],
        "hotel-logos",
      );
      const logoUrl = urls[0];
      if (!logoUrl) throw new Error("Falha ao enviar a logo.");
      await updateHotel({ logoUrl });
      setSelectedLogoFile(null);
      setMessage("Logo enviada com sucesso.");
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setLogoUploading(false);
    }
  }

  async function removeLogo() {
    setLogoUploading(true);
    setError(null);
    setMessage(null);
    try {
      await updateHotel({ logoUrl: null });
      setSelectedLogoFile(null);
      setMessage("Logo removida.");
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setLogoUploading(false);
    }
  }

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

    const cnpjDigits = cnpj.replace(/\D/g, "");
    if (cnpjDigits && cnpjDigits.length !== 14) {
      setError("O CNPJ deve ter 14 dígitos.");
      return;
    }

    setBusy(true);
    try {
      await updateHotel({
        name: name.trim(),
        ownerName: ownerName.trim(),
        cnpj: cnpjDigits || null,
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
    <div role="tabpanel" className="settings-panel-content">
      <h3 className="settings-panel-title">
        <Building2 size={16} />
        Dados do hotel
      </h3>

      <Feedback error={error} message={message} />

      <div className="hotel-logo-card">
        <div className="hotel-logo-card-head">
          <Image size={16} />
          <h4>Logo do hotel</h4>
        </div>
        <div className="hotel-logo-card-body">
          <div className="hotel-logo-preview">
            {logoPreviewUrl ? (
              <img src={logoPreviewUrl} alt="Prévia da logo" />
            ) : hotel?.logoUrl ? (
              <img src={hotel.logoUrl} alt="Logo do hotel" />
            ) : (
              <Image size={28} />
            )}
          </div>
          <div className="hotel-logo-actions">
            <p className="muted">
              Exibida na barra lateral. JPG, PNG ou WebP · até 10 MB.
            </p>
            <input
              type="file"
              accept="image/jpeg,image/png,image/webp,image/gif"
              onChange={(event) =>
                setSelectedLogoFile(event.target.files?.[0] ?? null)
              }
            />
            <div className="hotel-logo-buttons">
              <Button
                variant="primary"
                icon={<Upload size={15} />}
                loading={logoUploading}
                disabled={!selectedLogoFile || logoUploading}
                onClick={() => void uploadLogo()}
              >
                Enviar
              </Button>
              <Button
                disabled={logoUploading || !selectedLogoFile}
                icon={<X size={15} />}
                onClick={() => setSelectedLogoFile(null)}
              >
                Cancelar
              </Button>
              <Button
                variant="danger"
                icon={<Trash2 size={15} />}
                loading={logoUploading}
                disabled={logoUploading || (!hotel?.logoUrl && !logoPreviewUrl)}
                onClick={() => void removeLogo()}
              >
                Remover
              </Button>
            </div>
          </div>
        </div>
      </div>

      <form className="settings-form-stack" onSubmit={submit}>
        <div className="settings-fields-grid">
          <label className="settings-field">
            <span>Nome do hotel</span>
            <div className="settings-input-wrap">
              <Building2 size={16} />
              <input
                value={name}
                onChange={(e) => setName(e.target.value)}
                required
                minLength={2}
                placeholder="Ex.: Pousada Sol"
              />
            </div>
          </label>

          <label className="settings-field">
            <span>Nome do proprietário</span>
            <div className="settings-input-wrap">
              <User size={16} />
              <input
                value={ownerName}
                onChange={(e) => setOwnerName(e.target.value)}
                required
                minLength={2}
                placeholder="Seu nome"
              />
            </div>
          </label>

          <label className="settings-field">
            <span>CNPJ</span>
            <div className="settings-input-wrap">
              <FileText size={16} />
              <input
                value={cnpj}
                onChange={(e) => setCnpj(cnpjMask(e.target.value))}
                inputMode="numeric"
                placeholder="00.000.000/0000-00"
              />
            </div>
            <small className="muted">Opcional — aparece no cupom impresso.</small>
          </label>

          <label className="settings-field">
            <span>Número (WhatsApp)</span>
            <div className="settings-input-wrap">
              <Phone size={16} />
              <input
                value={phone}
                onChange={(e) => setPhone(e.target.value)}
                inputMode="tel"
                required
                placeholder="11999999999"
              />
            </div>
          </label>
        </div>

        <div className="settings-divider">
          <h4>
            <MapPin size={15} />
            Endereço
          </h4>
          <p className="muted">
            Usado na mensagem de confirmação enviada ao hóspede.
          </p>
        </div>

        <div className="settings-fields-grid">
          <label className="settings-field">
            <span>Rua / avenida</span>
            <input
              value={street}
              onChange={(e) => setStreet(e.target.value)}
              placeholder="Ex.: Rua das Flores"
            />
          </label>
          <label className="settings-field">
            <span>Número</span>
            <input
              value={number}
              onChange={(e) => setNumber(e.target.value)}
              placeholder="123"
            />
          </label>
          <label className="settings-field">
            <span>Complemento</span>
            <input
              value={complement}
              onChange={(e) => setComplement(e.target.value)}
              placeholder="Bloco A"
            />
          </label>
          <label className="settings-field">
            <span>Bairro</span>
            <input
              value={neighborhood}
              onChange={(e) => setNeighborhood(e.target.value)}
            />
          </label>
          <label className="settings-field">
            <span>Cidade</span>
            <input value={city} onChange={(e) => setCity(e.target.value)} />
          </label>
          <label className="settings-field">
            <span>UF</span>
            <input
              value={state}
              onChange={(e) => setState(e.target.value.toUpperCase())}
              maxLength={2}
              placeholder="SP"
            />
          </label>
          <label className="settings-field">
            <span>CEP</span>
            <input
              value={zipCode}
              onChange={(e) => setZipCode(e.target.value)}
              inputMode="numeric"
              placeholder="00000-000"
            />
          </label>
        </div>

        <div className="settings-divider">
          <h4>
            <KeyRound size={15} />
            Alterar senha
          </h4>
          <p className="muted">Opcional — deixe em branco para manter a atual.</p>
        </div>

        <div className="settings-fields-grid settings-fields-3">
          <label className="settings-field">
            <span>Senha atual</span>
            <div className="settings-input-wrap has-toggle">
              <input
                type={showCurrent ? "text" : "password"}
                value={currentPassword}
                onChange={(e) => setCurrentPassword(e.target.value)}
                autoComplete="current-password"
                placeholder="••••••"
              />
              <button
                type="button"
                className="settings-eye"
                onClick={() => setShowCurrent((value) => !value)}
                aria-label={showCurrent ? "Ocultar senha" : "Mostrar senha"}
              >
                {showCurrent ? <EyeOff size={16} /> : <Eye size={16} />}
              </button>
            </div>
          </label>
          <label className="settings-field">
            <span>Nova senha</span>
            <div className="settings-input-wrap has-toggle">
              <input
                type={showNew ? "text" : "password"}
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                minLength={6}
                autoComplete="new-password"
                placeholder="••••••"
              />
              <button
                type="button"
                className="settings-eye"
                onClick={() => setShowNew((value) => !value)}
                aria-label={showNew ? "Ocultar senha" : "Mostrar senha"}
              >
                {showNew ? <EyeOff size={16} /> : <Eye size={16} />}
              </button>
            </div>
          </label>
          <label className="settings-field">
            <span>Confirmar nova senha</span>
            <input
              type="password"
              value={confirmPassword}
              onChange={(e) => setConfirmPassword(e.target.value)}
              minLength={6}
              autoComplete="new-password"
              placeholder="••••••"
            />
            {password && confirmPassword && password !== confirmPassword ? (
              <small className="settings-field-error">
                As senhas não coincidem
              </small>
            ) : null}
          </label>
        </div>

        <div className="settings-form-actions">
          <Button
            variant="primary"
            type="submit"
            loading={busy}
            icon={<Save size={16} />}
          >
            Salvar dados
          </Button>
        </div>
      </form>
    </div>
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

  if (loading) {
    return (
      <div role="tabpanel" className="settings-panel-content">
        <Loading label="Carregando status do WhatsApp…" />
      </div>
    );
  }

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
    <div role="tabpanel" className="settings-panel-content">
      <h3 className="settings-panel-title">
        <MessageSquare size={16} />
        Integração com WhatsApp
      </h3>
      <p className="muted settings-panel-lead">
        Conecte o WhatsApp do hotel para envio automático de confirmações e
        avisos de limpeza.
      </p>

      <Feedback error={error} message={message} />

      <div
        className={`whatsapp-status-card ${connected ? "ok" : status?.qrCode ? "pending" : ""}`}
      >
        <div className="whatsapp-status-copy">
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
        <span className="whatsapp-status-icon">
          {connected ? <CheckCircle2 size={22} /> : <Smartphone size={22} />}
        </span>
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
