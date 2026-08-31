import {
  BedDouble,
  CalendarDays,
  LayoutDashboard,
  SprayCan,
  Users,
} from "lucide-react";
import { NavLink, Route, Routes } from "react-router-dom";
import { DashboardPage } from "./pages/DashboardPage";
import { GuestsPage } from "./pages/GuestsPage";
import { HousekeepingPage } from "./pages/HousekeepingPage";
import { ReservationsPage } from "./pages/ReservationsPage";
import { RoomsPage } from "./pages/RoomsPage";

const links = [
  { to: "/", label: "Dashboard", icon: LayoutDashboard, end: true },
  { to: "/rooms", label: "Quartos", icon: BedDouble },
  { to: "/reservations", label: "Reservas", icon: CalendarDays },
  { to: "/guests", label: "Hóspedes", icon: Users },
  { to: "/housekeeping", label: "Limpeza", icon: SprayCan },
];

export function App() {
  return (
    <div className="app-shell">
      <aside className="sidebar">
        <div className="brand">
          <span className="brand-mark">H</span>
          <div>
            <strong>Hospeda</strong>
            <p>Gestão de hospedagem</p>
          </div>
        </div>

        <nav>
          {links.map(({ to, label, icon: LinkIcon, end }) => (
            <NavLink
              key={to}
              to={to}
              end={end}
              className={({ isActive }) =>
                isActive ? "nav-link active" : "nav-link"
              }
            >
              <LinkIcon size={18} strokeWidth={1.9} />
              {label}
            </NavLink>
          ))}
        </nav>

        <footer className="sidebar-foot">
          <span>API local</span>
          <code>localhost:3333</code>
        </footer>
      </aside>

      <main className="content">
        <Routes>
          <Route path="/" element={<DashboardPage />} />
          <Route path="/rooms" element={<RoomsPage />} />
          <Route path="/reservations" element={<ReservationsPage />} />
          <Route path="/guests" element={<GuestsPage />} />
          <Route path="/housekeeping" element={<HousekeepingPage />} />
        </Routes>
      </main>
    </div>
  );
}
