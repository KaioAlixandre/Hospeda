import { useEffect, useRef, useState } from "react";
import { Link, useNavigate, useParams, useSearchParams } from "react-router-dom";
import { api, type PublicRoomType, type RoomAvailability } from "../api";
import { ErrorBanner, LoadingBlock, StayDesckFooter } from "../components/HotelBrand";
import { SearchForm } from "../components/SearchForm";
import { useHotelContext } from "../hooks/HotelContext";
import { amenityIcon } from "../lib/amenities";
import { brl, dateBR } from "../lib/format";
import { applyHotelSeo, cloudinaryUrl } from "../lib/images";

export function RoomDetailPage() {
  const { slug = "", roomTypeId = "" } = useParams();
  const [params] = useSearchParams();
  const navigate = useNavigate();
  const hotelState = useHotelContext();

  const checkIn = params.get("checkIn") ?? "";
  const checkOut = params.get("checkOut") ?? "";
  const guests = Number(params.get("guests") || 2);

  const [room, setRoom] = useState<PublicRoomType | null>(null);
  const [availability, setAvailability] = useState<RoomAvailability | null>(
    null,
  );
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [showDates, setShowDates] = useState(false);
  const [lightbox, setLightbox] = useState<number | null>(null);
  const [slide, setSlide] = useState(0);
  const dialogRef = useRef<HTMLDialogElement>(null);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    void api
      .roomType(slug, roomTypeId, {
        checkIn: checkIn || undefined,
        checkOut: checkOut || undefined,
        guests: checkIn && checkOut ? guests : undefined,
      })
      .then((data) => {
        if (cancelled) return;
        setRoom(data.room);
        setAvailability(data.availability);
        setError(null);
        applyHotelSeo({
          name: data.room.name,
          description: data.room.description,
          image: cloudinaryUrl(data.room.photos[0], { w: 1200 }),
        });
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

  useEffect(() => {
    const dialog = dialogRef.current;
    if (!dialog) return;
    if (lightbox !== null) dialog.showModal();
    else dialog.close();
  }, [lightbox]);

  if (hotelState.status === "loading" || loading) {
    return (
      <main className="page">
        <div className="page-inner page-wide">
          <div className="skeleton gallery-skeleton" />
          <LoadingBlock label="Carregando quarto…" />
        </div>
      </main>
    );
  }

  if (hotelState.status === "error" || error || !room) {
    return (
      <main className="page page-centered">
        <ErrorBanner message={error ?? hotelState.error ?? "Quarto não encontrado"} />
        <Link to={`/h/${slug}`}>Voltar</Link>
      </main>
    );
  }

  const hotel = hotelState.hotel!;
  const photos = room.photos.length > 0 ? room.photos : [];
  const hasDates = Boolean(checkIn && checkOut);
  const available = availability?.available === true;
  const unavailable = hasDates && availability?.available === false;

  const roomsQuery = new URLSearchParams();
  if (checkIn) roomsQuery.set("checkIn", checkIn);
  if (checkOut) roomsQuery.set("checkOut", checkOut);
  if (guests) roomsQuery.set("guests", String(guests));
  const roomsHref = `/h/${slug}/quartos${roomsQuery.toString() ? `?${roomsQuery}` : ""}`;

  function goReserve() {
    if (!hasDates || !available) {
      setShowDates(true);
      return;
    }
    navigate(
      `/h/${slug}/reservar/${roomTypeId}?checkIn=${checkIn}&checkOut=${checkOut}&guests=${guests}`,
    );
  }

  const priceLabel = hasDates && availability
    ? brl(availability.total)
    : `a partir de ${brl(room.priceFrom)}/noite`;

  const ctaLabel =
    !hasDates
      ? "Escolher datas"
      : unavailable
        ? "Ver outras datas"
        : "Reservar este quarto";

  return (
    <main className="page detail-page">
      <div className="page-inner page-wide detail-layout">
        <div className="detail-main">
          <Link className="back-link" to={roomsHref}>
            ← Quartos
          </Link>

          {photos.length > 0 ? (
            <>
              <div className="gallery-mobile">
                <div
                  className="gallery-track"
                  onScroll={(e) => {
                    const el = e.currentTarget;
                    const idx = Math.round(el.scrollLeft / el.clientWidth);
                    setSlide(idx);
                  }}
                >
                  {photos.map((src, i) => (
                    <button
                      key={src}
                      type="button"
                      className="gallery-slide"
                      onClick={() => setLightbox(i)}
                    >
                      <img
                        src={cloudinaryUrl(src, { w: 1000 }) ?? src}
                        alt={`${room.name} — foto ${i + 1}`}
                        loading={i === 0 ? "eager" : "lazy"}
                      />
                    </button>
                  ))}
                </div>
                <div className="gallery-dots">
                  {photos.map((_, i) => (
                    <span
                      key={i}
                      className={i === slide ? "dot active" : "dot"}
                    />
                  ))}
                </div>
              </div>

              <div className="gallery-desktop">
                <button
                  type="button"
                  className="gallery-hero"
                  onClick={() => setLightbox(0)}
                >
                  <img
                    src={cloudinaryUrl(photos[0], { w: 1200 }) ?? photos[0]}
                    alt={room.name}
                  />
                </button>
                <div className="gallery-thumbs">
                  {photos.slice(1, 3).map((src, i) => (
                    <button
                      key={src}
                      type="button"
                      onClick={() => setLightbox(i + 1)}
                    >
                      <img
                        src={cloudinaryUrl(src, { w: 600 }) ?? src}
                        alt=""
                        loading="lazy"
                      />
                    </button>
                  ))}
                </div>
              </div>
            </>
          ) : (
            <div className="gallery-empty" />
          )}

          <header className="detail-header">
            <h1>{room.name}</h1>
            <p className="muted">Até {room.capacity} hóspedes</p>
          </header>

          {room.description ? (
            <section className="detail-section">
              <h2>Descrição</h2>
              <p>{room.description}</p>
            </section>
          ) : null}

          {room.amenities.length > 0 ? (
            <section className="detail-section">
              <h2>Comodidades</h2>
              <ul className="amenity-grid">
                {room.amenities.map((item) => {
                  const Icon = amenityIcon(item);
                  return (
                    <li key={item}>
                      <Icon size={18} strokeWidth={1.8} />
                      <span>{item}</span>
                    </li>
                  );
                })}
              </ul>
            </section>
          ) : null}

          <section className="detail-section detail-rules">
            <h2>Horários e regras</h2>
            <ul>
              {hotel.checkInTime ? (
                <li>Check-in a partir das {hotel.checkInTime}</li>
              ) : null}
              {hotel.checkOutTime ? (
                <li>Check-out até {hotel.checkOutTime}</li>
              ) : null}
            </ul>
          </section>
        </div>

        <aside className="detail-sidebar">
          <div className="detail-booking-card">
            <p className="detail-price">{priceLabel}</p>
            {hasDates && availability ? (
              <p className="muted">
                {dateBR(checkIn)} → {dateBR(checkOut)} · {availability.nights}{" "}
                noite{availability.nights === 1 ? "" : "s"}
                {available ? ` · ${brl(availability.nightlyRate)}/noite` : ""}
              </p>
            ) : null}
            {unavailable ? (
              <p className="field-error">
                Indisponível nestas datas. Escolha outras datas.
              </p>
            ) : null}

            {showDates || !hasDates ? (
              <SearchForm
                stacked
                initial={{
                  checkIn: checkIn || undefined,
                  checkOut: checkOut || undefined,
                  guests,
                }}
                submitLabel="Aplicar datas"
                onSubmit={(values) => {
                  navigate(
                    `/h/${slug}/quarto/${roomTypeId}?checkIn=${values.checkIn}&checkOut=${values.checkOut}&guests=${values.guests}`,
                  );
                  setShowDates(false);
                }}
              />
            ) : (
              <button
                type="button"
                className="btn btn-primary btn-block"
                onClick={goReserve}
              >
                {ctaLabel}
              </button>
            )}
          </div>
        </aside>
      </div>

      <div className="detail-mobile-bar">
        <div>
          <strong>{priceLabel}</strong>
          {hasDates && availability?.available ? (
            <span className="muted">
              {availability.nights} noite
              {availability.nights === 1 ? "" : "s"}
            </span>
          ) : null}
        </div>
        <button type="button" className="btn btn-primary" onClick={goReserve}>
          {ctaLabel}
        </button>
      </div>

      <dialog
        ref={dialogRef}
        className="lightbox"
        onClose={() => setLightbox(null)}
        onClick={() => setLightbox(null)}
      >
        {lightbox !== null && photos[lightbox] ? (
          <img
            src={cloudinaryUrl(photos[lightbox], { w: 1600 }) ?? photos[lightbox]}
            alt=""
            onClick={(e) => e.stopPropagation()}
          />
        ) : null}
      </dialog>

      <StayDesckFooter />
    </main>
  );
}
