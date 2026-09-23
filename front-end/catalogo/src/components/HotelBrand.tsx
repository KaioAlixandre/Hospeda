import type { PublicHotel } from "../api";
import { locationLabel } from "../lib/format";

type Props = {
  hotel: PublicHotel;
  compact?: boolean;
};

export function HotelBrand({ hotel, compact }: Props) {
  const place = locationLabel(hotel.city, hotel.state);

  return (
    <header className={`hotel-brand ${compact ? "compact" : ""}`}>
      {hotel.logoUrl ? (
        <img
          className="hotel-logo"
          src={hotel.logoUrl}
          alt={`Logo ${hotel.name}`}
        />
      ) : (
        <div className="hotel-logo hotel-logo-fallback" aria-hidden>
          {hotel.name.slice(0, 1).toUpperCase()}
        </div>
      )}
      <div className="hotel-brand-copy">
        <h1 className="hotel-name">{hotel.name}</h1>
        {place ? <p className="hotel-place">{place}</p> : null}
      </div>
    </header>
  );
}

export function HospedaFooter() {
  return (
    <footer className="hospeda-footer">
      <span>Feito com Hospeda</span>
    </footer>
  );
}

export function LoadingBlock({ label = "Carregando…" }: { label?: string }) {
  return (
    <div className="loading-block" role="status">
      <span className="spinner" aria-hidden />
      <p>{label}</p>
    </div>
  );
}

export function ErrorBanner({ message }: { message: string }) {
  return (
    <div className="error-banner" role="alert">
      {message}
    </div>
  );
}
