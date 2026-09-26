import { CalendarDays } from "lucide-react";
import { type FormEvent, useEffect, useRef, useState } from "react";
import {
  brToISO,
  dateMaskBR,
  isoToBR,
  todayISO,
} from "../lib/format";

export type SearchValues = {
  checkIn: string;
  checkOut: string;
  guests: number;
};

type Props = {
  initial?: Partial<SearchValues>;
  submitLabel?: string;
  /** Empilha campos (ex.: card lateral estreito). */
  stacked?: boolean;
  onSubmit: (values: SearchValues) => void;
};

function DateField({
  label,
  valueBR,
  minISO,
  onChangeBR,
  onChangeISO,
}: {
  label: string;
  valueBR: string;
  minISO: string;
  onChangeBR: (br: string) => void;
  onChangeISO: (iso: string) => void;
}) {
  const pickerRef = useRef<HTMLInputElement>(null);
  const iso = brToISO(valueBR) ?? "";

  function openPicker() {
    const el = pickerRef.current;
    if (!el) return;
    try {
      if (typeof el.showPicker === "function") {
        el.showPicker();
      } else {
        el.click();
      }
    } catch {
      el.focus();
      el.click();
    }
  }

  return (
    <label className="field">
      <span>{label}</span>
      <div className="date-field">
        <input
          type="text"
          inputMode="numeric"
          placeholder="dd/mm/aaaa"
          autoComplete="off"
          value={valueBR}
          onChange={(e) => onChangeBR(dateMaskBR(e.target.value))}
          maxLength={10}
          required
        />
        <button
          type="button"
          className="date-field-btn"
          aria-label={`Escolher ${label.toLowerCase()}`}
          onClick={openPicker}
        >
          <CalendarDays size={18} strokeWidth={1.9} />
        </button>
        <input
          ref={pickerRef}
          className="date-field-native"
          type="date"
          value={iso}
          min={minISO}
          tabIndex={-1}
          aria-hidden
          onChange={(e) => {
            const next = e.target.value;
            if (!next) return;
            onChangeISO(next);
            onChangeBR(isoToBR(next));
          }}
        />
      </div>
    </label>
  );
}

export function SearchForm({
  initial,
  submitLabel = "Ver disponibilidade",
  stacked = false,
  onSubmit,
}: Props) {
  const [checkInBR, setCheckInBR] = useState(
    isoToBR(initial?.checkIn ?? todayISO(1)),
  );
  const [checkOutBR, setCheckOutBR] = useState(
    isoToBR(initial?.checkOut ?? todayISO(2)),
  );
  const [guests, setGuests] = useState(initial?.guests ?? 2);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (initial?.checkIn) setCheckInBR(isoToBR(initial.checkIn));
    if (initial?.checkOut) setCheckOutBR(isoToBR(initial.checkOut));
    if (initial?.guests) setGuests(initial.guests);
  }, [initial?.checkIn, initial?.checkOut, initial?.guests]);

  function handleSubmit(event: FormEvent) {
    event.preventDefault();
    setError(null);

    const checkIn = brToISO(checkInBR);
    const checkOut = brToISO(checkOutBR);
    const today = todayISO();

    if (!checkIn || !checkOut) {
      setError("Use datas no formato dd/mm/aaaa.");
      return;
    }
    if (checkIn < today) {
      setError("O check-in não pode ser no passado.");
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

  const checkInISO = brToISO(checkInBR);

  return (
    <form
      className={stacked ? "search-form search-form-stacked" : "search-form"}
      onSubmit={handleSubmit}
    >
      <DateField
        label="Check-in"
        valueBR={checkInBR}
        minISO={todayISO()}
        onChangeBR={setCheckInBR}
        onChangeISO={(iso) => {
          setCheckInBR(isoToBR(iso));
          const out = brToISO(checkOutBR);
          if (out && out <= iso) {
            const next = new Date(`${iso}T00:00:00.000Z`);
            next.setUTCDate(next.getUTCDate() + 1);
            setCheckOutBR(isoToBR(next.toISOString().slice(0, 10)));
          }
        }}
      />
      <DateField
        label="Check-out"
        valueBR={checkOutBR}
        minISO={checkInISO ?? todayISO(1)}
        onChangeBR={setCheckOutBR}
        onChangeISO={(iso) => setCheckOutBR(isoToBR(iso))}
      />
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
