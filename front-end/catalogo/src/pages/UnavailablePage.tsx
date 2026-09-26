import { Link, useParams } from "react-router-dom";
import { StayDesckFooter } from "../components/HotelBrand";
import { useHotelContext } from "../hooks/HotelContext";
import { ErrorBanner, LoadingBlock } from "../components/HotelBrand";

export function UnavailablePage({ generic }: { generic?: boolean }) {
  const { slug } = useParams();
  const hotelState = useHotelContext();

  if (!generic && hotelState.status === "loading") {
    return (
      <main className="page page-centered">
        <LoadingBlock />
      </main>
    );
  }

  return (
    <main className="page page-centered">
      <div className="unavailable-card">
        <h1>Página indisponível</h1>
        <p className="muted">
          {generic
            ? "Este endereço não existe."
            : hotelState.error ||
              "O catálogo deste hotel não está disponível no momento."}
        </p>
        {slug ? (
          <Link className="btn btn-primary" to={`/h/${slug}`}>
            Ir para o início
          </Link>
        ) : null}
      </div>
      {!generic && hotelState.status === "error" ? (
        <ErrorBanner message={hotelState.error} />
      ) : null}
      <StayDesckFooter />
    </main>
  );
}
