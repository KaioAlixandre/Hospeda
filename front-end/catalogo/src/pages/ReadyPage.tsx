import { Link, useParams } from "react-router-dom";
import {
  HotelBrand,
  HospedaFooter,
  LoadingBlock,
} from "../components/HotelBrand";
import { useHotel } from "../hooks/useHotel";
import { phoneHref, whatsappHref } from "../lib/format";

export function ReadyPage() {
  const { slug = "", code = "" } = useParams();
  const hotelState = useHotel(slug);
  const decoded = decodeURIComponent(code);

  if (hotelState.status === "loading") {
    return (
      <main className="page page-centered">
        <LoadingBlock />
      </main>
    );
  }

  const hotel = hotelState.status === "ready" ? hotelState.hotel : null;

  return (
    <main className="page ready-page">
      <div className="page-inner ready-inner">
        {hotel ? <HotelBrand hotel={hotel} compact /> : null}

        <div className="ready-card">
          <p className="ready-kicker">Pedido recebido</p>
          <h2 className="ready-code">{decoded}</h2>
          <p className="ready-warn">
            Este pedido <strong>não é uma confirmação</strong>. O hotel ainda
            precisa confirmar a disponibilidade e entrará em contato.
          </p>

          {hotel?.phone ? (
            <div className="ready-contact">
              <p className="muted">Fale com o hotel</p>
              <a className="btn btn-secondary btn-block" href={phoneHref(hotel.phone)}>
                Ligar {hotel.phone}
              </a>
              <a
                className="btn btn-primary btn-block"
                href={whatsappHref(
                  hotel.phone,
                  `Olá! Enviei o pedido de reserva ${decoded}.`,
                )}
                target="_blank"
                rel="noopener noreferrer"
              >
                WhatsApp
              </a>
            </div>
          ) : null}
        </div>

        <Link className="back-link" to={`/h/${slug}`}>
          Voltar ao início
        </Link>
        <HospedaFooter />
      </div>
    </main>
  );
}
