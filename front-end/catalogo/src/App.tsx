import { Link, Outlet, Route, Routes, useParams } from "react-router-dom";
import { CatalogAccountBar } from "./components/CatalogAccountBar";
import { CatalogAuthProvider } from "./hooks/CatalogAuthContext";
import { HotelProvider } from "./hooks/HotelContext";
import { AccountPage } from "./pages/AccountPage";
import { CoverPage } from "./pages/CoverPage";
import { ReadyPage } from "./pages/ReadyPage";
import { ReservePage } from "./pages/ReservePage";
import { RoomDetailPage } from "./pages/RoomDetailPage";
import { RoomsPage } from "./pages/RoomsPage";
import { UnavailablePage } from "./pages/UnavailablePage";

function HotelShell() {
  const { slug = "" } = useParams();
  return (
    <HotelProvider slug={slug}>
      <CatalogAccountBar />
      <Outlet />
    </HotelProvider>
  );
}

export function App() {
  return (
    <CatalogAuthProvider>
      <Routes>
        <Route path="/" element={<HomeHint />} />
        <Route path="/conta" element={<AccountPage />} />
        <Route path="/h/:slug" element={<HotelShell />}>
          <Route index element={<CoverPage />} />
          <Route path="quartos" element={<RoomsPage />} />
          <Route path="quarto/:roomTypeId" element={<RoomDetailPage />} />
          <Route path="reservar/:roomTypeId" element={<ReservePage />} />
          <Route path="pronto/:code" element={<ReadyPage />} />
          <Route path="*" element={<UnavailablePage />} />
        </Route>
        <Route path="*" element={<UnavailablePage generic />} />
      </Routes>
    </CatalogAuthProvider>
  );
}

function HomeHint() {
  return (
    <main className="page page-centered">
      <p className="muted">Use o link do seu hotel para ver o catálogo.</p>
      <p className="muted">
        Já tem conta? <Link to="/conta">Minha conta</Link>
      </p>
    </main>
  );
}
