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
  LoadingBlock,
  StayDesckFooter,
} from "../components/HotelBrand";
import { SearchForm } from "../components/SearchForm";
import { useHotelContext } from "../hooks/HotelContext";
import { brl, periodShort } from "../lib/format";
import { cloudinaryUrl } from "../lib/images";

type Enriched = AvailabilityOption & {
  photos: string[];
  amenities: string[];
  description: string | null;
};

export function RoomsPage() {
  const { slug = "" } = useParams();
  const [params] = useSearchParams();
  const navigate = useNavigate();
  const hotelState = useHotelContext();

  const checkIn = params.get("checkIn") ?? "";
  const checkOut = params.get("checkOut") ?? "";
  const guests = Number(params.get("guests") || 2);
  const hasSearch = Boolean(checkIn && checkOut);

  const [options, setOptions] = useState<Enriched[]>([]);
  const [catalogRooms, setCatalogRooms] = useState<PublicRoomType[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [editing, setEditing] = useState(false);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);

    const load = async () => {
      try {
        const roomsRes = await api.rooms(slug);
        if (cancelled) return;
        setCatalogRooms(roomsRes.rooms);

        if (!hasSearch) {
          setOptions([]);
          setError(null);
          return;
        }

        const avail = await api.availability(slug, {
          checkIn,
          checkOut,
          guests,
        });
        if (cancelled) return;

        const byId = new Map(roomsRes.rooms.map((r) => [r.id, r]));
        setOptions(
          avail.options.map((opt) => {
            const meta = byId.get(opt.roomTypeId);
            return {
              ...opt,
              photos: meta?.photos ?? [],
              amenities: meta?.amenities ?? [],
              description: meta?.description ?? null,
            };
          }),
        );
        setError(null);
      } catch (err) {
        if (!cancelled) setError((err as Error).message);
      } finally {
        if (!cancelled) setLoading(false);
      }
    };

    void load();
    return () => {
      cancelled = true;
    };
  }, [slug, checkIn, checkOut, guests, hasSearch]);

  const list = useMemo(() => {
    if (hasSearch) return options;
    return catalogRooms.map(
      (room): Enriched => ({
        roomTypeId: room.id,
        roomTypeName: room.name,
        capacity: room.capacity,
        nightlyRate: room.priceFrom,
        nights: 0,
        total: 0,
        photos: room.photos,
        amenities: room.amenities,
        description: room.description,
      }),
    );
  }, [hasSearch, options, catalogRooms]);

  if (hotelState.status === "loading") {
    return (
      <main className="page">
        <div className="page-inner page-wide">
          <LoadingBlock />
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

  return (
    <main className="page rooms-page">
      <div className="page-inner page-wide">
        <Link className="back-link" to={`/h/${slug}`}>
          ← Início
        </Link>
        <HotelBrand hotel={hotelState.hotel} compact />

        {hasSearch ? (
          <div className="search-summary">
            <span>
              {periodShort(checkIn, checkOut)} · {guests} hóspede
              {guests === 1 ? "" : "s"}
            </span>
            <button
              type="button"
              className="linkish"
              onClick={() => setEditing((v) => !v)}
            >
              Alterar
            </button>
          </div>
        ) : (
          <p className="muted">
            Escolha um quarto para ver detalhes, ou busque por datas.
          </p>
        )}

        {(editing || !hasSearch) && (
          <SearchForm
            initial={{
              checkIn: checkIn || undefined,
              checkOut: checkOut || undefined,
              guests,
            }}
            submitLabel="Buscar"
            onSubmit={(values) => {
              setEditing(false);
              navigate(
                `/h/${slug}/quartos?checkIn=${values.checkIn}&checkOut=${values.checkOut}&guests=${values.guests}`,
              );
            }}
          />
        )}

        {error ? <ErrorBanner message={error} /> : null}

        {loading ? (
          <div className="room-grid">
            <div className="skeleton room-card-skeleton" />
            <div className="skeleton room-card-skeleton" />
          </div>
        ) : list.length === 0 ? (
          <p className="muted">
            {hasSearch
              ? "Nenhum quarto disponível para estas datas."
              : "Nenhum quarto publicado."}
          </p>
        ) : (
          <div className="room-grid">
            {list.map((opt) => {
              const photo = opt.photos[0];
              const detailQs = new URLSearchParams();
              if (checkIn) detailQs.set("checkIn", checkIn);
              if (checkOut) detailQs.set("checkOut", checkOut);
              if (guests) detailQs.set("guests", String(guests));
              const detailHref = `/h/${slug}/quarto/${opt.roomTypeId}${
                detailQs.toString() ? `?${detailQs}` : ""
              }`;
              const reserveHref = `/h/${slug}/reservar/${opt.roomTypeId}?checkIn=${checkIn}&checkOut=${checkOut}&guests=${guests}`;

              return (
                <article key={opt.roomTypeId} className="room-card">
                  <Link to={detailHref} className="room-card-link">
                    <div
                      className={`room-photo ${photo ? "" : "empty"}`}
                      style={
                        photo
                          ? {
                              backgroundImage: `url(${cloudinaryUrl(photo, { w: 800 })})`,
                            }
                          : undefined
                      }
                    >
                      {opt.photos.length > 0 ? (
                        <span className="photo-count">
                          1/{opt.photos.length}
                        </span>
                      ) : null}
                    </div>
                    <div className="room-body">
                      <h3>{opt.roomTypeName}</h3>
                      <p className="muted">
                        Até {opt.capacity} hóspedes
                        {hasSearch && opt.nights
                          ? ` · ${opt.nights} noite${opt.nights === 1 ? "" : "s"}`
                          : ""}
                      </p>
                      {opt.amenities.length > 0 ? (
                        <div className="amenity-chips">
                          {opt.amenities.slice(0, 4).map((a) => (
                            <span key={a}>{a}</span>
                          ))}
                        </div>
                      ) : null}
                      <div className="room-price-row">
                        {hasSearch ? (
                          <>
                            <span>{brl(opt.nightlyRate)}/noite</span>
                            <strong>{brl(opt.total)}</strong>
                          </>
                        ) : (
                          <strong>a partir de {brl(opt.nightlyRate)}</strong>
                        )}
                      </div>
                    </div>
                  </Link>
                  {hasSearch ? (
                    <div className="room-card-actions">
                      <Link className="btn btn-block" to={detailHref}>
                        Ver detalhes
                      </Link>
                      <Link
                        className="btn btn-primary btn-block"
                        to={reserveHref}
                      >
                        Solicitar reserva
                      </Link>
                    </div>
                  ) : (
                    <div className="room-card-actions">
                      <Link className="btn btn-primary btn-block" to={detailHref}>
                        Ver quarto
                      </Link>
                    </div>
                  )}
                </article>
              );
            })}
          </div>
        )}

        <StayDesckFooter />
      </div>
    </main>
  );
}
