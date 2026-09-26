import { useEffect, useState, type FormEvent } from "react";
import {
  Link,
  useNavigate,
  useParams,
  useSearchParams,
} from "react-router-dom";
import { api, type PublicRoomType, type ReservationSummary } from "../api";
import { GuestAuthPanel } from "../components/GuestAuthPanel";
import {
  ErrorBanner,
  HotelBrand,
  LoadingBlock,
  StayDesckFooter,
} from "../components/HotelBrand";
import { useCatalogAuth } from "../hooks/CatalogAuthContext";
import { useHotelContext } from "../hooks/HotelContext";
import { brl, dateBR, phoneMask } from "../lib/format";
import { cloudinaryUrl } from "../lib/images";

export function ReservePage() {
  const { slug = "", roomTypeId = "" } = useParams();
  const [params] = useSearchParams();
  const navigate = useNavigate();
  const hotelState = useHotelContext();
  const auth = useCatalogAuth();

  const checkIn = params.get("checkIn") ?? "";
  const checkOut = params.get("checkOut") ?? "";
  const [guests, setGuests] = useState(Number(params.get("guests") || 2));

  const [room, setRoom] = useState<PublicRoomType | null>(null);
  const [nights, setNights] = useState(0);
  const [nightlyRate, setNightlyRate] = useState(0);
  const [total, setTotal] = useState(0);
  const [available, setAvailable] = useState(true);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [name, setName] = useState("");
  const [phone, setPhone] = useState("");
  const [city, setCity] = useState("");
  const [website, setWebsite] = useState("");

  useEffect(() => {
    if (!auth.user) return;
    setName((current) => current || auth.user!.name);
    if (auth.user.phone) {
      setPhone((current) => current || phoneMask(auth.user!.phone!));
    }
  }, [auth.user]);

  useEffect(() => {
    if (!checkIn || !checkOut) {
      setError("Informe as datas da estadia.");
      setLoading(false);
      return;
    }
    let cancelled = false;
    setLoading(true);
    void api
      .roomType(slug, roomTypeId, { checkIn, checkOut, guests })
      .then((data) => {
        if (cancelled) return;
        setRoom(data.room);
        if (data.availability) {
          setAvailable(data.availability.available);
          setNights(data.availability.nights);
          setNightlyRate(data.availability.nightlyRate);
          setTotal(data.availability.total);
        }
        setError(
          data.availability?.available === false
            ? "Este quarto não está disponível nestas datas."
            : null,
        );
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
  }, [slug, roomTypeId, checkIn, checkOut, guests]);

  async function submit(event: FormEvent) {
    event.preventDefault();
    if (!available || !room || !auth.user) return;
    setSaving(true);
    setError(null);
    try {
      const result = await api.reserve(slug, {
        checkInDate: checkIn,
        checkOutDate: checkOut,
        guests,
        roomTypeId,
        guest: {
          name: name.trim() || auth.user.name,
          phone: phone.replace(/\D/g, "") || auth.user.phone || undefined,
          email: auth.user.email,
          city: city.trim() || undefined,
        },
        website: website || undefined,
      });

      const summary: ReservationSummary = {
        roomTypeId,
        roomName: room.name,
        photo: room.photos[0] ?? null,
        checkInDate: checkIn,
        checkOutDate: checkOut,
        guests,
        nights,
        nightlyRate,
        total: result.total || total,
      };

      navigate(`/h/${slug}/pronto/${result.code}`, { state: { summary } });
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setSaving(false);
    }
  }

  if (hotelState.status === "loading" || loading || auth.status === "loading") {
    return (
      <main className="page">
        <div className="page-inner page-narrow">
          <LoadingBlock label="Preparando reserva…" />
        </div>
      </main>
    );
  }

  if (hotelState.status === "error" || !hotelState.hotel) {
    return (
      <main className="page page-centered">
        <ErrorBanner message={hotelState.error ?? "Hotel não encontrado"} />
      </main>
    );
  }

  const detailHref = `/h/${slug}/quarto/${roomTypeId}?checkIn=${checkIn}&checkOut=${checkOut}&guests=${guests}`;
  const phoneDigits = phone.replace(/\D/g, "");
  const canSubmit =
    Boolean(auth.user) &&
    available &&
    name.trim().length > 0 &&
    phoneDigits.length >= 10;

  return (
    <main className="page reserve-page">
      <div className="page-inner page-narrow">
        <Link className="back-link" to={detailHref}>
          ← Voltar ao quarto
        </Link>
        <HotelBrand hotel={hotelState.hotel} compact />

        {room ? (
          <article className="reserve-summary">
            <div
              className={`room-photo compact ${room.photos[0] ? "" : "empty"}`}
              style={
                room.photos[0]
                  ? {
                      backgroundImage: `url(${cloudinaryUrl(room.photos[0], { w: 400 })})`,
                    }
                  : undefined
              }
            />
            <div>
              <h2>{room.name}</h2>
              <p className="muted">
                {dateBR(checkIn)} → {dateBR(checkOut)} · {nights} noite
                {nights === 1 ? "" : "s"} · {guests} hóspede
                {guests === 1 ? "" : "s"}
              </p>
              <p>
                {brl(nightlyRate)}/noite · <strong>{brl(total)}</strong>
              </p>
            </div>
          </article>
        ) : null}

        {error ? <ErrorBanner message={error} /> : null}

        <GuestAuthPanel />

        {auth.user ? (
          <form className="reserve-form" onSubmit={(e) => void submit(e)}>
            <label className="field">
              <span>Nome completo</span>
              <input
                value={name}
                onChange={(e) => setName(e.target.value)}
                required
                autoComplete="name"
              />
            </label>
            <label className="field">
              <span>WhatsApp</span>
              <input
                value={phone}
                onChange={(e) => setPhone(phoneMask(e.target.value))}
                inputMode="tel"
                placeholder="(11) 99999-9999"
                required
                autoComplete="tel"
              />
            </label>
            <label className="field">
              <span>Cidade (opcional)</span>
              <input
                value={city}
                onChange={(e) => setCity(e.target.value)}
                autoComplete="address-level2"
              />
            </label>

            <div className="field guests-stepper">
              <span>Hóspedes</span>
              <div className="stepper">
                <button
                  type="button"
                  onClick={() => setGuests((g) => Math.max(1, g - 1))}
                  aria-label="Diminuir"
                >
                  −
                </button>
                <strong>{guests}</strong>
                <button
                  type="button"
                  onClick={() => setGuests((g) => Math.min(20, g + 1))}
                  aria-label="Aumentar"
                >
                  +
                </button>
              </div>
            </div>

            <input
              className="hp"
              tabIndex={-1}
              autoComplete="off"
              value={website}
              onChange={(e) => setWebsite(e.target.value)}
              aria-hidden
            />

            <button
              type="submit"
              className="btn btn-primary btn-block"
              disabled={saving || !canSubmit}
            >
              {saving ? "Enviando…" : "Solicitar reserva"}
            </button>
          </form>
        ) : null}

        <StayDesckFooter />
      </div>
    </main>
  );
}
