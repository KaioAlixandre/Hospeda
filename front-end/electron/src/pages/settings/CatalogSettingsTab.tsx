import {
  AlertTriangle,
  Check,
  Copy,
  Globe,
  MessageCircle,
  Save,
} from "lucide-react";
import { useCallback, useEffect, useState, type FormEvent } from "react";
import { api, type CatalogSettings } from "../../api";
import { useAuth } from "../../auth";
import { Button, Feedback, Loading } from "../../components/ui";
import { openSalesWhatsApp } from "../../lib/salesWhatsApp";

export function CatalogSettingsTab() {
  const { hotel } = useAuth();

  if (!hotel?.subscription?.features?.catalog) {
    return <CatalogPlanUpsell />;
  }

  return <CatalogConnectedSettings />;
}

function CatalogPlanUpsell() {
  const { hotel } = useAuth();
  const stripeEnabled = Boolean(hotel?.subscription?.billing?.stripeEnabled);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  function handleWhatsApp() {
    const hotelName = hotel?.name ?? "meu hotel";
    openSalesWhatsApp(
      `Olá! Quero o plano Plus do Hospeda (catálogo online) para o hotel ${hotelName}.`,
    );
  }

  async function handleStripe() {
    setBusy(true);
    setError(null);
    try {
      const { url } = await api.billing.checkout("PLUS");
      if (window.hospeda?.openExternal) {
        await window.hospeda.openExternal(url);
      } else {
        window.open(url, "_blank", "noopener,noreferrer");
      }
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setBusy(false);
    }
  }

  return (
    <div role="tabpanel" className="settings-panel-content">
      <h3 className="settings-panel-title">
        <Globe size={16} />
        Catálogo online
      </h3>
      <p className="muted settings-panel-lead">
        Página pública de reservas com link e QR Code para seus hóspedes.
      </p>

      <Feedback error={error} />

      <div className="print-status-card plan-sales-card">
        <strong>Disponível no plano Plus</strong>
        <p className="muted">
          Com o Plus você publica um catálogo online: o hóspede escolhe datas,
          vê disponibilidade e envia um pedido de reserva direto para o hotel.
        </p>
        <p className="plan-sales-price">R$ 93/mês</p>
        <div className="settings-form-actions">
          {stripeEnabled ? (
            <Button
              variant="primary"
              type="button"
              loading={busy}
              onClick={() => void handleStripe()}
            >
              Assinar Plus
            </Button>
          ) : null}
          <Button
            variant={stripeEnabled ? undefined : "primary"}
            type="button"
            icon={<MessageCircle size={16} />}
            onClick={handleWhatsApp}
          >
            {stripeEnabled ? "Falar no WhatsApp" : "Quero o plano Plus"}
          </Button>
        </div>
      </div>
    </div>
  );
}

