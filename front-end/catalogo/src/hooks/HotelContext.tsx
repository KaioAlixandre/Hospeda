import {
  createContext,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from "react";
import { api, type PublicHotel } from "../api";
import { applyHotelSeo, cloudinaryUrl } from "../lib/images";

type HotelState =
  | { status: "loading"; hotel: null; error: null }
  | { status: "ready"; hotel: PublicHotel; error: null }
  | { status: "error"; hotel: null; error: string };

const HotelContext = createContext<HotelState & { slug: string }>({
  status: "loading",
  hotel: null,
  error: null,
  slug: "",
});

export function HotelProvider({
  slug,
  children,
}: {
  slug: string;
  children: ReactNode;
}) {
  const [state, setState] = useState<HotelState>({
    status: "loading",
    hotel: null,
    error: null,
  });

  useEffect(() => {
    let cancelled = false;
    setState({ status: "loading", hotel: null, error: null });

    void api
      .hotel(slug)
      .then(({ hotel }) => {
        if (cancelled) return;
        setState({ status: "ready", hotel, error: null });

        const root = document.documentElement;
        if (hotel.brandColor) {
          root.style.setProperty("--accent", hotel.brandColor);
          root.style.setProperty("--accent-strong", hotel.brandColor);
        } else {
          root.style.removeProperty("--accent");
          root.style.removeProperty("--accent-strong");
        }

        applyHotelSeo({
          name: hotel.name,
          description: hotel.headline,
          image: cloudinaryUrl(hotel.coverPhotoUrl, { w: 1200 }),
        });
      })
      .catch((err: Error) => {
        if (cancelled) return;
        setState({
          status: "error",
          hotel: null,
          error: err.message || "Hotel não encontrado",
        });
      });

    return () => {
      cancelled = true;
    };
  }, [slug]);

  const value = useMemo(
    () => ({ ...state, slug }),
    [state, slug],
  );

  return (
    <HotelContext.Provider value={value}>{children}</HotelContext.Provider>
  );
}

export function useHotelContext() {
  return useContext(HotelContext);
}
