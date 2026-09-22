import { Save, Server } from "lucide-react";
import { useCallback, useEffect, useState, type FormEvent } from "react";
import { Button, Feedback, Loading } from "../../components/ui";

type ApiConfig = {
  apiBaseUrl: string;
  source: "env" | "file" | "default";
  insecure: boolean;
  editable: boolean;
  configPath: string;
};

const SOURCE_LABEL: Record<ApiConfig["source"], string> = {
  env: "variável de ambiente (HOSPEDA_API_URL)",
  file: "arquivo salvo neste computador",
  default: "padrão (localhost)",
};

function isElectronShell() {
  return (
    Boolean(window.hospeda?.isElectron) ||
    /Electron/i.test(navigator.userAgent)
  );
}

function hasApiConfig() {
  return Boolean(window.hospeda?.apiConfig?.get);
}

export function ServerSettingsTab() {
  const [config, setConfig] = useState<ApiConfig | null>(null);
  const [url, setUrl] = useState("");
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);

  const load = useCallback(async () => {
    if (!hasApiConfig()) {
      setLoading(false);
      setError(
        isElectronShell()
          ? "Módulo de servidor não carregou. Feche o Hospeda por completo e abra de novo (o preload só atualiza ao reiniciar)."
          : "Configuração do servidor disponível apenas no aplicativo desktop Hospeda (Electron).",
      );
      return;
    }
    setLoading(true);
    try {
      const data = await window.hospeda!.apiConfig!.get();
      setConfig(data);
      setUrl(data.apiBaseUrl);
      setError(null);
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  async function save(event: FormEvent) {
    event.preventDefault();
    if (!hasApiConfig() || !config?.editable) return;
    setBusy(true);
    setError(null);
    setMessage(null);
    try {
      const result = await window.hospeda!.apiConfig!.save(url);
      setMessage(
        result.restartRequired
          ? "Endereço salvo. Recarregando para aplicar…"
          : "Endereço salvo.",
      );
      window.setTimeout(() => {
        window.location.reload();
      }, 1200);
    } catch (err) {
      setError((err as Error).message);
      setBusy(false);
    }
  }

  if (loading) {
    return (
      <div role="tabpanel" className="settings-panel-content">
        <Loading label="Carregando configuração do servidor…" />
      </div>
    );
  }

  if (!config) {
    return (
      <div role="tabpanel" className="settings-panel-content">
        <Feedback error={error} />
      </div>
    );
  }

  return (
    <div role="tabpanel" className="settings-panel-content">
      <h3 className="settings-panel-title">
        <Server size={16} />
        Servidor
      </h3>
      <p className="muted settings-panel-lead">
        Endereço da API usado por este aplicativo. Em produção, prefira HTTPS.
      </p>

      <Feedback error={error} message={message} />

      {config.insecure ? (
        <div className="print-status-card">
          <strong>Conexão sem HTTPS</strong>
          <p className="muted">
            O endereço atual usa HTTP fora de localhost. Login e tokens trafegam
            em texto puro na rede. Configure HTTPS (veja a documentação de
            deploy) e atualize o endereço abaixo.
          </p>
        </div>
      ) : null}

      {!config.editable ? (
        <div className="print-status-card">
          <strong>Definido pela instalação</strong>
          <p className="muted">
            A variável de ambiente <code>HOSPEDA_API_URL</code> está definida e
            tem prioridade. Remova-a do atalho ou do ambiente para editar aqui.
          </p>
        </div>
      ) : null}

      <form className="settings-form-stack" onSubmit={(e) => void save(e)}>
        <div className="settings-divider">
          <h4>
            <Server size={15} />
            Endereço da API
          </h4>
          <p className="muted">
            Em uso: {config.apiBaseUrl} · origem: {SOURCE_LABEL[config.source]}
          </p>
        </div>

        <label className="settings-field">
          <span>URL base</span>
          <input
            type="url"
            value={url}
            onChange={(e) => setUrl(e.target.value)}
            placeholder="https://api.seudominio.com.br"
            required
            disabled={!config.editable || busy}
          />
        </label>

        {config.source === "file" ? (
          <p className="muted">
            Arquivo: <code>{config.configPath}</code>
          </p>
        ) : null}

        <div className="settings-form-actions">
          <Button
            variant="primary"
            type="submit"
            loading={busy}
            disabled={!config.editable}
            icon={<Save size={16} />}
          >
            Salvar e recarregar
          </Button>
        </div>
      </form>
    </div>
  );
}
