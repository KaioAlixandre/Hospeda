import { useEffect, useState } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
import { api, type PublicRoomType } from "../api";
import {
  ErrorBanner,
  LoadingBlock,
  StayDesckFooter,
} from "../components/HotelBrand";
import { SearchForm } from "../components/SearchForm";
import { useHotelContext } from "../hooks/HotelContext";
import {
  brl,
  mapsHref,
  splitRules,
  whatsappHref,
} from "../lib/format";
import { cloudinaryUrl } from "../lib/images";

export function CoverPage() {
  const { slug = "" } = useParams();
  const navigate = useNavigate();
  const hotelState = useHotelContext();
  const [rooms, setRooms] = useState<PublicRoomType[]>([]);
  const [roomsLoading, setRoomsLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    setRoomsLoading(true);
    void api
      .rooms(slug)
      .then((data) => {
        if (!cancelled) setRooms(data.rooms);
      })
      .catch(() => {
        if (!cancelled) setRooms([]);
      })
      .finally(() => {
        if (!cancelled) setRoomsLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [slug]);

  if (hotelState.status === "loading") {
    return (
      <main className="page">
        <div className="cover-hero skeleton" />
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

  const hotel = hotelState.hotel;
  const hero = hotel.coverPhotoUrl;
  const rules = splitRules(hotel.rules);
  const address = hotel.addressFormatted;

  return (
    <main className="page cover-page">
      <section
        className={`cover-hero ${hero ? "has-photo" : "no-photo"}`}
        style={
          hero
            ? {
                backgroundImage: `linear-gradient(180deg, rgba(10,20,18,0.35), rgba(10,20,18,0.72)), url(${cloudinaryUrl(hero, { w: 1600 })})`,
              }
            : undefined
        }
      >
        <div className="cover-hero-inner page-wide">
          {hotel.logoUrl ? (
            <img
              className="hotel-logo cover-logo"
              src={cloudinaryUrl(hotel.logoUrl, { w: 200 }) ?? hotel.logoUrl}
              alt=""
            />
          ) : null}
          <h1 className="cover-hotel-name">{hotel.name}</h1>
          {hotel.headline ? (
            <p className="cover-headline">{hotel.headline}</p>
          ) : null}
        </div>
      </section>

      <div className="page-inner page-wide cover-body">
        <SearchForm
          submitLabel="Ver disponibilidade"
          onSubmit={(values) => {
            navigate(
              `/h/${slug}/quartos?checkIn=${values.checkIn}&checkOut=${values.checkOut}&guests=${values.guests}`,
            );
          }}
        />

        <section className="cover-section">
          <h2>Nossos quartos</h2>
          {roomsLoading ? (
            <div className="room-grid">
              <div className="skeleton room-card-skeleton" />
              <div className="skeleton room-card-skeleton" />
            </div>
          ) : rooms.length === 0 ? (
            <p className="muted">Nenhum quarto publicado no momento.</p>
          ) : (
            <div className="room-grid">
              {rooms.map((room) => {
                const photo = room.photos[0];
                return (
                  <Link
                    key={room.id}
                    className="room-card cover-room-card"
                    to={`/h/${slug}/quarto/${room.id}`}
                  >
                    <div
                      className={`room-photo ${photo ? "" : "empty"}`}
                      style={
                        photo
                          ? {
                              backgroundImage: `url(${cloudinaryUrl(photo, { w: 800 })})`,
                            }
                          : undefined
                      }
                    />
                    <div className="room-body">
                      <h3>{room.name}</h3>
                      <p className="muted">Até {room.capacity} hóspedes</p>
                      <strong>a partir de {brl(room.priceFrom)}</strong>
                    </div>
                  </Link>
                );
              })}
            </div>
          )}
        </section>

        {(address || hotel.phone) && (
          <section className="cover-section">
            <h2>Localização</h2>
            {address ? <p>{address}</p> : null}
            <div className="cover-actions">
              {address ? (
                <a
                  className="btn"
                  href={mapsHref(address)}
                  target="_blank"
                  rel="noreferrer"
                >
                  Abrir no mapa
                </a>
              ) : null}
              {hotel.phone ? (
                <a
                  className="btn btn-primary"
                  href={whatsappHref(
                    hotel.phone,
                    `Olá! Vim pelo site de reservas do ${hotel.name}.`,
                  )}
                  target="_blank"
                  rel="noreferrer"
                >
                  WhatsApp
                </a>
              ) : null}
            </div>
          </section>
        )}

        {(rules.length > 0 || hotel.checkInTime || hotel.checkOutTime) && (
          <section className="cover-section">
            <h2>Informações</h2>
            <ul className="rules-list">
              {hotel.checkInTime ? (
                <li>Check-in a partir das {hotel.checkInTime}</li>
              ) : null}
              {hotel.checkOutTime ? (
                <li>Check-out até {hotel.checkOutTime}</li>
              ) : null}
              {rules.map((rule) => (
                <li key={rule}>{rule}</li>
              ))}
            </ul>
          </section>
        )}

        <StayDesckFooter />
      </div>
    </main>
  );
}
