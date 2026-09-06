import {
  CalendarDays,
  ChevronDown,
  Layers,
  Pencil,
  Plus,
  Trash2,
  User,
  X,
} from "lucide-react";
import { useCallback, useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { api } from "../api";
import {
  Button,
  EmptyState,
  Feedback,
  Field,
  Loading,
  Modal,
  Panel,
} from "../components/ui";
import { brl, dateBR } from "../lib/format";
import type { Room, RoomStatus, RoomType, StaySummary } from "../types";

const STATUS_META: Array<{
  value: RoomStatus;
  label: string;
  tone: string;
}> = [
  { value: "AVAILABLE", label: "disponível", tone: "green" },
  { value: "OCCUPIED", label: "ocupado", tone: "red" },
  { value: "CLEANING", label: "em limpeza", tone: "yellow" },
  { value: "RESERVED", label: "reservado", tone: "blue" },
  { value: "MAINTENANCE", label: "bloqueado", tone: "gray" },
];

const STATUS_OPTIONS = [
  { value: "", label: "Todos os status" },
  ...STATUS_META.map((meta) => ({
    value: meta.value,
    label: meta.label.charAt(0).toUpperCase() + meta.label.slice(1),
  })),
];

const MAX_PHOTOS = 8;

function splitList(value: string): string[] {
  return value
    .split(",")
    .map((item) => item.trim())
    .filter(Boolean);
}

function PhotoPicker({
  urls,
  pending,
  onUrlsChange,
  onPendingChange,
  disabled,
}: {
  urls: string[];
  pending: File[];
  onUrlsChange: (urls: string[]) => void;
  onPendingChange: (files: File[]) => void;
  disabled?: boolean;
}) {
  const remaining = MAX_PHOTOS - urls.length - pending.length;

  function onPick(files: FileList | null) {
    if (!files?.length || remaining <= 0) return;
    const next = [...pending, ...Array.from(files)].slice(
      0,
      MAX_PHOTOS - urls.length,
    );
    onPendingChange(next);
  }

  return (
    <div className="photo-picker">
      <input
        type="file"
        accept="image/*"
        multiple
        disabled={disabled || remaining <= 0}
        onChange={(e) => {
          onPick(e.target.files);
          e.target.value = "";
        }}
      />
      <small>
        Até {MAX_PHOTOS} fotos · JPG/PNG/WebP · máx. 10MB cada
        {remaining < MAX_PHOTOS ? ` · ${remaining} restantes` : ""}
      </small>
      {(urls.length > 0 || pending.length > 0) && (
        <div className="photo-grid">
          {urls.map((url) => (
            <div key={url} className="photo-thumb">
              <img src={url} alt="" />
              <button
                type="button"
                className="photo-remove"
                disabled={disabled}
                aria-label="Remover foto"
                onClick={() => onUrlsChange(urls.filter((item) => item !== url))}
              >
                <X size={14} />
              </button>
            </div>
          ))}
          {pending.map((file, index) => (
            <div key={`${file.name}-${index}`} className="photo-thumb pending">
              <img src={URL.createObjectURL(file)} alt="" />
              <button
                type="button"
                className="photo-remove"
                disabled={disabled}
                aria-label="Remover foto"
                onClick={() =>
                  onPendingChange(pending.filter((_, i) => i !== index))
                }
              >
                <X size={14} />
              </button>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

async function resolvePhotos(
  existing: string[],
  pending: File[],
  folder: "hotel-rooms" | "hotel-room-types",
): Promise<string[]> {
  if (pending.length === 0) return existing;
  const { urls } = await api.uploads.images(pending, folder);
  return [...existing, ...urls];
}

export function RoomsPage() {
  const [rooms, setRooms] = useState<Room[]>([]);
  const [types, setTypes] = useState<RoomType[]>([]);
  const [staysByRoom, setStaysByRoom] = useState<Record<string, StaySummary>>(
    {},
  );
  const [statusFilter, setStatusFilter] = useState("");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [editingType, setEditingType] = useState<RoomType | null | "new">(null);
  const [editingRoom, setEditingRoom] = useState<Room | null | "new">(null);
  const [menuRoomId, setMenuRoomId] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const [roomList, typeList, dashboard] = await Promise.all([
        api.rooms.list(),
        api.roomTypes.list(),
        api.dashboard().catch(() => null),
      ]);
      setRooms(roomList);
      setTypes(typeList);

      const stays: Record<string, StaySummary> = {};
      for (const stay of dashboard?.today.guestsInHouse ?? []) {
        if (stay.roomNumber) stays[stay.roomNumber] = stay;
      }
      setStaysByRoom(stays);
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

  const summary = useMemo(() => {
    const counts: Record<RoomStatus, number> = {
      AVAILABLE: 0,
      OCCUPIED: 0,
      CLEANING: 0,
      RESERVED: 0,
      MAINTENANCE: 0,
    };
    for (const room of rooms) {
      counts[room.status] += 1;
    }
    return counts;
  }, [rooms]);

  const visibleRooms = useMemo(
    () =>
      statusFilter
        ? rooms.filter((room) => room.status === statusFilter)
        : rooms,
    [rooms, statusFilter],
  );

  async function handleDeleteRoom(room: Room) {
    if (!window.confirm(`Excluir o quarto ${room.number}?`)) return;
    setError(null);
    setMenuRoomId(null);
    try {
      await api.rooms.remove(room.id);
      setMessage(`Quarto ${room.number} removido.`);
      await load();
    } catch (err) {
      setError((err as Error).message);
    }
  }

  async function handleDeleteType(type: RoomType) {
    if (!window.confirm(`Excluir o tipo "${type.name}"?`)) return;
    setError(null);
    try {
      await api.roomTypes.remove(type.id);
      setMessage(`Tipo ${type.name} removido.`);
      await load();
    } catch (err) {
      setError((err as Error).message);
    }
  }

  async function handleStatusChange(room: Room, status: string) {
    setError(null);
    setMenuRoomId(null);
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
          <p className="eyebrow">Operação</p>
          <h1>Quartos</h1>
        </div>
        <div className="header-actions">
          <Button icon={<Layers size={16} />} onClick={() => setEditingType("new")}>
            Novo tipo
          </Button>
          <Button
            variant="primary"
            icon={<Plus size={16} />}
            onClick={() => setEditingRoom("new")}
            disabled={types.length === 0}
          >
            Novo quarto
          </Button>
        </div>
      </header>

      <Feedback error={error} message={message} />

      <div className="status-strip room-status-legend">
        <button
          type="button"
          className={`status-chip filter-chip${statusFilter === "" ? " active" : ""}`}
          onClick={() => setStatusFilter("")}
        >
          <span>todos</span>
          <strong>{rooms.length}</strong>
        </button>
        {STATUS_META.map((meta) => (
          <button
            type="button"
            key={meta.value}
            className={`status-chip filter-chip tone-${meta.tone}${
              statusFilter === meta.value ? " active" : ""
            }`}
            onClick={() =>
              setStatusFilter((current) =>
                current === meta.value ? "" : meta.value,
              )
            }
          >
            <span className="status-dot" />
            <span>{meta.label}</span>
            <strong>{summary[meta.value]}</strong>
          </button>
        ))}
      </div>

      <Panel title="Mapa de quartos">
        {loading ? (
          <Loading />
        ) : rooms.length === 0 ? (
          <EmptyState message="Nenhum quarto cadastrado." />
        ) : visibleRooms.length === 0 ? (
          <EmptyState message="Nenhum quarto neste status." />
        ) : (
          <div className="room-board-grid">
            {visibleRooms.map((room) => {
              const stay = staysByRoom[room.number];
              const menuOpen = menuRoomId === room.id;
              return (
                <article
                  key={room.id}
                  className={`room-board-card tone-${room.statusColor}`}
                >
                  <header className="room-board-head">
                    <strong>Quarto {room.number}</strong>
                    <button
                      type="button"
                      className="room-board-menu-btn"
                      aria-label="Ações do quarto"
                      aria-expanded={menuOpen}
                      onClick={() =>
                        setMenuRoomId((current) =>
                          current === room.id ? null : room.id,
                        )
                      }
                    >
                      <ChevronDown size={16} />
                    </button>
                    {menuOpen ? (
                      <div className="room-board-menu">
                        <button
                          type="button"
                          onClick={() => {
                            setMenuRoomId(null);
                            setEditingRoom(room);
                          }}
                        >
                          <Pencil size={14} /> Editar
                        </button>
                        <label className="room-board-menu-status">
                          Status
                          <select
                            value={room.status}
                            onChange={(event) =>
                              void handleStatusChange(room, event.target.value)
                            }
                          >
                            {STATUS_OPTIONS.filter((o) => o.value).map(
                              (option) => (
                                <option key={option.value} value={option.value}>
                                  {option.label}
                                </option>
                              ),
                            )}
                          </select>
                        </label>
                        <button
                          type="button"
                          className="danger"
                          onClick={() => void handleDeleteRoom(room)}
                        >
                          <Trash2 size={14} /> Excluir
                        </button>
                      </div>
                    ) : null}
                  </header>

                  <div className="room-board-body">
                    {stay ? (
                      <>
                        <p className="room-board-guest">
                          <User size={15} strokeWidth={1.9} />
                          <span>{stay.guestName}</span>
                        </p>
                        <p className="room-board-dates">
                          <CalendarDays size={15} strokeWidth={1.9} />
                          <span>
                            {dateBR(stay.checkInDate)} —{" "}
                            {dateBR(stay.checkOutDate)}
                          </span>
                        </p>
                      </>
                    ) : (
                      <p className="room-board-empty muted">
                        {room.type.name}
                        {room.floor !== null ? ` · ${room.floor}º andar` : ""}
                      </p>
                    )}

                    <div className="room-board-meta muted">
                      <span>{brl(room.dailyPrice)}/diária</span>
                      <span>{room.capacity} hóspedes</span>
                    </div>

                    <footer className="room-board-actions">
                      {room.status === "AVAILABLE" ? (
                        <Link className="room-board-cta" to="/reservations">
                          + hospedar
                        </Link>
                      ) : null}
                      {room.status === "OCCUPIED" ? (
                        <Link className="room-board-cta" to="/reservations">
                          ver reserva
                        </Link>
                      ) : null}
                      {room.status === "CLEANING" ? (
                        <button
                          type="button"
                          className="room-board-cta"
                          onClick={() =>
                            void handleStatusChange(room, "AVAILABLE")
                          }
                        >
                          liberar UH
                        </button>
                      ) : null}
                      {room.status === "MAINTENANCE" ? (
                        <button
                          type="button"
                          className="room-board-cta"
                          onClick={() =>
                            void handleStatusChange(room, "AVAILABLE")
                          }
                        >
                          liberar
                        </button>
                      ) : null}
                      {room.status === "RESERVED" ? (
                        <Link className="room-board-cta" to="/reservations">
                          ver reserva
                        </Link>
                      ) : null}
                    </footer>
                  </div>
                </article>
              );
            })}
          </div>
        )}
      </Panel>

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
                <div className="cell-actions spaced">
                  <Button
                    icon={<Pencil size={15} />}
                    onClick={() => setEditingType(type)}
                  >
                    Editar
                  </Button>
                  <Button
                    variant="danger"
                    icon={<Trash2 size={15} />}
                    onClick={() => void handleDeleteType(type)}
                  >
                    Excluir
                  </Button>
                </div>
              </article>
            ))}
          </div>
        )}
      </Panel>

      {editingType !== null ? (
        <RoomTypeForm
          initial={editingType === "new" ? null : editingType}
          onClose={() => setEditingType(null)}
          onSaved={async (feedback) => {
            setEditingType(null);
            setMessage(feedback);
            await load();
          }}
        />
      ) : null}

      {editingRoom !== null ? (
        <RoomForm
          types={types}
          initial={editingRoom === "new" ? null : editingRoom}
          onClose={() => setEditingRoom(null)}
          onSaved={async (feedback) => {
            setEditingRoom(null);
            setMessage(feedback);
            await load();
          }}
        />
      ) : null}
    </section>
  );
}

function RoomTypeForm({
  initial,
  onClose,
  onSaved,
}: {
  initial: RoomType | null;
  onClose: () => void;
  onSaved: (feedback: string) => Promise<void>;
}) {
  const [name, setName] = useState(initial?.name ?? "");
  const [description, setDescription] = useState(initial?.description ?? "");
  const [capacity, setCapacity] = useState(String(initial?.capacity ?? 2));
  const [basePrice, setBasePrice] = useState(
    initial ? String(initial.dailyPrice) : "",
  );
  const [amenities, setAmenities] = useState(
    initial?.amenities.join(", ") ?? "",
  );
  const [photoUrls, setPhotoUrls] = useState<string[]>(initial?.photos ?? []);
  const [pendingPhotos, setPendingPhotos] = useState<File[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  async function submit() {
    setSaving(true);
    setError(null);
    try {
      const photos = await resolvePhotos(
        photoUrls,
        pendingPhotos,
        "hotel-room-types",
      );
      const body = {
        name,
        description: description || undefined,
        capacity: Number(capacity),
        basePrice: Number(basePrice),
        amenities: splitList(amenities),
        photos,
      };
      if (initial) {
        await api.roomTypes.update(initial.id, body);
        await onSaved("Tipo de quarto atualizado.");
      } else {
        await api.roomTypes.create(body);
        await onSaved("Tipo de quarto cadastrado.");
      }
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setSaving(false);
    }
  }

  return (
    <Modal
      title={initial ? "Editar tipo de quarto" : "Novo tipo de quarto"}
      onClose={onClose}
    >
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
        <div className="field form-span">
          <span>Fotos</span>
          <PhotoPicker
            urls={photoUrls}
            pending={pendingPhotos}
            onUrlsChange={setPhotoUrls}
            onPendingChange={setPendingPhotos}
            disabled={saving}
          />
          <small>Hospedadas no Cloudinary</small>
        </div>
      </div>
      <footer className="modal-foot">
        <Button onClick={onClose}>Cancelar</Button>
        <Button
          variant="primary"
          loading={saving}
          disabled={!name.trim() || !basePrice}
          onClick={submit}
        >
          {initial ? "Salvar" : "Cadastrar tipo"}
        </Button>
      </footer>
    </Modal>
  );
}

function RoomForm({
  types,
  initial,
  onClose,
  onSaved,
}: {
  types: RoomType[];
  initial: Room | null;
  onClose: () => void;
  onSaved: (feedback: string) => Promise<void>;
}) {
  const [number, setNumber] = useState(initial?.number ?? "");
  const [floor, setFloor] = useState(
    initial?.floor !== null && initial?.floor !== undefined
      ? String(initial.floor)
      : "",
  );
  const [roomTypeId, setRoomTypeId] = useState(
    initial?.type.id ?? types[0]?.id ?? "",
  );
  const [capacity, setCapacity] = useState(
    initial ? String(initial.capacity) : "",
  );
  const [dailyPrice, setDailyPrice] = useState(
    initial ? String(initial.dailyPrice) : "",
  );
  const [amenities, setAmenities] = useState(
    initial?.amenities.join(", ") ?? "",
  );
  const [photoUrls, setPhotoUrls] = useState<string[]>(initial?.photos ?? []);
  const [pendingPhotos, setPendingPhotos] = useState<File[]>([]);
  const [status, setStatus] = useState(initial?.status ?? "AVAILABLE");
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  async function submit() {
    setSaving(true);
    setError(null);
    try {
      const photos = await resolvePhotos(
        photoUrls,
        pendingPhotos,
        "hotel-rooms",
      );
      const body = {
        number,
        floor: floor ? Number(floor) : undefined,
        roomTypeId,
        capacity: capacity ? Number(capacity) : undefined,
        dailyPrice: dailyPrice ? Number(dailyPrice) : undefined,
        amenities: splitList(amenities),
        photos,
        status,
      };
      if (initial) {
        await api.rooms.update(initial.id, body);
        await onSaved(`Quarto ${number} atualizado.`);
      } else {
        await api.rooms.create(body);
        await onSaved("Quarto cadastrado.");
      }
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setSaving(false);
    }
  }

  return (
    <Modal title={initial ? "Editar quarto" : "Novo quarto"} onClose={onClose}>
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
        <Field label="Status">
          <select value={status} onChange={(e) => setStatus(e.target.value)}>
            {STATUS_OPTIONS.filter((o) => o.value).map((option) => (
              <option key={option.value} value={option.value}>
                {option.label}
              </option>
            ))}
          </select>
        </Field>
        <Field label="Comodidades extras" hint="Separadas por vírgula">
          <input
            value={amenities}
            onChange={(e) => setAmenities(e.target.value)}
            placeholder="Varanda"
          />
        </Field>
        <div className="field form-span">
          <span>Fotos</span>
          <PhotoPicker
            urls={photoUrls}
            pending={pendingPhotos}
            onUrlsChange={setPhotoUrls}
            onPendingChange={setPendingPhotos}
            disabled={saving}
          />
          <small>Hospedadas no Cloudinary</small>
        </div>
      </div>
      <footer className="modal-foot">
        <Button onClick={onClose}>Cancelar</Button>
        <Button
          variant="primary"
          loading={saving}
          disabled={!number.trim() || !roomTypeId}
          onClick={submit}
        >
          {initial ? "Salvar" : "Cadastrar quarto"}
        </Button>
      </footer>
    </Modal>
  );
}
