import { useParams } from "react-router-dom";
import { StayDesckFooter, LoadingBlock } from "../components/HotelBrand";
import { useHotel } from "../hooks/useHotel";
import { phoneHref, whatsappHref } from "../lib/format";

type Props = {
  generic?: boolean;
};

export function UnavailablePage({ generic }: Props) {
  const { slug } = useParams();
  const hotelState = useHotel(generic ? undefined : slug);

  if (!generic && hotelState.status === "loading") {
    return (
      <main className="page page-centered">
        <LoadingBlock />
      </main>
    );
  }

  const hotel = hotelState.status === "ready" ? hotelState.hotel : null;

  return (
    <main className="page page-centered unavailable-page">
      <div className="unavailable-card">
        <h1>Catálogo indisponível</h1>
        <p className="muted">
          {hotel
            ? "Este link não está disponível no momento. Fale com o hotel para reservar."
            : "Não encontramos este catálogo. Confira o link ou fale com o estabelecimento."}
        </p>
        {hotel?.phone ? (
          <div className="ready-contact">
            <a className="btn btn-secondary btn-block" href={phoneHref(hotel.phone)}>
              Ligar {hotel.phone}
            </a>
            <a
              className="btn btn-primary btn-block"
              href={whatsappHref(hotel.phone)}
              target="_blank"
              rel="noopener noreferrer"
            >
              WhatsApp do hotel
            </a>
          </div>
        ) : null}
      </div>
      <StayDesckFooter />
    </main>
  );
}
