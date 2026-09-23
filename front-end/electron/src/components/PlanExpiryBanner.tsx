import { AlertTriangle, X } from "lucide-react";
import { useMemo, useState } from "react";
import { useAuth } from "../auth";
import { dateBR } from "../lib/format";

const DISMISS_KEY = "hospeda_plan_banner_dismissed";
const DAY_MS = 24 * 60 * 60 * 1000;
const WARN_DAYS = 5;

function isDismissedRecently(): boolean {
  const raw = localStorage.getItem(DISMISS_KEY);
  if (!raw) return false;
  const ts = Number(raw);
  if (!Number.isFinite(ts)) return false;
  return Date.now() - ts < DAY_MS;
}

function shouldWarn(paidUntil: string | null, downgraded: boolean): boolean {
  if (downgraded) return true;
  if (!paidUntil) return false;
  const until = new Date(paidUntil).getTime();
  if (!Number.isFinite(until)) return false;
  const daysUntil = (until - Date.now()) / DAY_MS;
  return daysUntil <= WARN_DAYS;
}

export function PlanExpiryBanner() {
  const { hotel } = useAuth();
  const [hidden, setHidden] = useState(() => isDismissedRecently());

  const sub = hotel?.subscription;
  const visible = useMemo(() => {
    if (hidden || !sub) return false;
    return shouldWarn(sub.paidUntil, sub.downgraded);
  }, [hidden, sub]);

  if (!visible || !sub) return null;

  const message = sub.downgraded
    ? `Seu plano foi rebaixado para ${sub.label}. Renove para recuperar WhatsApp e catálogo.`
    : sub.paidUntil
      ? `Seu plano vence em ${dateBR(sub.paidUntil)}. Renove a tempo para manter os extras.`
      : "Atenção ao vencimento do seu plano Hospeda.";

  function dismiss() {
    localStorage.setItem(DISMISS_KEY, String(Date.now()));
    setHidden(true);
  }

  return (
    <div className="plan-expiry-banner" role="status">
      <div className="plan-expiry-banner-copy">
        <AlertTriangle size={15} />
        <span>{message}</span>
      </div>
      <button
        type="button"
        className="plan-expiry-banner-dismiss"
        onClick={dismiss}
        aria-label="Dispensar aviso"
      >
        <X size={14} />
      </button>
    </div>
  );
}
