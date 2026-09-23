import { Route, Routes } from "react-router-dom";
import { CoverPage } from "./pages/CoverPage";
import { ReadyPage } from "./pages/ReadyPage";
import { ReservePage } from "./pages/ReservePage";
import { RoomsPage } from "./pages/RoomsPage";
import { UnavailablePage } from "./pages/UnavailablePage";

export function App() {
  return (
    <Routes>
      <Route path="/" element={<HomeHint />} />
      <Route path="/h/:slug" element={<CoverPage />} />
      <Route path="/h/:slug/quartos" element={<RoomsPage />} />
      <Route path="/h/:slug/reservar/:roomTypeId" element={<ReservePage />} />
      <Route path="/h/:slug/pronto/:code" element={<ReadyPage />} />
      <Route path="/h/:slug/*" element={<UnavailablePage />} />
      <Route path="*" element={<UnavailablePage generic />} />
    </Routes>
  );
}

function HomeHint() {
  return (
    <main className="page page-centered">
      <p className="muted">Use o link do seu hotel para ver o catálogo.</p>
    </main>
  );
}
