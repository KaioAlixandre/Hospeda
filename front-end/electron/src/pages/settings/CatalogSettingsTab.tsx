import {
  AlertTriangle,
  Check,
  Copy,
  Globe,
  ImagePlus,
  MessageCircle,
  Save,
  Trash2,
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
      `Olá! Quero o plano Plus do StayDesck (catálogo online) para o hotel ${hotelName}.`,
    );
  }

  async function handleStripe() {
    setBusy(true);
    setError(null);
    try {
      const { url } = await api.billing.checkout("PLUS");
      if (window.staydesck?.openExternal) {
        await window.staydesck.openExternal(url);
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
  const [coverPhotoUrl, setCoverPhotoUrl] = useState<string | null>(null);
  const [showCheckInTime, setShowCheckInTime] = useState(false);
  const [showCheckOutTime, setShowCheckOutTime] = useState(false);
  const [checkInTime, setCheckInTime] = useState("14:00");
  const [checkOutTime, setCheckOutTime] = useState("11:00");
  const [brandColor, setBrandColor] = useState("#0B6E4F");
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [uploading, setUploading] = useState(false);
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
      setCoverPhotoUrl(catalog.coverPhotoUrl);
      setShowCheckInTime(Boolean(catalog.checkInTime));
      setShowCheckOutTime(Boolean(catalog.checkOutTime));
      setCheckInTime(catalog.checkInTime ?? "14:00");
      setCheckOutTime(catalog.checkOutTime ?? "11:00");
      setBrandColor(catalog.brandColor ?? "#0B6E4F");
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

  async function onCoverPick(files: FileList | null) {
    if (!files?.length) return;
    setUploading(true);
    setError(null);
    try {
      const { urls } = await api.uploads.images([files[0]!], "hotel-covers");
      setCoverPhotoUrl(urls[0] ?? null);
      setMessage("Foto de capa enviada. Salve para publicar.");
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setUploading(false);
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
        coverPhotoUrl,
        checkInTime: showCheckInTime ? checkInTime.trim() || null : null,
        checkOutTime: showCheckOutTime ? checkOutTime.trim() || null : null,
        brandColor: brandColor.trim() || null,
      });
      setData(updated);
      setCatalogEnabled(updated.catalogEnabled);
      setHeadline(updated.headline ?? "");
      setRules(updated.rules ?? "");
      setCoverPhotoUrl(updated.coverPhotoUrl);
      setShowCheckInTime(Boolean(updated.checkInTime));
      setShowCheckOutTime(Boolean(updated.checkOutTime));
      setCheckInTime((updated.checkInTime ?? checkInTime) || "14:00");
      setCheckOutTime((updated.checkOutTime ?? checkOutTime) || "11:00");
      setBrandColor(updated.brandColor ?? "#0B6E4F");
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
        Ative a página pública, personalize capa e textos, e compartilhe o link
        ou QR Code com seus hóspedes.
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
          <span>Foto de capa</span>
          <div className="catalog-cover-row">
            {coverPhotoUrl ? (
              <img
                className="catalog-cover-preview"
                src={coverPhotoUrl}
                alt="Capa do catálogo"
              />
            ) : (
              <div className="catalog-cover-preview empty">Sem capa</div>
            )}
            <div className="catalog-cover-actions">
              <label className="btn">
                <ImagePlus size={15} />
                {uploading ? "Enviando…" : "Enviar foto"}
                <input
                  type="file"
                  accept="image/*"
                  hidden
                  disabled={uploading || busy}
                  onChange={(e) => {
                    void onCoverPick(e.target.files);
                    e.target.value = "";
                  }}
                />
              </label>
              {coverPhotoUrl ? (
                <Button
                  type="button"
                  icon={<Trash2 size={15} />}
                  onClick={() => setCoverPhotoUrl(null)}
                >
                  Remover
                </Button>
              ) : null}
            </div>
          </div>
          <small className="muted">
            Imagem larga (paisagem). Sem capa, o site usa a cor do catálogo.
          </small>
        </label>

        <div className="form-grid catalog-times-grid">
          <div className="settings-field catalog-time-field">
            <label className="catalog-toggle-row catalog-time-toggle">
              <input
                type="checkbox"
                checked={showCheckInTime}
                onChange={(e) => setShowCheckInTime(e.target.checked)}
              />
              <span>Exibir check-in a partir de</span>
            </label>
            <input
              type="time"
              value={checkInTime}
              disabled={!showCheckInTime}
              onChange={(e) => setCheckInTime(e.target.value)}
            />
          </div>
          <div className="settings-field catalog-time-field">
            <label className="catalog-toggle-row catalog-time-toggle">
              <input
                type="checkbox"
                checked={showCheckOutTime}
                onChange={(e) => setShowCheckOutTime(e.target.checked)}
              />
              <span>Exibir check-out até</span>
            </label>
            <input
              type="time"
              value={checkOutTime}
              disabled={!showCheckOutTime}
              onChange={(e) => setCheckOutTime(e.target.value)}
            />
          </div>
          <label className="settings-field">
            <span>Cor do catálogo</span>
            <input
              type="color"
              value={brandColor}
              onChange={(e) => setBrandColor(e.target.value.toUpperCase())}
            />
          </label>
        </div>

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
            placeholder="Uma regra por linha…"
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
