import {
  BedDouble,
  CalendarCheck,
  CalendarDays,
  Circle,
  DoorOpen,
  Hotel,
  Loader2,
  LogIn,
  LogOut,
  SprayCan,
  TrendingUp,
  Users,
  Wallet,
  Wrench,
  X,
  type LucideIcon,
} from "lucide-react";
import type { ButtonHTMLAttributes, ReactNode } from "react";

const ICONS: Record<string, LucideIcon> = {
  hotel: Hotel,
  "door-open": DoorOpen,
  "bed-double": BedDouble,
  "calendar-days": CalendarDays,
  "calendar-check": CalendarCheck,
  "spray-can": SprayCan,
  wrench: Wrench,
  wallet: Wallet,
  users: Users,
  "trending-up": TrendingUp,
  "log-in": LogIn,
  "log-out": LogOut,
  circle: Circle,
};

export function Icon({
  name,
  size = 18,
}: {
  name: string;
  size?: number;
}) {
  const Component = ICONS[name] ?? Circle;
  return <Component size={size} strokeWidth={1.9} />;
}

export function Badge({
  tone,
  icon,
  children,
}: {
  tone: string;
  icon?: string;
  children: ReactNode;
}) {
  return (
    <span className={`badge tone-${tone}`}>
      {icon ? <Icon name={icon} size={14} /> : null}
      {children}
    </span>
  );
}

type ButtonProps = ButtonHTMLAttributes<HTMLButtonElement> & {
  variant?: "primary" | "ghost" | "danger" | "subtle";
  icon?: ReactNode;
  loading?: boolean;
};

export function Button({
  variant = "subtle",
  icon,
  loading,
  children,
  disabled,
  ...rest
}: ButtonProps) {
  return (
    <button
      className={`btn btn-${variant}`}
      disabled={disabled || loading}
      {...rest}
    >
      {loading ? <Loader2 size={16} className="spin" /> : icon}
      {children}
    </button>
  );
}

export function Panel({
  title,
  action,
  children,
}: {
  title?: string;
  action?: ReactNode;
  children: ReactNode;
}) {
  return (
    <section className="panel">
      {title || action ? (
        <header className="panel-head">
          {title ? <h2>{title}</h2> : <span />}
          {action}
        </header>
      ) : null}
      {children}
    </section>
  );
}

export function EmptyState({ message }: { message: string }) {
  return <p className="empty">{message}</p>;
}

export function Field({
  label,
  hint,
  children,
}: {
  label: string;
  hint?: string;
  children: ReactNode;
}) {
  return (
    <label className="field">
      <span>{label}</span>
      {children}
      {hint ? <small>{hint}</small> : null}
    </label>
  );
}

export function Modal({
  title,
  onClose,
  children,
  wide,
}: {
  title: string;
  onClose: () => void;
  children: ReactNode;
  wide?: boolean;
}) {
  return (
    <div className="modal-backdrop" onClick={onClose}>
      <div
        className={wide ? "modal modal-wide" : "modal"}
        onClick={(event) => event.stopPropagation()}
      >
        <header className="modal-head">
          <h2>{title}</h2>
          <button className="icon-btn" onClick={onClose} aria-label="Fechar">
            <X size={18} />
          </button>
        </header>
        <div className="modal-body">{children}</div>
      </div>
    </div>
  );
}

export function Feedback({
  error,
  message,
}: {
  error?: string | null;
  message?: string | null;
}) {
  if (error) return <p className="alert alert-error">{error}</p>;
  if (message) return <p className="alert alert-ok">{message}</p>;
  return null;
}

export function Loading({ label = "Carregando…" }: { label?: string }) {
  return (
    <p className="loading">
      <Loader2 size={16} className="spin" /> {label}
    </p>
  );
}
