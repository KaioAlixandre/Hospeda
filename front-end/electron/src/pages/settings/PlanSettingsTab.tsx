import {
  AlertTriangle,
  BadgeCheck,
  Check,
  ChevronRight,
  CreditCard,
  Crown,
  ExternalLink,
  MessageCircle,
  RefreshCw,
  X,
} from "lucide-react";
import { useState } from "react";
import { api, type PlanCode, type PlanFeature } from "../../api";
import { useAuth } from "../../auth";
import { Button, Feedback } from "../../components/ui";
import { dateBR } from "../../lib/format";
import { openSalesWhatsApp } from "../../lib/salesWhatsApp";

const PLAN_ORDER: PlanCode[] = ["SIMPLES", "PRO", "PLUS"];

const FEATURE_ROWS = [
  "Reservas, quartos e hóspedes",
  "Limpeza, relatórios e caixa",
  "WhatsApp de confirmação e limpeza",
  "Catálogo online de reservas",
] as const;

const PLAN_META: Record<
  PlanCode,
  {
    tone: "simples" | "pro" | "plus";
    included: boolean[];
  }
> = {
  SIMPLES: {
    tone: "simples",
    included: [true, true, false, false],
  },
  PRO: {
    tone: "pro",
    included: [true, true, true, false],
  },
  PLUS: {
    tone: "plus",
    included: [true, true, true, true],
  },
};

const FALLBACK_CATALOG = {
  SIMPLES: {
    label: "Simples",
    priceCents: 5300,
    features: [] as PlanFeature[],
  },
  PRO: {
    label: "Pro",
    priceCents: 7300,
    features: ["messaging"] as PlanFeature[],
  },
  PLUS: {
    label: "Plus",
    priceCents: 9300,
    features: ["messaging", "catalog"] as PlanFeature[],
  },
};

function statusLabel(status: string | undefined): string {
  if (status === "ACTIVE") return "Ativo";
  if (status === "PAST_DUE") return "Em atraso";
  if (status === "CANCELLED") return "Cancelado";
  return "—";
}

async function openBillingUrl(url: string) {
  if (window.staydesck?.openExternal) {
    await window.staydesck.openExternal(url);
    return;
  }
  window.open(url, "_blank", "noopener,noreferrer");
}

