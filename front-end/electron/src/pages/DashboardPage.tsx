import { RefreshCw } from "lucide-react";
import { useCallback, useEffect, useState } from "react";
import { api } from "../api";
import { API_BASE_URL } from "../config";
import { Button, EmptyState, Feedback, Icon, Loading, Panel } from "../components/ui";
import { dateBR } from "../lib/format";
import type { Dashboard, StaySummary } from "../types";

const ROOM_STATUS_META: Array<{ key: keyof Dashboard["roomStatus"]; label: string; icon: string; tone: string }> = [
  { key: "AVAILABLE", label: "Disponível", icon: "door-open", tone: "green" },
  { key: "OCCUPIED", label: "Ocupado", icon: "bed-double", tone: "red" },
  { key: "RESERVED", label: "Reservado", icon: "calendar-check", tone: "blue" },
  { key: "CLEANING", label: "Limpeza", icon: "spray-can", tone: "yellow" },
  { key: "MAINTENANCE", label: "Manutenção", icon: "wrench", tone: "gray" },
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

  if (loading && !data) return <Loading label="Carregando indicadores…" />;

  if (error && !data) {
    return (
      <section className="page">
        <h1>Dashboard</h1>
        <Feedback
          error={`${error}. Confirme se a API está acessível em ${API_BASE_URL}.`}
        />
        <Button variant="primary" icon={<RefreshCw size={16} />} onClick={load}>
          Tentar novamente
        </Button>
      </section>
    );
  }

  if (!data) return null;

  const cards = Object.values(data.cards);

  return (
    <section className="page">
      <header className="page-header">
        <div>
          <p className="eyebrow">Visão do dia</p>
          <h1>Dashboard</h1>
        </div>
        <div className="header-actions">
          <span className="muted">{dateBR(`${data.date}T00:00:00.000Z`)}</span>
          <Button icon={<RefreshCw size={16} />} onClick={load} loading={loading}>
            Atualizar
          </Button>
        </div>
      </header>

      <div className="metric-grid">
        {cards.map((card) => (
          <article key={card.label} className="metric-card">
            <span className="metric-icon">
              <Icon name={card.icon} />
            </span>
            <div>
              <p>{card.label}</p>
              <strong>{card.formatted ?? card.value}</strong>
            </div>
          </article>
        ))}
      </div>

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
    </section>
  );
}
