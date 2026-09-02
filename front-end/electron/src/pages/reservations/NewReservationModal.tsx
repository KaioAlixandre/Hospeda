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
import type { Availability, Guest } from "../../types";

export function NewReservationModal({
  onClose,
  onCreated,
}: {
  onClose: () => void;
  onCreated: (message: string) => Promise<void>;
}) {
  const [guests, setGuests] = useState<Guest[]>([]);
  const [guestId, setGuestId] = useState("");
  const [checkInDate, setCheckInDate] = useState(todayISO());
  const [checkOutDate, setCheckOutDate] = useState(todayISO(1));
  const [guestCount, setGuestCount] = useState("2");
  const [notes, setNotes] = useState("");
  const [availability, setAvailability] = useState<Availability | null>(null);
  const [selectedOptionId, setSelectedOptionId] = useState("");
  const [confirmNow, setConfirmNow] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [searching, setSearching] = useState(false);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    api.guests
      .list()
      .then((guestList) => {
        setGuests(guestList);
        setGuestId(guestList[0]?.id ?? "");
      })
      .catch((err: Error) => setError(err.message));
  }, []);

  async function search() {
    const guestsNumber = Number(guestCount);
    if (!guestsNumber || guestsNumber < 1) {
      setError("Informe a quantidade de hóspedes.");
      return;
    }

    setSearching(true);
    setError(null);
    setSelectedOptionId("");
    try {
      const result = await api.availability({
        checkInDate,
        checkOutDate,
        guests: guestsNumber,
      });
      setAvailability(result);
      setSelectedOptionId(result.options[0]?.id ?? "");
    } catch (err) {
      setAvailability(null);
      setError((err as Error).message);
    } finally {
      setSearching(false);
    }
  }

  async function submit() {
    const guestsNumber = Number(guestCount);
    const selectedOption = availability?.options.find(
      (option) => option.id === selectedOptionId,
    );

    if (!selectedOption) {
      setError("Selecione uma opção de quarto na busca de disponibilidade.");
      return;
    }

    setSaving(true);
    setError(null);
    try {
      const reservation = await api.reservations.create({
        guestId,
        roomIds: selectedOption.roomIds,
        checkInDate,
        checkOutDate,
        guests: guestsNumber,
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

  const canSubmit = Boolean(
    guestId &&
      checkInDate &&
      checkOutDate &&
      selectedOptionId &&
      Number(guestCount) > 0,
  );

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

      {searching ? <Loading label="Buscando combinações de quartos…" /> : null}

      {availability ? (
        availability.options.length === 0 ? (
          <EmptyState message="Nenhuma combinação de quartos disponível para o período informado." />
        ) : (
          <div className="option-list">
            {availability.options.map((option) => (
              <label
                key={option.id}
                className={
                  selectedOptionId === option.id
                    ? "option-card selected"
                    : "option-card"
                }
              >
                <input
                  type="radio"
                  name="room-option"
                  checked={selectedOptionId === option.id}
                  onChange={() => setSelectedOptionId(option.id)}
                />
                <div>
                  <strong>{option.label}</strong>
                  <span className="muted block">{option.description}</span>
                  <span className="muted">
                    {option.periodLabel} · {option.totalCapacity} lugares
                  </span>
                </div>
                <div className="option-price">
                  <strong>{brl(option.total)}</strong>
                  <span className="muted">
                    até {option.nights} × {brl(option.totalNightlyRate)}
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
