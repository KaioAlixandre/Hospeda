import { CalendarSearch } from "lucide-react";
import { useEffect, useState } from "react";
import { api } from "../../api";
import {
  Button,
  EmptyState,
  Feedback,
  Field,
  Loading,
  Modal,
} from "../../components/ui";
import { brl, notificationFeedback, todayISO } from "../../lib/format";
import type { Availability, Guest, RoomType } from "../../types";

export function NewReservationModal({
  onClose,
  onCreated,
}: {
  onClose: () => void;
  onCreated: (message: string) => Promise<void>;
}) {
  const [guests, setGuests] = useState<Guest[]>([]);
  const [types, setTypes] = useState<RoomType[]>([]);
  const [guestId, setGuestId] = useState("");
  const [roomTypeId, setRoomTypeId] = useState("");
  const [checkInDate, setCheckInDate] = useState(todayISO());
  const [checkOutDate, setCheckOutDate] = useState(todayISO(1));
  const [guestCount, setGuestCount] = useState("2");
  const [notes, setNotes] = useState("");
  const [availability, setAvailability] = useState<Availability | null>(null);
  const [selectedRoomId, setSelectedRoomId] = useState("");
  const [confirmNow, setConfirmNow] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [searching, setSearching] = useState(false);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    Promise.all([api.guests.list(), api.roomTypes.list()])
      .then(([guestList, typeList]) => {
        setGuests(guestList);
        setTypes(typeList);
        setGuestId(guestList[0]?.id ?? "");
        setRoomTypeId(typeList[0]?.id ?? "");
      })
      .catch((err: Error) => setError(err.message));
  }, []);

  async function search() {
    setSearching(true);
    setError(null);
    setSelectedRoomId("");
    try {
      const result = await api.availability({
        checkInDate,
        checkOutDate,
        roomTypeId: roomTypeId || undefined,
        guests: Number(guestCount) || undefined,
      });
      setAvailability(result);
      setSelectedRoomId(result.options[0]?.room.id ?? "");
    } catch (err) {
      setAvailability(null);
      setError((err as Error).message);
    } finally {
      setSearching(false);
    }
  }

  async function submit() {
    setSaving(true);
    setError(null);
    try {
      const reservation = await api.reservations.create({
        guestId,
        roomTypeId,
        roomId: selectedRoomId || undefined,
        checkInDate,
        checkOutDate,
        guests: Number(guestCount),
        notes: notes || undefined,
        status: confirmNow ? "CONFIRMED" : "PENDING",
      });
      await onCreated(
        notificationFeedback(`Reserva ${reservation.code} criada.`, reservation),
      );
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setSaving(false);
    }
  }

  const canSubmit = Boolean(guestId && roomTypeId && checkInDate && checkOutDate);

  return (
    <Modal wide title="Nova reserva" onClose={onClose}>
      <Feedback error={error} />

      {guests.length === 0 ? (
        <EmptyState message="Cadastre um hóspede antes de criar reservas." />
      ) : null}

      <div className="form-grid">
        <Field label="Hóspede">
          <select value={guestId} onChange={(e) => setGuestId(e.target.value)}>
            {guests.map((guest) => (
              <option key={guest.id} value={guest.id}>
                {guest.name}
              </option>
            ))}
          </select>
        </Field>
        <Field label="Tipo de quarto">
          <select
            value={roomTypeId}
            onChange={(e) => setRoomTypeId(e.target.value)}
          >
            {types.map((type) => (
              <option key={type.id} value={type.id}>
                {type.name} · {brl(type.dailyPrice)}
              </option>
            ))}
          </select>
        </Field>
        <Field label="Data de entrada">
          <input
            type="date"
            value={checkInDate}
            onChange={(e) => setCheckInDate(e.target.value)}
          />
        </Field>
        <Field label="Data de saída">
          <input
            type="date"
            value={checkOutDate}
            onChange={(e) => setCheckOutDate(e.target.value)}
          />
        </Field>
        <Field label="Quantidade de hóspedes">
          <input
            type="number"
            min={1}
            value={guestCount}
            onChange={(e) => setGuestCount(e.target.value)}
          />
        </Field>
        <Field label="Observações" hint="Opcional">
          <input value={notes} onChange={(e) => setNotes(e.target.value)} />
        </Field>
      </div>

      <div className="inline-actions">
        <Button
          icon={<CalendarSearch size={16} />}
          onClick={search}
          loading={searching}
        >
          Verificar disponibilidade
        </Button>
        <label className="check">
          <input
            type="checkbox"
            checked={confirmNow}
            onChange={(e) => setConfirmNow(e.target.checked)}
          />
          Confirmar imediatamente
        </label>
      </div>

      {searching ? <Loading label="Buscando quartos livres…" /> : null}

      {availability ? (
        availability.options.length === 0 ? (
          <EmptyState message="Nenhum quarto disponível para o período informado." />
        ) : (
          <div className="option-list">
            {availability.options.map((option) => (
              <label
                key={option.room.id}
                className={
                  selectedRoomId === option.room.id
                    ? "option-card selected"
                    : "option-card"
                }
              >
                <input
                  type="radio"
                  name="room"
                  checked={selectedRoomId === option.room.id}
                  onChange={() => setSelectedRoomId(option.room.id)}
                />
                <div>
                  <strong>{option.label}</strong>
                  <span className="muted">
                    {option.periodLabel} · capacidade {option.room.capacity}
                  </span>
                </div>
                <div className="option-price">
                  <strong>{brl(option.total)}</strong>
                  <span className="muted">
                    {option.nights} × {brl(option.nightlyRate)}
                  </span>
                </div>
              </label>
            ))}
          </div>
        )
      ) : null}

      <footer className="modal-foot">
        <Button onClick={onClose}>Cancelar</Button>
        <Button
          variant="primary"
          loading={saving}
          disabled={!canSubmit}
          onClick={submit}
        >
          Criar reserva
        </Button>
      </footer>
    </Modal>
  );
}
