import { Search, User } from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { api } from "../../api";
import { Button, EmptyState, Loading, Modal } from "../../components/ui";
import { cpfMask } from "../../lib/format";
import type { Guest } from "../../types";

export function GuestPickerModal({
  selectedId,
  onSelect,
  onClose,
}: {
  selectedId?: string;
  onSelect: (guest: Guest) => void;
  onClose: () => void;
}) {
  const [guests, setGuests] = useState<Guest[]>([]);
  const [search, setSearch] = useState("");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    api.guests
      .list()
      .then((list) => {
        if (!cancelled) setGuests(list);
      })
      .catch((err: Error) => {
        if (!cancelled) setError(err.message);
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, []);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return guests;
    const digits = q.replace(/\D/g, "");
    return guests.filter((guest) => {
      const hay = [
        guest.name,
        guest.phone,
        guest.email,
        guest.cpf,
        guest.address.city,
      ]
        .filter(Boolean)
        .join(" ")
        .toLowerCase();
      if (hay.includes(q)) return true;
      if (digits && (guest.phone ?? "").replace(/\D/g, "").includes(digits)) {
        return true;
      }
      if (digits && (guest.cpf ?? "").replace(/\D/g, "").includes(digits)) {
        return true;
      }
      return false;
    });
  }, [guests, search]);

  return (
    <Modal title="Escolher hóspede" onClose={onClose} wide>
      <div className="guest-picker">
        <label className="guest-picker-search">
          <Search size={16} />
          <input
            autoFocus
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Buscar por nome, telefone, CPF ou e-mail…"
          />
        </label>

        {error ? <p className="muted">{error}</p> : null}
        {loading ? <Loading label="Carregando hóspedes…" /> : null}

        {!loading && filtered.length === 0 ? (
          <EmptyState
            message={
              search.trim()
                ? "Nenhum hóspede encontrado para esta busca."
                : "Cadastre um hóspede antes de criar reservas."
            }
          />
        ) : null}

        {!loading && filtered.length > 0 ? (
          <ul className="guest-picker-list">
            {filtered.map((guest) => {
              const selected = guest.id === selectedId;
              return (
                <li key={guest.id}>
                  <button
                    type="button"
                    className={
                      selected
                        ? "guest-picker-item selected"
                        : "guest-picker-item"
                    }
                    onClick={() => onSelect(guest)}
                  >
                    <span className="guest-picker-avatar">
                      <User size={16} />
                    </span>
                    <span className="guest-picker-info">
                      <strong>{guest.name}</strong>
                      <span className="muted">
                        {[
                          guest.phone,
                          guest.cpf ? `CPF ${cpfMask(guest.cpf)}` : null,
                          guest.email,
                        ]
                          .filter(Boolean)
                          .join(" · ") || "Sem contato"}
                      </span>
                    </span>
                  </button>
                </li>
              );
            })}
          </ul>
        ) : null}

        <footer className="modal-foot">
          <Button onClick={onClose}>Cancelar</Button>
        </footer>
      </div>
    </Modal>
  );
}
