import { Printer } from "lucide-react";
import { useCallback, useEffect, useState, type FormEvent } from "react";
import { useAuth } from "../../auth";
import { Button, Feedback, Loading } from "../../components/ui";

type PrintSettings = {
  printerType: string;
  printerTarget: string;
  paperWidthMm: number;
  contentWidthMm: number;
  fontScalePercent: number;
  fontScale: string;
  lineHeight: number;
  printSecondCopy: boolean;
};

const PAPER_PRESETS = [58, 80] as const;

function isElectronShell() {
  return (
    Boolean(window.staydesck?.isElectron) ||
    /Electron/i.test(navigator.userAgent)
  );
}

function hasPrintApi() {
  return Boolean(window.staydesck?.print?.getSettings);
}

export function PrintSettingsTab() {
  const { hotel } = useAuth();
  const [settings, setSettings] = useState<PrintSettings | null>(null);
  const [printers, setPrinters] = useState<string[]>([]);
  const [platform, setPlatform] = useState(window.staydesck?.platform ?? "");
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [contentAuto, setContentAuto] = useState(true);

  const load = useCallback(async () => {
    if (!hasPrintApi()) {
      setLoading(false);
      setError(
        isElectronShell()
          ? "Módulo de impressão não carregou. Feche o StayDesck por completo e abra de novo (o preload só atualiza ao reiniciar)."
          : "Impressão disponível apenas no aplicativo desktop StayDesck (Electron).",
      );
      return;
    }
    setLoading(true);
    try {
      const data = await window.staydesck!.print!.getSettings();
      setSettings(data.settings);
      setPrinters(data.printers);
      setPlatform(data.platform);
      setContentAuto(!(data.settings.contentWidthMm > 0));
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

  function patch(partial: Partial<PrintSettings>) {
    setSettings((prev) => (prev ? { ...prev, ...partial } : prev));
  }

  async function save(event: FormEvent) {
    event.preventDefault();
    if (!settings || !hasPrintApi()) return;
    setBusy(true);
    setError(null);
    setMessage(null);
    try {
      const next = await window.staydesck!.print!.saveSettings({
        ...settings,
        contentWidthMm: contentAuto ? 0 : settings.contentWidthMm,
      });
      setSettings(next);
      setMessage("Configurações de impressão salvas.");
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setBusy(false);
    }
  }

  async function refreshPrinters() {
    if (!hasPrintApi()) return;
    setBusy(true);
    setError(null);
    try {
      const list = await window.staydesck!.print!.listPrinters();
      setPrinters(list);
      setMessage(
        list.length
          ? `${list.length} impressora(s) encontrada(s).`
          : "Nenhuma impressora instalada encontrada.",
      );
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setBusy(false);
    }
  }

  async function testPrint() {
    if (!settings || !hasPrintApi()) return;
    setBusy(true);
    setError(null);
    setMessage(null);
    try {
      await window.staydesck!.print!.saveSettings({
        ...settings,
        contentWidthMm: contentAuto ? 0 : settings.contentWidthMm,
      });
      const result = await window.staydesck!.print!.test({
        ...settings,
        contentWidthMm: contentAuto ? 0 : settings.contentWidthMm,
        hotelName: hotel?.name,
        hotelCnpj: hotel?.cnpj ?? undefined,
      });
      setMessage(
        result.copies > 1
          ? "Teste enviado (2 vias)."
          : "Cupom de teste enviado à impressora.",
      );
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setBusy(false);
    }
  }

  if (loading) {
    return (
      <div role="tabpanel" className="settings-panel-content">
        <Loading label="Carregando impressoras…" />
      </div>
    );
  }

  if (!settings) {
    return (
      <div role="tabpanel" className="settings-panel-content">
        <Feedback error={error} />
      </div>
    );
  }

  const selectedInList = printers.includes(settings.printerTarget);

  return (
    <div role="tabpanel" className="settings-panel-content">
      <h3 className="settings-panel-title">
        <Printer size={16} />
        Impressão
      </h3>
      <p className="muted settings-panel-lead">
        Configure a impressora térmica para imprimir os detalhes das reservas
        (mesmo fluxo do Mira Printer: spooler Windows).
      </p>

      <Feedback error={error} message={message} />

      {platform && platform !== "win32" ? (
        <div className="print-status-card">
          <strong>Aviso</strong>
          <p className="muted">
            A listagem e impressão via spooler estão otimizadas para Windows.
            Plataforma atual: {platform}.
          </p>
        </div>
      ) : null}

      <form className="settings-form-stack" onSubmit={(e) => void save(e)}>
        <div className="settings-divider">
          <h4>
            <Printer size={15} />
            Impressora
          </h4>
          <p className="muted">
            Escolha uma impressora instalada no Windows ou digite o nome
            exato.
          </p>
        </div>

        <div className="settings-fields-grid">
          <label className="settings-field">
            <span>Impressoras instaladas</span>
            <select
              value={selectedInList ? settings.printerTarget : ""}
              onChange={(e) => {
                if (e.target.value) patch({ printerTarget: e.target.value });
              }}
            >
              <option value="">Selecione…</option>
              {printers.map((name) => (
                <option key={name} value={name}>
                  {name}
                </option>
              ))}
            </select>
          </label>

          <label className="settings-field">
            <span>Nome da impressora</span>
            <input
              value={settings.printerTarget}
              onChange={(e) => patch({ printerTarget: e.target.value })}
              placeholder="Ex.: EPSON TM-T20"
              required
            />
          </label>
        </div>

        <label className="settings-check">
          <input
            type="checkbox"
            checked={settings.printSecondCopy}
            onChange={(e) => patch({ printSecondCopy: e.target.checked })}
          />
          <span>Imprimir segunda via (hóspede + recepção)</span>
        </label>

        <div className="settings-divider">
          <h4>Papel e fonte</h4>
          <p className="muted">
            Largura do bobina térmica e escala do texto no cupom.
          </p>
        </div>

        <div className="print-presets">
          {PAPER_PRESETS.map((mm) => (
            <button
              key={mm}
              type="button"
              className={
                settings.paperWidthMm === mm ? "print-preset active" : "print-preset"
              }
              onClick={() => patch({ paperWidthMm: mm })}
            >
              {mm} mm
            </button>
          ))}
        </div>

        <div className="settings-fields-grid settings-fields-3">
          <label className="settings-field">
            <span>Largura do papel (mm)</span>
            <input
              type="number"
              min={40}
              max={120}
              value={settings.paperWidthMm}
              onChange={(e) =>
                patch({ paperWidthMm: Number(e.target.value) || 80 })
              }
            />
          </label>

          <label className="settings-field">
            <span>Escala da fonte (%)</span>
            <input
              type="number"
              min={60}
              max={200}
              value={settings.fontScalePercent}
              onChange={(e) =>
                patch({ fontScalePercent: Number(e.target.value) || 100 })
              }
            />
          </label>

          <label className="settings-field">
            <span>Espaçamento entre linhas</span>
            <input
              type="number"
              min={1}
              max={2.2}
              step={0.05}
              value={settings.lineHeight}
              onChange={(e) =>
                patch({ lineHeight: Number(e.target.value) || 1.35 })
              }
            />
          </label>
        </div>

        <label className="settings-check">
          <input
            type="checkbox"
            checked={contentAuto}
            onChange={(e) => {
              setContentAuto(e.target.checked);
              if (e.target.checked) patch({ contentWidthMm: 0 });
            }}
          />
          <span>Área impressa automática</span>
        </label>

        {!contentAuto ? (
          <label className="settings-field">
            <span>Largura da área impressa (mm)</span>
            <input
              type="number"
              min={30}
              max={settings.paperWidthMm}
              value={settings.contentWidthMm || 68}
              onChange={(e) =>
                patch({ contentWidthMm: Number(e.target.value) || 68 })
              }
            />
          </label>
        ) : null}

        <div className="settings-form-actions print-actions">
          <Button
            variant="primary"
            type="submit"
            loading={busy}
            icon={<Printer size={16} />}
          >
            Salvar
          </Button>
          <Button
            type="button"
            loading={busy}
            onClick={() => void refreshPrinters()}
          >
            Atualizar lista
          </Button>
          <Button
            type="button"
            loading={busy}
            disabled={!settings.printerTarget.trim()}
            onClick={() => void testPrint()}
          >
            Imprimir teste
          </Button>
        </div>
      </form>
    </div>
  );
}
