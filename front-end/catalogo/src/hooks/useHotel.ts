import { useEffect, useState } from "react";
import { api, type PublicHotel } from "../api";

type State =
  | { status: "loading"; hotel: null; error: null }
  | { status: "ready"; hotel: PublicHotel; error: null }
  | { status: "error"; hotel: null; error: string };

export function useHotel(slug: string | undefined) {
  const [state, setState] = useState<State>({
    status: "loading",
    hotel: null,
    error: null,
  });

  useEffect(() => {
    if (!slug) {
      setState({ status: "error", hotel: null, error: "Hotel não encontrado" });
      return;
    }

    let cancelled = false;
    setState({ status: "loading", hotel: null, error: null });

    void api
      .hotel(slug)
      .then((data) => {
        if (cancelled) return;
        setState({ status: "ready", hotel: data.hotel, error: null });
        document.title = `${data.hotel.name} · Reservas`;
      })
      .catch((err: unknown) => {
        if (cancelled) return;
        setState({
          status: "error",
          hotel: null,
          error: err instanceof Error ? err.message : "Catálogo indisponível",
        });
        document.title = "Catálogo indisponível";
      });

    return () => {
      cancelled = true;
    };
  }, [slug]);

  return state;
}
