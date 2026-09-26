import { Link, useLocation, useParams } from "react-router-dom";
import type { ReservationSummary } from "../api";
import {
  HotelBrand,
  StayDesckFooter,
} from "../components/HotelBrand";
import { useHotelContext } from "../hooks/HotelContext";
import { brl, dateBR, phoneHref, whatsappHref } from "../lib/format";
import { cloudinaryUrl } from "../lib/images";
import { ErrorBanner, LoadingBlock } from "../components/HotelBrand";

export function ReadyPage() {
  const { slug = "", code = "" } = useParams();
  const location = useLocation();
  const hotelState = useHotelContext();
  const summary = (location.state as { summary?: ReservationSummary } | null)
    ?.summary;

  if (hotelState.status === "loading") {
    return (
      <main className="page">
        <div className="page-inner page-narrow">
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

  const hotel = hotelState.hotel;

  return (
    <main className="page ready-page">
      <div className="page-inner page-narrow ready-inner">
        <HotelBrand hotel={hotel} compact />

        <div className="ready-card">
          <p className="eyebrow">Pedido de reserva enviado</p>
          <h1>Código da reserva: {code}</h1>
          <p className="muted">
            O hotel recebeu sua solicitação e deve confirmar em breve. Guarde
            este código.
          </p>

          {summary ? (
            <article className="reserve-summary ready-summary">
              <div
                className={`room-photo compact ${summary.photo ? "" : "empty"}`}
                style={
                  summary.photo
                    ? {
                        backgroundImage: `url(${cloudinaryUrl(summary.photo, { w: 400 })})`,
                      }
                    : undefined
                }
              />
              <div>
                <h2>{summary.roomName}</h2>
                <p className="muted">
                  {dateBR(summary.checkInDate)} → {dateBR(summary.checkOutDate)}{" "}
                  · {summary.nights} noite{summary.nights === 1 ? "" : "s"} ·{" "}
                  {summary.guests} hóspede{summary.guests === 1 ? "" : "s"}
                </p>
                <p>
                  {brl(summary.nightlyRate)}/noite ·{" "}
                  <strong>{brl(summary.total)}</strong>
                </p>
              </div>
            </article>
          ) : null}

          <div className="ready-actions">
            {hotel.phone ? (
              <>
                <a className="btn" href={phoneHref(hotel.phone)}>
                  Ligar
                </a>
                <a
                  className="btn btn-primary"
                  href={whatsappHref(
                    hotel.phone,
                    `Olá! Enviei o pedido ${code} pelo site.`,
                  )}
                  target="_blank"
                  rel="noreferrer"
                >
                  WhatsApp
                </a>
              </>
            ) : null}
          </div>
        </div>

        <Link className="back-link" to={`/h/${slug}`}>
          ← Voltar ao início
        </Link>
        <StayDesckFooter />
      </div>
    </main>
  );
}
