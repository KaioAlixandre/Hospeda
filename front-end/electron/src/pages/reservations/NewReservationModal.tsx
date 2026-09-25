import { CalendarSearch, Check, Percent, Search, User } from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { api } from "../../api";
import {
  Button,
  EmptyState,
  Feedback,
  Field,
  Loading,
  Modal,
} from "../../components/ui";
import { brl, cpfMask, notificationFeedback, todayISO } from "../../lib/format";
import type { Availability, AvailabilitySelection, Guest } from "../../types";
import { GuestPickerModal } from "./GuestPickerModal";

function roundMoney(value: number) {
  return Math.round(value * 100) / 100;
}

export function NewReservationModal({
  onClose,
  onCreated,
}: {
  onClose: () => void;
  onCreated: (message: string) => Promise<void>;
}) {
  const [guests, setGuests] = useState<Guest[]>([]);
  const [guestId, setGuestId] = useState("");
  const [pickerOpen, setPickerOpen] = useState(false);
  const [checkInDate, setCheckInDate] = useState(todayISO());
  const [checkOutDate, setCheckOutDate] = useState(todayISO(1));
  const [guestCount, setGuestCount] = useState("2");
  const [notes, setNotes] = useState("");
  const [availability, setAvailability] = useState<Availability | null>(null);
  const [selectedOptionId, setSelectedOptionId] = useState("");
  const [nightlyRateInput, setNightlyRateInput] = useState("");
  const [discountPercentInput, setDiscountPercentInput] = useState("");
  const [confirmNow, setConfirmNow] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [searching, setSearching] = useState(false);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    api.guests
      .list()
      .then((guestList) => {
        setGuests(guestList);
      })
      .catch((err: Error) => setError(err.message));
  }, []);

  const selectedGuest = useMemo(
    () => guests.find((guest) => guest.id === guestId) ?? null,
    [guests, guestId],
  );

  const selectedOption = useMemo(
    () =>
      availability?.options.find((option) => option.id === selectedOptionId) ??
      null,
    [availability, selectedOptionId],
  );

  function applyOptionRates(option: AvailabilitySelection | null) {
    if (!option) {
      setNightlyRateInput("");
      setDiscountPercentInput("");
      return;
    }
    setNightlyRateInput(String(option.totalNightlyRate));
    setDiscountPercentInput("");
  }

  function selectOption(optionId: string) {
    setSelectedOptionId(optionId);
    const option =
      availability?.options.find((entry) => entry.id === optionId) ?? null;
    applyOptionRates(option);
  }

  function onDiscountPercentChange(value: string) {
    setDiscountPercentInput(value);
    if (!selectedOption) return;
    const percent = Number(value);
    if (!value.trim() || !Number.isFinite(percent)) return;
    const clamped = Math.min(100, Math.max(0, percent));
    const discounted = roundMoney(
      selectedOption.totalNightlyRate * (1 - clamped / 100),
    );
    setNightlyRateInput(String(discounted));
  }

  function onNightlyRateChange(value: string) {
    setNightlyRateInput(value);
    if (!selectedOption) return;
    const rate = Number(value);
    if (!value.trim() || !Number.isFinite(rate) || rate < 0) {
      setDiscountPercentInput("");
      return;
    }
    const catalog = selectedOption.totalNightlyRate;
    if (catalog <= 0) {
      setDiscountPercentInput(rate === 0 ? "100" : "0");
      return;
    }
    const percent = roundMoney(((catalog - rate) / catalog) * 100);
    setDiscountPercentInput(
      percent > 0 ? String(Math.min(100, Math.max(0, percent))) : "",
    );
  }

  async function search() {
    const guestsNumber = Number(guestCount);
    if (!guestsNumber || guestsNumber < 1) {
      setError("Informe a quantidade de hóspedes.");
      return;
    }

    setSearching(true);
    setError(null);
    setSelectedOptionId("");
    applyOptionRates(null);
    try {
      const result = await api.availability({
        checkInDate,
        checkOutDate,
        guests: guestsNumber,
      });
      setAvailability(result);
      const first = result.options[0] ?? null;
      setSelectedOptionId(first?.id ?? "");
      applyOptionRates(first);
    } catch (err) {
      setAvailability(null);
      setError((err as Error).message);
    } finally {
      setSearching(false);
    }
  }

  async function submit() {
    const guestsNumber = Number(guestCount);

    if (!selectedOption) {
      setError("Selecione uma opção de quarto na busca de disponibilidade.");
      return;
    }

    const catalogRate = selectedOption.totalNightlyRate;
    const negotiatedRate = Number(nightlyRateInput);
    if (!Number.isFinite(negotiatedRate) || negotiatedRate < 0) {
      setError("Informe um valor válido para a diária.");
      return;
    }
    if (negotiatedRate > catalogRate) {
      setError(
        `A diária negociada não pode ser maior que ${brl(catalogRate)}.`,
      );
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
        nightlyRate:
          negotiatedRate === catalogRate ? undefined : negotiatedRate,
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

  const catalogRate = selectedOption?.totalNightlyRate ?? 0;
  const negotiatedRate = Number(nightlyRateInput);
  const hasValidNegotiated =
    Number.isFinite(negotiatedRate) && negotiatedRate >= 0;
  const nights = selectedOption?.nights ?? 0;
  const estimatedTotal = hasValidNegotiated
    ? roundMoney(negotiatedRate * nights)
    : selectedOption?.total ?? 0;
  const hasDiscount =
    hasValidNegotiated && catalogRate > 0 && negotiatedRate < catalogRate;
  const discountAmount = hasDiscount
    ? roundMoney(catalogRate - negotiatedRate)
    : 0;

  return (
    <Modal wide title="Nova reserva" onClose={onClose}>
      <Feedback error={error} />

      <section className="modal-section">
        <h3 className="modal-section-title">Dados da estadia</h3>
        <div className="form-grid">
          <div className="form-span">
            <Field label="Hóspede">
              <button
                type="button"
                className="guest-picker-trigger"
                onClick={() => setPickerOpen(true)}
              >
                <span className="guest-picker-avatar">
                  <User size={16} />
                </span>
                <span className="guest-picker-info">
                  {selectedGuest ? (
                    <>
                      <strong>{selectedGuest.name}</strong>
                      <span className="muted">
                        {[
                          selectedGuest.phone,
                          selectedGuest.cpf
                            ? `CPF ${cpfMask(selectedGuest.cpf)}`
                            : null,
                        ]
                          .filter(Boolean)
                          .join(" · ")}
                      </span>
                    </>
                  ) : (
                    <>
                      <strong>Selecionar ou cadastrar hóspede</strong>
                      <span className="muted">Buscar por nome ou telefone</span>
                    </>
                  )}
                </span>
                <Search size={16} className="guest-picker-trigger-icon" />
              </button>
            </Field>
          </div>
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
          <div className="form-span">
            <Field label="Observações" hint="Opcional">
              <input value={notes} onChange={(e) => setNotes(e.target.value)} />
            </Field>
          </div>
        </div>
      </section>

      <section className="modal-section">
        <h3 className="modal-section-title">Disponibilidade</h3>
        <div className="availability-toolbar">
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
              {availability.options.map((option) => {
                const selected = selectedOptionId === option.id;
                return (
                  <div key={option.id} className="option-block">
                    <label
                      className={
                        selected ? "option-card selected" : "option-card"
                      }
                    >
                      <input
                        type="radio"
                        name="room-option"
                        className="sr-only"
                        checked={selected}
                        onChange={() => selectOption(option.id)}
                      />
                      <span className="option-check">
                        <Check size={12} />
                      </span>
                      <div>
                        <strong>{option.label}</strong>
                        <span className="muted block">{option.description}</span>
                        <span className="muted">
                          {option.periodLabel} · {option.totalCapacity} lugares
                        </span>
                      </div>
                      <div className="option-price">
                        <strong>
                          {selected && hasDiscount
                            ? brl(estimatedTotal)
                            : brl(option.total)}
                        </strong>
                        <span className="muted">
                          {selected && hasDiscount
                            ? `até ${option.nights} × ${brl(negotiatedRate)}`
                            : `até ${option.nights} × ${brl(option.totalNightlyRate)}`}
                        </span>
                      </div>
                    </label>

                    {selected ? (
                      <div className="rate-discount-card">
                        <div className="rate-discount-head">
                          <Percent size={16} />
                          <div>
                            <strong>Desconto na diária</strong>
                            <p className="muted">
                              Opcional — sobre {brl(option.totalNightlyRate)} /
                              diária.
                            </p>
                          </div>
                        </div>

                        <div className="form-grid rate-discount-grid">
                          <Field label="Desconto (%)">
                            <input
                              type="number"
                              min={0}
                              max={100}
                              step={0.1}
                              placeholder="0"
                              value={discountPercentInput}
                              onChange={(e) =>
                                onDiscountPercentChange(e.target.value)
                              }
                            />
                          </Field>
                          <Field label="Diária negociada (R$)">
                            <input
                              type="number"
                              min={0}
                              max={option.totalNightlyRate}
                              step={0.01}
                              value={nightlyRateInput}
                              onChange={(e) =>
                                onNightlyRateChange(e.target.value)
                              }
                            />
                          </Field>
                        </div>

                        <div className="rate-discount-summary">
                          <div>
                            <span className="muted">Diária original</span>
                            <strong
                              className={hasDiscount ? "rate-was" : undefined}
                            >
                              {brl(option.totalNightlyRate)}
                            </strong>
                          </div>
                          {hasDiscount ? (
                            <div>
                              <span className="muted">Desconto / diária</span>
                              <strong className="rate-save">
                                −{brl(discountAmount)}
                              </strong>
                            </div>
                          ) : null}
                          <div>
                            <span className="muted">
                              Total estimado ({option.nights} diária
                              {option.nights === 1 ? "" : "s"})
                            </span>
                            <strong>{brl(estimatedTotal)}</strong>
                          </div>
                        </div>
                      </div>
                    ) : null}
                  </div>
                );
              })}
            </div>
          )
        ) : null}
      </section>

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

      {pickerOpen ? (
        <GuestPickerModal
          selectedId={guestId || undefined}
          onClose={() => setPickerOpen(false)}
          onSelect={(guest) => {
            setGuestId(guest.id);
            setGuests((prev) =>
              prev.some((g) => g.id === guest.id) ? prev : [...prev, guest],
            );
            setPickerOpen(false);
          }}
        />
      ) : null}
    </Modal>
  );
}
