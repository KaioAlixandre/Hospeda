import { Layers, Plus, Trash2 } from "lucide-react";
import { useCallback, useEffect, useState } from "react";
import { api } from "../api";
import {
  Badge,
  Button,
  EmptyState,
  Feedback,
  Field,
  Loading,
  Modal,
  Panel,
} from "../components/ui";
import { brl } from "../lib/format";
import type { Room, RoomType } from "../types";

const STATUS_OPTIONS = [
  { value: "", label: "Todos os status" },
  { value: "AVAILABLE", label: "Disponível" },
  { value: "RESERVED", label: "Reservado" },
  { value: "OCCUPIED", label: "Ocupado" },
  { value: "CLEANING", label: "Limpeza" },
  { value: "MAINTENANCE", label: "Manutenção" },
];

function splitList(value: string): string[] {
  return value
    .split(",")
    .map((item) => item.trim())
    .filter(Boolean);
}

export function RoomsPage() {
  const [rooms, setRooms] = useState<Room[]>([]);
  const [types, setTypes] = useState<RoomType[]>([]);
  const [statusFilter, setStatusFilter] = useState("");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [showRoomForm, setShowRoomForm] = useState(false);
  const [showTypeForm, setShowTypeForm] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const [roomList, typeList] = await Promise.all([
        api.rooms.list(statusFilter ? { status: statusFilter } : undefined),
        api.roomTypes.list(),
      ]);
      setRooms(roomList);
      setTypes(typeList);
      setError(null);
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setLoading(false);
    }
  }, [statusFilter]);

  useEffect(() => {
    void load();
  }, [load]);

  async function handleDelete(room: Room) {
    setError(null);
    try {
      await api.rooms.remove(room.id);
      setMessage(`Quarto ${room.number} removido.`);
      await load();
    } catch (err) {
      setError((err as Error).message);
    }
  }

  async function handleStatusChange(room: Room, status: string) {
    setError(null);
    try {
      await api.rooms.update(room.id, { status });
      await load();
    } catch (err) {
      setError((err as Error).message);
    }
  }

  return (
    <section className="page">
      <header className="page-header">
        <div>
          <p className="eyebrow">Cadastro</p>
          <h1>Quartos</h1>
        </div>
        <div className="header-actions">
          <Button icon={<Layers size={16} />} onClick={() => setShowTypeForm(true)}>
            Novo tipo
          </Button>
          <Button
            variant="primary"
            icon={<Plus size={16} />}
            onClick={() => setShowRoomForm(true)}
            disabled={types.length === 0}
          >
            Novo quarto
          </Button>
        </div>
      </header>

      <Feedback error={error} message={message} />

      <Panel title="Tipos de quarto">
        {types.length === 0 ? (
          <EmptyState message="Cadastre um tipo (solteiro, casal, família) antes dos quartos." />
        ) : (
          <div className="type-grid">
            {types.map((type) => (
              <article key={type.id} className="type-card">
                <header>
                  <strong>{type.name}</strong>
                  <span>{brl(type.dailyPrice)}/diária</span>
                </header>
                <p className="muted">{type.description ?? "Sem descrição"}</p>
                <footer>
                  <span>Capacidade {type.capacity}</span>
                  <span>{type.roomsCount ?? 0} quartos</span>
                </footer>
                {type.amenities.length > 0 ? (
                  <ul className="chips">
                    {type.amenities.map((item) => (
                      <li key={item}>{item}</li>
                    ))}
                  </ul>
                ) : null}
              </article>
            ))}
          </div>
        )}
      </Panel>

      <Panel
        title="Quartos"
        action={
          <select
            value={statusFilter}
            onChange={(event) => setStatusFilter(event.target.value)}
          >
            {STATUS_OPTIONS.map((option) => (
              <option key={option.value} value={option.value}>
                {option.label}
              </option>
            ))}
          </select>
        }
      >
        {loading ? (
          <Loading />
        ) : rooms.length === 0 ? (
          <EmptyState message="Nenhum quarto cadastrado." />
        ) : (
          <table className="table">
            <thead>
              <tr>
                <th>Número</th>
                <th>Tipo</th>
                <th>Andar</th>
                <th>Capacidade</th>
                <th>Diária</th>
                <th>Comodidades</th>
                <th>Status</th>
                <th />
              </tr>
            </thead>
            <tbody>
              {rooms.map((room) => (
                <tr key={room.id}>
                  <td>
                    <strong>{room.number}</strong>
                  </td>
                  <td>{room.type.name}</td>
                  <td>{room.floor ?? "—"}</td>
                  <td>{room.capacity}</td>
                  <td>{brl(room.dailyPrice)}</td>
                  <td className="muted">
                    {room.amenities.length > 0
                      ? room.amenities.join(", ")
                      : "—"}
                  </td>
                  <td>
                    <div className="cell-actions">
                      <Badge tone={room.statusColor} icon={room.statusIcon}>
                        {room.statusLabel}
                      </Badge>
                      <select
                        value={room.status}
                        onChange={(event) =>
                          handleStatusChange(room, event.target.value)
                        }
                      >
                        {STATUS_OPTIONS.filter((o) => o.value).map((option) => (
                          <option key={option.value} value={option.value}>
                            {option.label}
                          </option>
                        ))}
                      </select>
                    </div>
                  </td>
                  <td>
                    <Button
                      variant="danger"
                      icon={<Trash2 size={15} />}
                      onClick={() => handleDelete(room)}
                    >
                      Excluir
                    </Button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </Panel>

      {showTypeForm ? (
        <RoomTypeForm
          onClose={() => setShowTypeForm(false)}
          onSaved={async () => {
            setShowTypeForm(false);
            setMessage("Tipo de quarto cadastrado.");
            await load();
          }}
        />
      ) : null}

      {showRoomForm ? (
        <RoomForm
          types={types}
          onClose={() => setShowRoomForm(false)}
          onSaved={async () => {
            setShowRoomForm(false);
            setMessage("Quarto cadastrado.");
            await load();
          }}
        />
      ) : null}
    </section>
  );
}

function RoomTypeForm({
  onClose,
  onSaved,
}: {
  onClose: () => void;
  onSaved: () => Promise<void>;
}) {
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [capacity, setCapacity] = useState("2");
  const [basePrice, setBasePrice] = useState("");
  const [amenities, setAmenities] = useState("");
  const [photos, setPhotos] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  async function submit() {
    setSaving(true);
    setError(null);
    try {
      await api.roomTypes.create({
        name,
        description: description || undefined,
        capacity: Number(capacity),
        basePrice: Number(basePrice),
        amenities: splitList(amenities),
        photos: splitList(photos),
      });
      await onSaved();
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setSaving(false);
    }
  }

  return (
    <Modal title="Novo tipo de quarto" onClose={onClose}>
      <Feedback error={error} />
      <div className="form-grid">
        <Field label="Nome">
          <input
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="Casal"
          />
        </Field>
        <Field label="Capacidade">
          <input
            type="number"
            min={1}
            value={capacity}
            onChange={(e) => setCapacity(e.target.value)}
          />
        </Field>
        <Field label="Preço da diária (R$)">
          <input
            type="number"
            min={0}
            step="0.01"
            value={basePrice}
            onChange={(e) => setBasePrice(e.target.value)}
            placeholder="200"
          />
        </Field>
        <Field label="Descrição" hint="Opcional">
          <input
            value={description}
            onChange={(e) => setDescription(e.target.value)}
          />
        </Field>
        <Field label="Comodidades" hint="Separadas por vírgula">
          <input
            value={amenities}
            onChange={(e) => setAmenities(e.target.value)}
            placeholder="Wi-Fi, TV, Frigobar"
          />
        </Field>
        <Field label="Fotos (URLs)" hint="Separadas por vírgula">
          <input value={photos} onChange={(e) => setPhotos(e.target.value)} />
        </Field>
      </div>
      <footer className="modal-foot">
        <Button onClick={onClose}>Cancelar</Button>
        <Button variant="primary" loading={saving} onClick={submit}>
          Cadastrar tipo
        </Button>
      </footer>
    </Modal>
  );
}

function RoomForm({
  types,
  onClose,
  onSaved,
}: {
  types: RoomType[];
  onClose: () => void;
  onSaved: () => Promise<void>;
}) {
  const [number, setNumber] = useState("");
  const [floor, setFloor] = useState("");
  const [roomTypeId, setRoomTypeId] = useState(types[0]?.id ?? "");
  const [capacity, setCapacity] = useState("");
  const [dailyPrice, setDailyPrice] = useState("");
  const [amenities, setAmenities] = useState("");
  const [photos, setPhotos] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  async function submit() {
    setSaving(true);
    setError(null);
    try {
      await api.rooms.create({
        number,
        floor: floor ? Number(floor) : undefined,
        roomTypeId,
        capacity: capacity ? Number(capacity) : undefined,
        dailyPrice: dailyPrice ? Number(dailyPrice) : undefined,
        amenities: splitList(amenities),
        photos: splitList(photos),
      });
      await onSaved();
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setSaving(false);
    }
  }

  return (
    <Modal title="Novo quarto" onClose={onClose}>
      <Feedback error={error} />
      <div className="form-grid">
        <Field label="Número">
          <input
            value={number}
            onChange={(e) => setNumber(e.target.value)}
            placeholder="203"
          />
        </Field>
        <Field label="Andar" hint="Opcional">
          <input
            type="number"
            value={floor}
            onChange={(e) => setFloor(e.target.value)}
          />
        </Field>
        <Field label="Tipo">
          <select
            value={roomTypeId}
            onChange={(e) => setRoomTypeId(e.target.value)}
          >
            {types.map((type) => (
              <option key={type.id} value={type.id}>
                {type.name}
              </option>
            ))}
          </select>
        </Field>
        <Field label="Capacidade" hint="Vazio = usa a do tipo">
          <input
            type="number"
            min={1}
            value={capacity}
            onChange={(e) => setCapacity(e.target.value)}
          />
        </Field>
        <Field label="Diária (R$)" hint="Vazio = usa a do tipo">
          <input
            type="number"
            min={0}
            step="0.01"
            value={dailyPrice}
            onChange={(e) => setDailyPrice(e.target.value)}
          />
        </Field>
        <Field label="Comodidades extras" hint="Separadas por vírgula">
          <input
            value={amenities}
            onChange={(e) => setAmenities(e.target.value)}
            placeholder="Varanda"
          />
        </Field>
        <Field label="Fotos (URLs)" hint="Separadas por vírgula">
          <input value={photos} onChange={(e) => setPhotos(e.target.value)} />
        </Field>
      </div>
      <footer className="modal-foot">
        <Button onClick={onClose}>Cancelar</Button>
        <Button variant="primary" loading={saving} onClick={submit}>
          Cadastrar quarto
        </Button>
      </footer>
    </Modal>
  );
}