function CatalogConnectedSettings() {
  const [data, setData] = useState<CatalogSettings | null>(null);
  const [catalogEnabled, setCatalogEnabled] = useState(false);
  const [headline, setHeadline] = useState("");
  const [rules, setRules] = useState("");
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [copied, setCopied] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const catalog = await api.catalog.get();
      setData(catalog);
      setCatalogEnabled(catalog.catalogEnabled);
      setHeadline(catalog.headline ?? "");
      setRules(catalog.rules ?? "");
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

  async function copyUrl() {
    if (!data?.publicUrl) return;
    try {
      await navigator.clipboard.writeText(data.publicUrl);
      setCopied(true);
      window.setTimeout(() => setCopied(false), 2000);
    } catch {
      setError("Não foi possível copiar o link.");
    }
  }

  async function save(event: FormEvent) {
    event.preventDefault();
    setBusy(true);
    setError(null);
    setMessage(null);
    try {
      const updated = await api.catalog.update({
        catalogEnabled,
        catalogHeadline: headline.trim() || null,
        catalogRules: rules.trim() || null,
      });
      setData((prev) =>
        prev
          ? {
              ...prev,
              catalogEnabled: updated.catalogEnabled,
              slug: updated.slug,
              publicUrl: updated.publicUrl,
              headline: updated.headline,
              rules: updated.rules,
            }
          : prev,
      );
      setCatalogEnabled(updated.catalogEnabled);
      setHeadline(updated.headline ?? "");
      setRules(updated.rules ?? "");
      setMessage("Catálogo atualizado.");
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setBusy(false);
    }
  }

  if (loading) {
    return (
      <div role="tabpanel" className="settings-panel-content">
        <Loading label="Carregando catálogo…" />
      </div>
    );
  }

  const publicUrl = data?.publicUrl ?? null;
  const qrSrc = publicUrl
    ? `https://api.qrserver.com/v1/create-qr-code/?size=180x180&data=${encodeURIComponent(publicUrl)}`
    : null;
  const missingPhotos = data?.roomTypesWithoutPhotos ?? [];

  return (
    <div role="tabpanel" className="settings-panel-content">
      <h3 className="settings-panel-title">
        <Globe size={16} />
        Catálogo online
      </h3>
      <p className="muted settings-panel-lead">
        Ative a página pública, personalize o texto e compartilhe o link ou QR
        Code com seus hóspedes.
      </p>

      <Feedback error={error} message={message} />

      {missingPhotos.length > 0 ? (
        <div className="print-status-card plan-downgrade-warn">
          <strong>
            <AlertTriangle size={15} /> Tipos sem foto
          </strong>
          <p className="muted">
            Adicione fotos em Tipos de quarto para melhorar o catálogo:{" "}
            {missingPhotos.map((rt) => rt.name).join(", ")}.
          </p>
        </div>
      ) : null}

      <form className="settings-form-stack" onSubmit={(e) => void save(e)}>
        <label className="settings-field settings-toggle-field">
          <span>Catálogo publicado</span>
          <div className="catalog-toggle-row">
            <input
              type="checkbox"
              checked={catalogEnabled}
              onChange={(e) => setCatalogEnabled(e.target.checked)}
            />
            <span className="muted">
              {catalogEnabled
                ? "Visitantes podem ver disponibilidade e pedir reserva."
                : "Página pública desativada."}
            </span>
          </div>
        </label>

        {publicUrl ? (
          <div className="catalog-public-block">
            <label className="settings-field">
              <span>Link público</span>
              <div className="catalog-url-row">
                <input value={publicUrl} readOnly />
                <Button
                  type="button"
                  icon={copied ? <Check size={15} /> : <Copy size={15} />}
                  onClick={() => void copyUrl()}
                >
                  {copied ? "Copiado" : "Copiar"}
                </Button>
              </div>
            </label>
            {qrSrc ? (
              <div className="catalog-qr">
                <img src={qrSrc} alt="QR Code do catálogo" width={180} height={180} />
                <p className="muted">QR Code para imprimir ou compartilhar.</p>
              </div>
            ) : null}
          </div>
        ) : (
          <p className="muted">
            Salve as configurações para gerar o link público do hotel.
          </p>
        )}

        <label className="settings-field">
          <span>Headline da capa</span>
          <textarea
            rows={3}
            value={headline}
            onChange={(e) => setHeadline(e.target.value)}
            maxLength={2000}
            placeholder="Ex.: Reserve direto conosco e ganhe café da manhã."
          />
        </label>

        <label className="settings-field">
          <span>Regras e informações</span>
          <textarea
            rows={5}
            value={rules}
            onChange={(e) => setRules(e.target.value)}
            maxLength={5000}
            placeholder="Check-in a partir das 14h, pets sob consulta…"
          />
        </label>

        <div className="settings-form-actions">
          <Button
            variant="primary"
            type="submit"
            loading={busy}
            icon={<Save size={16} />}
          >
            Salvar catálogo
          </Button>
        </div>
      </form>
    </div>
  );
}
