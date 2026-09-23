import { type FormEvent, useState } from "react";
import { todayISO } from "../lib/format";

export type SearchValues = {
  checkIn: string;
  checkOut: string;
  guests: number;
};

type Props = {
  initial?: Partial<SearchValues>;
  submitLabel?: string;
  onSubmit: (values: SearchValues) => void;
};

export function SearchForm({
  initial,
  submitLabel = "Ver disponibilidade",
  onSubmit,
}: Props) {
  const [checkIn, setCheckIn] = useState(initial?.checkIn ?? todayISO(1));
  const [checkOut, setCheckOut] = useState(initial?.checkOut ?? todayISO(2));
  const [guests, setGuests] = useState(initial?.guests ?? 2);
  const [error, setError] = useState<string | null>(null);

  function handleSubmit(event: FormEvent) {
    event.preventDefault();
    setError(null);

    if (!checkIn || !checkOut) {
      setError("Informe check-in e check-out.");
      return;
    }
    if (checkOut <= checkIn) {
      setError("O check-out deve ser depois do check-in.");
      return;
    }
    if (guests < 1) {
      setError("Informe ao menos 1 hóspede.");
      return;
    }

    onSubmit({ checkIn, checkOut, guests });
  }

  return (
    <form className="search-form" onSubmit={handleSubmit}>
      <label className="field">
        <span>Check-in</span>
        <input
          type="date"
          value={checkIn}
          min={todayISO()}
          onChange={(e) => setCheckIn(e.target.value)}
          required
        />
      </label>
      <label className="field">
        <span>Check-out</span>
        <input
          type="date"
          value={checkOut}
          min={checkIn || todayISO(1)}
          onChange={(e) => setCheckOut(e.target.value)}
          required
        />
      </label>
      <label className="field">
        <span>Hóspedes</span>
        <input
          type="number"
          min={1}
          max={20}
          value={guests}
          onChange={(e) => setGuests(Number(e.target.value) || 1)}
          required
        />
      </label>
      {error ? <p className="field-error">{error}</p> : null}
      <button type="submit" className="btn btn-primary btn-block">
        {submitLabel}
      </button>
    </form>
  );
}
