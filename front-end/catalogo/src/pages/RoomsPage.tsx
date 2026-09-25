import { useEffect, useMemo, useState } from "react";
import { Link, useNavigate, useParams, useSearchParams } from "react-router-dom";
import {
  api,
  type AvailabilityOption,
  type PublicRoomType,
} from "../api";
import {
  ErrorBanner,
  HotelBrand,
  StayDesckFooter,
  LoadingBlock,
} from "../components/HotelBrand";
import { SearchForm, type SearchValues } from "../components/SearchForm";
import { useHotel } from "../hooks/useHotel";
import { brl, dateBR } from "../lib/format";

type EnrichedOption = AvailabilityOption & {
  photos: string[];
  description: string | null;
  amenities: string[];
};

export function RoomsPage() {
  const { slug = "" } = useParams();
  const [searchParams, setSearchParams] = useSearchParams();
  const navigate = useNavigate();
  const hotelState = useHotel(slug);

  const checkIn = searchParams.get("checkIn") ?? "";
  const checkOut = searchParams.get("checkOut") ?? "";
  const guests = Number(searchParams.get("guests") || 1);

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [options, setOptions] = useState<EnrichedOption[]>([]);
  const [nights, setNights] = useState(0);

  const paramsOk = Boolean(checkIn && checkOut && guests >= 1);

  useEffect(() => {
    if (!slug || !paramsOk) {
      setLoading(false);
      setError("Informe check-in, check-out e hóspedes.");
      return;
    }

    let cancelled = false;
    setLoading(true);
    setError(null);

    void Promise.all([
      api.availability(slug, { checkIn, checkOut, guests }),
      api.rooms(slug),
    ])
      .then(([availability, roomsRes]) => {
        if (cancelled) return;
        const byId = new Map<string, PublicRoomType>(
          roomsRes.rooms.map((r) => [r.id, r]),
        );
        const enriched: EnrichedOption[] = availability.options.map((opt) => {
          const room = byId.get(opt.roomTypeId);
          return {
            ...opt,
            photos: room?.photos ?? [],
            description: room?.description ?? null,
            amenities: room?.amenities ?? [],
          };
        });
        setOptions(enriched);
        setNights(availability.nights);
      })
      .catch((err: unknown) => {
        if (cancelled) return;
        setOptions([]);
        setError(
          err instanceof Error ? err.message : "Não foi possível carregar.",
        );
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });

    return () => {
      cancelled = true;
    };
  }, [slug, checkIn, checkOut, guests, paramsOk]);

  const periodLabel = useMemo(() => {
    if (!checkIn || !checkOut) return null;
    return `${dateBR(checkIn)} → ${dateBR(checkOut)} · ${guests} hóspede${guests === 1 ? "" : "s"}`;
  }, [checkIn, checkOut, guests]);

  function updateSearch(values: SearchValues) {
    setSearchParams({
      checkIn: values.checkIn,
      checkOut: values.checkOut,
      guests: String(values.guests),
    });
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
    <main className="page rooms-page">
      <div className="page-inner">
        <Link className="back-link" to={`/h/${slug}`}>
          ← Voltar
        </Link>
        <HotelBrand hotel={hotelState.hotel} compact />
        {periodLabel ? <p className="period-label">{periodLabel}</p> : null}

        <details className="search-details">
          <summary>Alterar datas</summary>
          <SearchForm
            initial={{ checkIn, checkOut, guests }}
            submitLabel="Atualizar"
            onSubmit={updateSearch}
          />
        </details>

        {loading ? <LoadingBlock label="Buscando disponibilidade…" /> : null}
        {error && !loading ? <ErrorBanner message={error} /> : null}

        {!loading && !error && options.length === 0 ? (
          <div className="empty-state">
            <p>Nenhum quarto disponível para estas datas.</p>
            <p className="muted">Tente outras datas ou fale com o hotel.</p>
          </div>
        ) : null}

        <ul className="room-list">
          {options.map((opt) => {
            const photo = opt.photos[0];
            return (
              <li key={opt.roomTypeId} className="room-card">
                <div
                  className={`room-photo ${photo ? "" : "empty"}`}
                  style={
                    photo
                      ? { backgroundImage: `url(${photo})` }
                      : undefined
                  }
                  role="img"
                  aria-label={opt.roomTypeName}
                />
                <div className="room-body">
                  <h2>{opt.roomTypeName}</h2>
                  <p className="muted">
                    Até {opt.capacity} hóspede{opt.capacity === 1 ? "" : "s"}
                    {nights ? ` · ${nights} noite${nights === 1 ? "" : "s"}` : ""}
                  </p>
                  {opt.description ? (
                    <p className="room-desc">{opt.description}</p>
                  ) : null}
                  <div className="room-pricing">
                    <div>
                      <span className="price-label">Diária</span>
                      <span className="price-nightly">{brl(opt.nightlyRate)}</span>
                    </div>
                    <div className="price-total-wrap">
                      <span className="price-label">Total</span>
                      <strong className="price-total">{brl(opt.total)}</strong>
                    </div>
                  </div>
                  <button
                    type="button"
                    className="btn btn-primary btn-block"
                    onClick={() => {
                      const q = new URLSearchParams({
                        checkIn,
                        checkOut,
                        guests: String(guests),
                      });
                      void navigate(
                        `/h/${slug}/reservar/${opt.roomTypeId}?${q}`,
                      );
                    }}
                  >
                    Solicitar reserva
                  </button>
                </div>
              </li>
            );
          })}
        </ul>

        <StayDesckFooter />
      </div>
    </main>
  );
}
