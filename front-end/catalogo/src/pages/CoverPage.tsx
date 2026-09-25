import { useNavigate, useParams } from "react-router-dom";
import {
  ErrorBanner,
  HotelBrand,
  StayDesckFooter,
  LoadingBlock,
} from "../components/HotelBrand";
import { SearchForm, type SearchValues } from "../components/SearchForm";
import { useHotel } from "../hooks/useHotel";

export function CoverPage() {
  const { slug = "" } = useParams();
  const navigate = useNavigate();
  const state = useHotel(slug);

  if (state.status === "loading") {
    return (
      <main className="page page-centered">
        <LoadingBlock label="Carregando hotel…" />
      </main>
    );
  }

  if (state.status === "error") {
    return (
      <main className="page page-centered">
        <ErrorBanner message={state.error} />
        <StayDesckFooter />
      </main>
    );
  }

  const { hotel } = state;

  function goToRooms(values: SearchValues) {
    const params = new URLSearchParams({
      checkIn: values.checkIn,
      checkOut: values.checkOut,
      guests: String(values.guests),
    });
    void navigate(`/h/${slug}/quartos?${params}`);
  }

  return (
    <main className="page cover-page">
      <div className="cover-atmosphere" aria-hidden />
      <div className="cover-content">
        <HotelBrand hotel={hotel} />
        {hotel.headline ? (
          <p className="cover-headline">{hotel.headline}</p>
        ) : (
          <p className="cover-headline">
            Reserve suas datas e envie um pedido direto ao hotel.
          </p>
        )}
        <SearchForm onSubmit={goToRooms} />
        {hotel.rules ? (
          <section className="rules-block">
            <h2>Informações</h2>
            <p>{hotel.rules}</p>
          </section>
        ) : null}
        <StayDesckFooter />
      </div>
    </main>
  );
}
