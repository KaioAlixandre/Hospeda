import { RefreshCw } from "lucide-react";
import { useCallback, useEffect, useMemo, useState } from "react";
import { api } from "../api";
import { Button, EmptyState, Feedback, Icon, Loading, Panel } from "../components/ui";
import { brl, dateBR } from "../lib/format";
import type { Dashboard, StaySummary } from "../types";

const ROOM_STATUS_META: Array<{
  key: keyof Dashboard["roomStatus"];
  label: string;
  icon: string;
  tone: string;
}> = [
  { key: "AVAILABLE", label: "Disponível", icon: "door-open", tone: "green" },
  { key: "OCCUPIED", label: "Ocupado", icon: "bed-double", tone: "red" },
  { key: "RESERVED", label: "Reservado", icon: "calendar-check", tone: "blue" },
  { key: "CLEANING", label: "Limpeza", icon: "spray-can", tone: "yellow" },
  { key: "MAINTENANCE", label: "Manutenção", icon: "wrench", tone: "gray" },
];

const KPI_ORDER: Array<keyof Dashboard["cards"]> = [
  "occupancyRate",
  "revpar",
  "revenue",
  "newReservations",
  "guestsInHouse",
  "adr",
  "checkOutsToday",
  "cancelledToday",
];

function StayList({ items, empty }: { items: StaySummary[]; empty: string }) {
  if (items.length === 0) return <EmptyState message={empty} />;
  return (
    <ul className="list">
      {items.map((item) => (
        <li key={item.id}>
          <div>
            <strong>{item.guestName}</strong>
            <span className="muted">
              {item.roomNumber ? `Quarto ${item.roomNumber}` : item.roomType} ·{" "}
              {item.guests} hóspede{item.guests > 1 ? "s" : ""}
            </span>
          </div>
          <code>{item.code}</code>
        </li>
      ))}
    </ul>
  );
}

export function DashboardPage() {
  const [data, setData] = useState<Dashboard | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      setData(await api.dashboard());
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

  const chartMax = useMemo(() => {
    if (!data?.chart) return 1;
    return Math.max(1, ...data.chart.series.map((item) => item.value));
  }, [data]);

  if (loading && !data) return <Loading label="Carregando indicadores…" />;

  if (error && !data) {
    return (
      <section className="page">
        <h1>Dashboard</h1>
        <Feedback error={error} />
        <EmptyState message="Não foi possível carregar os indicadores. Confirme se a API está acessível e tente novamente." />
        <Button variant="primary" icon={<RefreshCw size={16} />} onClick={load}>
          Tentar novamente
        </Button>
      </section>
    );
  }

  if (!data) return null;

  return (
    <section className="page">
      <header className="page-header">
        <div>
          <p className="eyebrow">Home / Indicadores</p>
          <h1>Dashboard</h1>
        </div>
        <div className="header-actions">
          <span className="muted">{dateBR(`${data.date}T00:00:00.000Z`)}</span>
          <Button icon={<RefreshCw size={16} />} onClick={load} loading={loading}>
            Atualizar
          </Button>
        </div>
      </header>

      <Feedback error={error} />

      <section className="dashboard-section">
        <h2 className="dashboard-section-title">Principais indicadores</h2>
        <div className="kpi-grid">
          {KPI_ORDER.map((key) => {
            const card = data.cards[key];
            if (!card) return null;
            const tone = card.tone ?? "teal";
            return (
              <article key={key} className={`kpi-card tone-${tone}`}>
                <div className="kpi-copy">
                  <strong>{card.formatted ?? card.value}</strong>
                  <p>{card.label}</p>
                </div>
                <span className="kpi-icon">
                  <Icon name={card.icon} size={22} />
                </span>
              </article>
            );
          })}
        </div>
      </section>

      <section className="dashboard-section">
        <h2 className="dashboard-section-title">Principais gráficos</h2>
        <Panel title={data.chart?.label ?? "Movimento do dia"}>
          <div className="chart-legend">
            {(data.chart?.series ?? []).map((series) => (
              <span key={series.key} className={`chart-legend-item tone-${series.tone}`}>
                <span className="chart-legend-dot" />
                {series.label}
              </span>
            ))}
          </div>
          <div className="bar-chart" role="img" aria-label="Gráfico de movimento do dia">
            {(data.chart?.series ?? []).map((series) => {
              const height = Math.max(6, (series.value / chartMax) * 100);
              return (
                <div key={series.key} className="bar-chart-col">
                  <div className="bar-chart-track">
                    <div
                      className={`bar-chart-fill tone-${series.tone}`}
                      style={{ height: `${height}%` }}
                      title={`${series.label}: ${series.value}`}
                    >
                      {series.value > 0 ? <span>{series.value}</span> : null}
                    </div>
                  </div>
                  <span className="bar-chart-label">{series.label}</span>
                </div>
              );
            })}
          </div>
        </Panel>
      </section>

      <Panel title="Situação dos quartos">
        <div className="status-strip">
          {ROOM_STATUS_META.map((meta) => (
            <div key={meta.key} className={`status-chip tone-${meta.tone}`}>
              <Icon name={meta.icon} size={16} />
              <span>{meta.label}</span>
              <strong>{data.roomStatus[meta.key]}</strong>
            </div>
          ))}
        </div>
        <p className="muted spaced">
          Ocupação: {data.occupancy.occupiedRooms} de{" "}
          {data.occupancy.sellableRooms} quartos vendáveis ·{" "}
          {data.occupancy.rateLabel}
        </p>
      </Panel>

      <div className="split">
        <Panel title="Chegadas previstas">
          <StayList
            items={data.today.arrivalsExpected}
            empty="Nenhuma chegada prevista para hoje."
          />
        </Panel>
        <Panel title="Saídas previstas">
          <StayList
            items={data.today.departuresExpected}
            empty="Nenhuma saída prevista para hoje."
          />
        </Panel>
      </div>

      <div className="split">
        <Panel title="Check-ins realizados">
          <StayList
            items={data.today.checkIns}
            empty="Nenhum check-in registrado hoje."
          />
        </Panel>
        <Panel title="Hóspedes na casa">
          <StayList
            items={data.today.guestsInHouse}
            empty="Nenhum hóspede hospedado."
          />
        </Panel>
      </div>

      <Panel title={data.topProducts?.label ?? "Mais vendidos (30 dias)"}>
        {!data.topProducts?.items?.length ? (
          <EmptyState message="Ainda não há lançamentos por produto. Cadastre itens e lance pela conta da reserva." />
        ) : (
          <ul className="top-products-list">
            {data.topProducts.items.map((item) => (
              <li key={item.productId}>
                <div>
                  <strong>{item.name}</strong>
                  <span className="muted">
                    {item.quantity} un. · {item.totalFormatted || brl(item.total)}
                  </span>
                </div>
                <code>{item.quantity}×</code>
              </li>
            ))}
          </ul>
        )}
      </Panel>
    </section>
  );
}
