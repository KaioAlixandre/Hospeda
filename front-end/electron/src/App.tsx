import {
  BedDouble,
  CalendarDays,
  LayoutDashboard,
  LogOut,
  Settings,
  SprayCan,
  Users,
} from "lucide-react";
import { NavLink, Route, Routes } from "react-router-dom";
import { useAuth } from "./auth";
import { Button } from "./components/ui";
import { API_BASE_URL } from "./config";
import { AuthLoading, AuthPage } from "./pages/AuthPage";
import { DashboardPage } from "./pages/DashboardPage";
import { GuestsPage } from "./pages/GuestsPage";
import { HousekeepingPage } from "./pages/HousekeepingPage";
import { ReservationsPage } from "./pages/ReservationsPage";
import { RoomsPage } from "./pages/RoomsPage";
import { SettingsPage } from "./pages/SettingsPage";

const links = [
  { to: "/", label: "Dashboard", icon: LayoutDashboard, end: true },
  { to: "/rooms", label: "Quartos", icon: BedDouble },
  { to: "/reservations", label: "Reservas", icon: CalendarDays },
  { to: "/guests", label: "Hóspedes", icon: Users },
  { to: "/housekeeping", label: "Limpeza", icon: SprayCan },
  { to: "/settings", label: "Configurações", icon: Settings },
];

export function App() {
  const { hotel, loading, logout } = useAuth();

  if (loading) return <AuthLoading />;
  if (!hotel) return <AuthPage />;

  return (
    <div className="app-shell">
      <aside className="sidebar">
        <div className="brand">
          <span className="brand-mark">H</span>
          <div>
            <strong>{hotel.name}</strong>
            <p>{hotel.ownerName}</p>
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
          <Button icon={<LogOut size={15} />} onClick={logout}>
            Sair
          </Button>
          <span>API</span>
          <code>{API_BASE_URL.replace(/^https?:\/\//, "")}</code>
        </footer>
      </aside>

      <main className="content">
        <Routes>
          <Route path="/" element={<DashboardPage />} />
          <Route path="/rooms" element={<RoomsPage />} />
          <Route path="/reservations" element={<ReservationsPage />} />
          <Route path="/guests" element={<GuestsPage />} />
          <Route path="/housekeeping" element={<HousekeepingPage />} />
          <Route path="/settings" element={<SettingsPage />} />
        </Routes>
      </main>
    </div>
  );
}
