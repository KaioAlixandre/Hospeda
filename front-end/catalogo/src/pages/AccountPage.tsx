import { useEffect, useState, type FormEvent } from "react";
import { Link, useNavigate } from "react-router-dom";
import { api, type CatalogStay } from "../api";
import { GuestAuthPanel } from "../components/GuestAuthPanel";
import {
  ErrorBanner,
  LoadingBlock,
  StayDesckFooter,
} from "../components/HotelBrand";
import { useCatalogAuth } from "../hooks/CatalogAuthContext";
import { brl, dateBR, phoneMask } from "../lib/format";
import { cloudinaryUrl } from "../lib/images";

type Tab = "perfil" | "historico";

const STATUS_TONE: Record<CatalogStay["status"], string> = {
  PENDING: "yellow",
  CONFIRMED: "blue",
  CANCELLED: "gray",
  COMPLETED: "green",
};

export function AccountPage() {
  const navigate = useNavigate();
  const auth = useCatalogAuth();
  const [tab, setTab] = useState<Tab>("perfil");
  const [name, setName] = useState("");
  const [phone, setPhone] = useState("");
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [stays, setStays] = useState<CatalogStay[]>([]);
  const [staysLoading, setStaysLoading] = useState(false);
  const [staysError, setStaysError] = useState<string | null>(null);

  function goBack() {
    if (window.history.length > 1) {
      navigate(-1);
      return;
    }
    navigate("/");
  }

  useEffect(() => {
    if (!auth.user) return;
    setName(auth.user.name);
    setPhone(auth.user.phone ? phoneMask(auth.user.phone) : "");
  }, [auth.user]);

  useEffect(() => {
    if (!auth.user || tab !== "historico") return;
    let cancelled = false;
    setStaysLoading(true);
    setStaysError(null);
    void api.auth
      .reservations()
      .then((data) => {
        if (!cancelled) setStays(data.reservations);
      })
      .catch((err: Error) => {
        if (!cancelled) setStaysError(err.message);
      })
      .finally(() => {
        if (!cancelled) setStaysLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [auth.user, tab]);

  async function saveProfile(event: FormEvent) {
    event.preventDefault();
    if (!auth.user) return;
    setSaving(true);
    setError(null);
    setMessage(null);
    try {
      await auth.updateProfile({
        name: name.trim(),
        phone: phone.replace(/\D/g, ""),
      });
      setMessage("Perfil atualizado.");
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setSaving(false);
    }
  }

  if (auth.status === "loading") {
    return (
      <main className="page">
        <div className="page-inner page-narrow">
          <LoadingBlock label="Carregando conta…" />
        </div>
      </main>
    );
  }

  return (
    <main className="page account-page">
      <div className="page-inner page-narrow">
        <button type="button" className="back-link" onClick={goBack}>
          ← Voltar
        </button>
        <header className="account-header">
          <h1>Minha conta</h1>
          <p className="muted">Perfil e histórico de hospedagens</p>
        </header>

        {!auth.user ? (
          <>
            <GuestAuthPanel />
            <StayDesckFooter />
          </>
        ) : (
          <>
            <div className="account-tabs" role="tablist">
              <button
                type="button"
                role="tab"
                className={tab === "perfil" ? "active" : ""}
                aria-selected={tab === "perfil"}
                onClick={() => setTab("perfil")}
              >
                Perfil
              </button>
              <button
                type="button"
                role="tab"
                className={tab === "historico" ? "active" : ""}
                aria-selected={tab === "historico"}
                onClick={() => setTab("historico")}
              >
                Histórico
              </button>
            </div>

            {tab === "perfil" ? (
              <section className="account-panel">
                <div className="guest-auth-user account-profile-head">
                  {auth.user.avatarUrl ? (
                    <img
                      src={auth.user.avatarUrl}
                      alt=""
                      className="guest-auth-avatar"
                    />
                  ) : (
                    <div className="guest-auth-avatar fallback" aria-hidden>
                      {auth.user.name.slice(0, 1).toUpperCase()}
                    </div>
                  )}
                  <div>
                    <strong>{auth.user.name}</strong>
                    <p className="muted">{auth.user.email}</p>
                  </div>
                </div>

                {error ? <ErrorBanner message={error} /> : null}
                {message ? <p className="account-success">{message}</p> : null}

                <form
                  className="reserve-form"
                  onSubmit={(e) => void saveProfile(e)}
                >
                  <label className="field">
                    <span>Nome completo</span>
                    <input
                      value={name}
                      onChange={(e) => setName(e.target.value)}
                      required
                      autoComplete="name"
                    />
                  </label>
                  <label className="field">
                    <span>WhatsApp</span>
                    <input
                      value={phone}
                      onChange={(e) => setPhone(phoneMask(e.target.value))}
                      inputMode="tel"
                      placeholder="(11) 99999-9999"
                      required
                      autoComplete="tel"
                    />
                  </label>
                  <label className="field">
                    <span>E-mail</span>
                    <input value={auth.user.email} disabled readOnly />
                  </label>

                  <div className="account-actions">
                    <button
                      type="submit"
                      className="btn btn-primary"
                      disabled={saving}
                    >
                      {saving ? "Salvando…" : "Salvar"}
                    </button>
                    <button
                      type="button"
                      className="btn btn-ghost"
                      onClick={auth.logout}
                    >
                      Sair
                    </button>
                  </div>
                </form>
              </section>
            ) : (
              <section className="account-panel">
                {staysLoading ? (
                  <LoadingBlock label="Carregando histórico…" />
                ) : null}
                {staysError ? <ErrorBanner message={staysError} /> : null}
                {!staysLoading && !staysError && stays.length === 0 ? (
                  <p className="muted account-empty">
                    Você ainda não tem hospedagens pelo catálogo.
                  </p>
                ) : null}
                <div className="stay-list">
                  {stays.map((stay) => {
                    const photo = cloudinaryUrl(stay.roomType.photo, { w: 400 });
                    return (
                      <article key={stay.code} className="stay-card">
                        <div
                          className={`room-photo compact ${photo ? "" : "empty"}`}
                          style={
                            photo
                              ? { backgroundImage: `url(${photo})` }
                              : undefined
                          }
                        />
                        <div className="stay-card-body">
                          <div className="stay-card-top">
                            <strong>{stay.hotel.name}</strong>
                            <span
                              className={`stay-status tone-${STATUS_TONE[stay.status]}`}
                            >
                              {stay.statusLabel}
                            </span>
                          </div>
                          <p className="muted">
                            {stay.roomType.name}
                            {stay.roomNumber
                              ? ` · Quarto ${stay.roomNumber}`
                              : ""}
                          </p>
                          <p>
                            {dateBR(stay.checkInDate)} →{" "}
                            {dateBR(stay.checkOutDate)} · {stay.nights} noite
                            {stay.nights === 1 ? "" : "s"}
                          </p>
                          <p className="muted">
                            Código {stay.code} · {brl(stay.total)}
                          </p>
                          {stay.hotel.slug ? (
                            <Link
                              className="stay-hotel-link"
                              to={`/h/${stay.hotel.slug}`}
                            >
                              Ver hotel
                            </Link>
                          ) : null}
                        </div>
                      </article>
                    );
                  })}
                </div>
              </section>
            )}

            <StayDesckFooter />
          </>
        )}
      </div>
    </main>
  );
}
