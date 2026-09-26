import { Link } from "react-router-dom";
import { useCatalogAuth } from "../hooks/CatalogAuthContext";

/** Barra leve com acesso à conta nas páginas do hotel. */
export function CatalogAccountBar() {
  const auth = useCatalogAuth();
  if (auth.status === "loading") return null;

  return (
    <div className="catalog-account-bar">
      {auth.user ? (
        <Link className="catalog-account-link" to="/conta">
          {auth.user.avatarUrl ? (
            <img src={auth.user.avatarUrl} alt="" />
          ) : (
            <span className="catalog-account-initial" aria-hidden>
              {auth.user.name.slice(0, 1).toUpperCase()}
            </span>
          )}
          <span>Minha conta</span>
        </Link>
      ) : (
        <Link className="catalog-account-link muted" to="/conta">
          Entrar
        </Link>
      )}
    </div>
  );
}