export function PlanSettingsTab() {
  const { hotel, refreshHotel } = useAuth();
  const sub = hotel?.subscription;
  const catalog = sub?.catalog ?? FALLBACK_CATALOG;
  const effective = sub?.effectivePlan ?? "SIMPLES";
  const label = sub?.label ?? catalog[effective].label;
  const price = sub?.priceLabel ?? `R$ ${(catalog[effective].priceCents / 100).toFixed(0)}/mês`;
  const paidUntil = sub?.paidUntil ?? null;
  const downgraded = Boolean(sub?.downgraded);
  const stripeEnabled = Boolean(sub?.billing?.stripeEnabled);
  const hasSubscription = Boolean(sub?.billing?.hasSubscription);

  const [busy, setBusy] = useState<PlanCode | "portal" | "refresh" | null>(
    null,
  );
  const [error, setError] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);

  function handleWhatsAppUpgrade() {
    const hotelName = hotel?.name ?? "meu hotel";
    openSalesWhatsApp(
      `Olá! Quero fazer upgrade do plano StayDesck. Hotel: ${hotelName}. Plano atual: ${label} (${price}).`,
    );
  }

  async function handlePlanCardClick(plan: PlanCode) {
    if (!stripeEnabled || busy) return;
    if (plan === effective && hasSubscription) {
      await openPortal();
      return;
    }
    await startCheckout(plan);
  }

  async function startCheckout(plan: PlanCode) {
    if (!stripeEnabled || busy) return;
    setBusy(plan);
    setError(null);
    setMessage(null);
    try {
      const { url } = await api.billing.checkout(plan);
      await openBillingUrl(url);
      setMessage(
        "Abrimos a página de pagamento. Depois de concluir, volte e clique em Atualizar.",
      );
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setBusy(null);
    }
  }

  async function openPortal() {
    setBusy("portal");
    setError(null);
    setMessage(null);
    try {
      const { url } = await api.billing.portal();
      await openBillingUrl(url);
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setBusy(null);
    }
  }

  async function handleRefresh() {
    setBusy("refresh");
    setError(null);
    setMessage(null);
    try {
      await refreshHotel();
      setMessage("Assinatura atualizada.");
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setBusy(null);
    }
  }

  return (
    <div role="tabpanel" className="settings-panel-content plan-page">
      <h3 className="settings-panel-title">
        <CreditCard size={16} />
        Assinatura
      </h3>
      <p className="muted settings-panel-lead">
        Gerencie seu plano, cobrança e dados da assinatura.
      </p>

      <Feedback error={error} message={message} />

      <section className="plan-overview-card">
        <div className="plan-overview-head">
          <div>
            <h4 className="plan-section-title">
              <Crown size={16} />
              Plano atual
            </h4>
            <p className="muted">Visão geral da sua assinatura</p>
          </div>
          <Button
            type="button"
            loading={busy === "refresh"}
            disabled={busy !== null}
            icon={<RefreshCw size={14} />}
            onClick={() => void handleRefresh()}
          >
            Atualizar
          </Button>
        </div>

        <div className="plan-overview-grid">
          <div className="plan-stat">
            <span className="plan-stat-label">Plano</span>
            <strong>{label}</strong>
          </div>
          <div className="plan-stat">
            <span className="plan-stat-label">Status</span>
            <span className="plan-status-pill">
              <BadgeCheck size={14} />
              {statusLabel(sub?.status)}
            </span>
          </div>
          <div className="plan-stat">
            <span className="plan-stat-label">Próxima renovação</span>
            <strong>{paidUntil ? dateBR(paidUntil) : "—"}</strong>
          </div>
          <div className="plan-stat">
            <span className="plan-stat-label">Gerenciar</span>
            {stripeEnabled && hasSubscription ? (
              <button
                type="button"
                className="plan-link-btn"
                disabled={busy !== null}
                onClick={() => void openPortal()}
              >
                Portal Stripe <ExternalLink size={13} />
              </button>
            ) : (
              <strong className="muted">—</strong>
            )}
          </div>
        </div>
      </section>

      {downgraded ? (
        <div className="print-status-card plan-downgrade-warn">
          <strong>
            <AlertTriangle size={15} /> Plano rebaixado
          </strong>
          <p className="muted">
            O pagamento venceu e o hotel voltou ao Simples. Os extras (WhatsApp
            e catálogo) ficam pausados até a renovação — o sistema continua
            funcionando normalmente.
          </p>
        </div>
      ) : null}

      <section className="plan-choose-block">
        <h4 className="plan-section-title">
          <Crown size={16} />
          Plano mensal
        </h4>
        <p className="muted">
          Clique no card para assinar. Escolha o plano que melhor atende sua
          operação.
        </p>

        <div className="plan-cards">
          {PLAN_ORDER.map((code) => {
            const entry = catalog[code] ?? FALLBACK_CATALOG[code];
            const meta = PLAN_META[code];
            const isActive = code === effective;
            const priceReais = (entry.priceCents / 100).toFixed(0);
            const disabled = !stripeEnabled || busy !== null;

            return (
              <button
                key={code}
                type="button"
                className={`plan-card plan-card-${meta.tone}${isActive ? " is-active" : ""}`}
                disabled={disabled}
                onClick={() => void handlePlanCardClick(code)}
              >
                <div className="plan-card-banner" aria-hidden>
                  <span className="plan-card-wave" />
                </div>

                <div className="plan-card-price-orb">
                  <span className="plan-card-currency">R$</span>
                  <span className="plan-card-amount">{priceReais}</span>
                </div>

                <div className="plan-card-body">
                  <div className="plan-card-title-block">
                    <strong className="plan-card-name">{entry.label}</strong>
                    <span className="plan-card-cycle">por mês</span>
                    {isActive ? (
                      <span className="plan-card-current-tag">Plano atual</span>
                    ) : null}
                  </div>

                  <ul className="plan-card-features">
                    {FEATURE_ROWS.map((feat, index) => {
                      const on = meta.included[index];
                      return (
                        <li
                          key={feat}
                          className={on ? "is-on" : "is-off"}
                        >
                          <span className="plan-feat-icon" aria-hidden>
                            {on ? <Check size={13} strokeWidth={3} /> : <X size={13} strokeWidth={3} />}
                          </span>
                          {feat}
                        </li>
                      );
                    })}
                  </ul>

                  <span className="plan-card-order">
                    {isActive && hasSubscription ? "Gerenciar" : "Assinar"}
                    <ChevronRight size={14} strokeWidth={2.5} />
                  </span>
                </div>
              </button>
            );
          })}
        </div>

        {!stripeEnabled ? (
          <p className="plan-stripe-hint">
            Pagamento online ainda não configurado. Use o WhatsApp comercial
            para assinar, ou defina as variáveis STRIPE_* na API.
          </p>
        ) : null}
      </section>

      <div className="settings-form-actions">
        {stripeEnabled && hasSubscription ? (
          <Button
            type="button"
            loading={busy === "portal"}
            disabled={busy !== null}
            icon={<ExternalLink size={16} />}
            onClick={() => void openPortal()}
          >
            Gerenciar assinatura
          </Button>
        ) : null}
        <Button
          variant={stripeEnabled ? undefined : "primary"}
          type="button"
          icon={<MessageCircle size={16} />}
          onClick={handleWhatsAppUpgrade}
        >
          Falar no WhatsApp
        </Button>
      </div>
    </div>
  );
}
