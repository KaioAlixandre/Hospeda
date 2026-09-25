import { type FormEvent, useState } from "react";
import { Link, useNavigate, useParams, useSearchParams } from "react-router-dom";
import { api } from "../api";
import {
  ErrorBanner,
  HotelBrand,
  StayDesckFooter,
  LoadingBlock,
} from "../components/HotelBrand";
import { useHotel } from "../hooks/useHotel";
import { dateBR } from "../lib/format";

export function ReservePage() {
  const { slug = "", roomTypeId = "" } = useParams();
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const hotelState = useHotel(slug);

  const checkIn = searchParams.get("checkIn") ?? "";
  const checkOut = searchParams.get("checkOut") ?? "";
  const guests = Number(searchParams.get("guests") || 1);

  const [name, setName] = useState("");
  const [phone, setPhone] = useState("");
  const [email, setEmail] = useState("");
  const [city, setCity] = useState("");
  const [website, setWebsite] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function submit(event: FormEvent) {
    event.preventDefault();
    setError(null);

    if (!checkIn || !checkOut || !roomTypeId) {
      setError("Datas ou tipo de quarto inválidos.");
      return;
    }
    if (!name.trim() || !phone.trim()) {
      setError("Nome e telefone são obrigatórios.");
      return;
    }

    setBusy(true);
    try {
      const result = await api.reserve(slug, {
        checkInDate: checkIn,
        checkOutDate: checkOut,
        guests,
        roomTypeId,
        guest: {
          name: name.trim(),
          phone: phone.trim(),
          ...(email.trim() ? { email: email.trim() } : {}),
          ...(city.trim() ? { city: city.trim() } : {}),
        },
        ...(website ? { website } : {}),
      });
      void navigate(`/h/${slug}/pronto/${encodeURIComponent(result.code)}`);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Falha ao enviar pedido.");
    } finally {
      setBusy(false);
    }
  }

  if (hotelState.status === "loading") {
    return (
      <main className="page page-centered">
        <LoadingBlock />
      </main>
    );
  }

  if (hotelState.status === "error") {
    return (
      <main className="page page-centered">
        <ErrorBanner message={hotelState.error} />
        <StayDesckFooter />
      </main>
    );
  }

  return (
    <main className="page reserve-page">
      <div className="page-inner">
        <Link
          className="back-link"
          to={`/h/${slug}/quartos?${new URLSearchParams({
            checkIn,
            checkOut,
            guests: String(guests),
          })}`}
        >
          ← Voltar aos quartos
        </Link>
        <HotelBrand hotel={hotelState.hotel} compact />
        <h2 className="section-title">Seus dados</h2>
        <p className="muted period-label">
          {checkIn && checkOut
            ? `${dateBR(checkIn)} → ${dateBR(checkOut)} · ${guests} hóspede${guests === 1 ? "" : "s"}`
            : null}
        </p>

        <Feedback error={error} />

        <form className="guest-form" onSubmit={(e) => void submit(e)}>
          <label className="field">
            <span>Nome completo</span>
            <input
              value={name}
              onChange={(e) => setName(e.target.value)}
              required
              autoComplete="name"
              placeholder="Como no documento"
            />
          </label>
          <label className="field">
            <span>Telefone (WhatsApp)</span>
            <input
              value={phone}
              onChange={(e) => setPhone(e.target.value)}
              required
              inputMode="tel"
              autoComplete="tel"
              placeholder="11999999999"
            />
          </label>
          <label className="field">
            <span>
              E-mail <em className="optional">(opcional)</em>
            </span>
            <input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              autoComplete="email"
              placeholder="seu@email.com"
            />
          </label>
          <label className="field">
            <span>
              Cidade <em className="optional">(opcional)</em>
            </span>
            <input
              value={city}
              onChange={(e) => setCity(e.target.value)}
              autoComplete="address-level2"
            />
          </label>

          {/* Honeypot — oculto para humanos */}
          <label className="hp-field" aria-hidden="true">
            <span>Website</span>
            <input
              tabIndex={-1}
              autoComplete="off"
              value={website}
              onChange={(e) => setWebsite(e.target.value)}
            />
          </label>

          <button
            type="submit"
            className="btn btn-primary btn-block"
            disabled={busy}
          >
            {busy ? "Enviando…" : "Enviar pedido de reserva"}
          </button>
        </form>

        <p className="muted fine-print">
          O envio cria um pedido pendente. A confirmação é feita pelo hotel.
        </p>
        <StayDesckFooter />
      </div>
    </main>
  );
}

function Feedback({ error }: { error: string | null }) {
  if (!error) return null;
  return <ErrorBanner message={error} />;
}
