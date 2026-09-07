import {
  BedDouble,
  CalendarCheck,
  CalendarDays,
  CalendarX,
  Circle,
  CreditCard,
  DoorOpen,
  Grid2x2,
  Hotel,
  Layers,
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
import {
  useEffect,
  useRef,
  type ButtonHTMLAttributes,
  type ReactNode,
} from "react";
import { ptError } from "../lib/format";
import { useToast } from "./ToastProvider";

const ICONS: Record<string, LucideIcon> = {
  hotel: Hotel,
  "door-open": DoorOpen,
  "bed-double": BedDouble,
  "calendar-days": CalendarDays,
  "calendar-check": CalendarCheck,
  "calendar-x": CalendarX,
  "spray-can": SprayCan,
  wrench: Wrench,
  wallet: Wallet,
  users: Users,
  "trending-up": TrendingUp,
  "log-in": LogIn,
  "log-out": LogOut,
  layers: Layers,
  grid: Grid2x2,
  "credit-card": CreditCard,
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
  required,
  optional,
  children,
}: {
  label: string;
  hint?: string;
  required?: boolean;
  optional?: boolean;
  children: ReactNode;
}) {
  return (
    <label className="field">
      <span>
        {label}
        {required ? (
          <abbr className="field-required" title="Obrigatório">
            *
          </abbr>
        ) : null}
        {optional ? (
          <span className="field-optional"> (opcional)</span>
        ) : null}
      </span>
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
  xl,
}: {
  title: string;
  onClose: () => void;
  children: ReactNode;
  wide?: boolean;
  xl?: boolean;
}) {
  const sizeClass = xl ? "modal-xl" : wide ? "modal-wide" : "";
  return (
    <div className="modal-backdrop" onClick={onClose}>
      <div
        className={["modal", sizeClass].filter(Boolean).join(" ")}
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

/** Exibe erros e conclusões como pop-up (toast). */
export function Feedback({
  error,
  message,
}: {
  error?: string | null;
  message?: string | null;
}) {
  const { success, error: showError } = useToast();
  const lastError = useRef<string | null>(null);
  const lastMessage = useRef<string | null>(null);

  useEffect(() => {
    if (!error) {
      lastError.current = null;
      return;
    }
    const text = ptError(error);
    if (text === lastError.current) return;
    lastError.current = text;
    showError(text);
  }, [error, showError]);

  useEffect(() => {
    if (!message) {
      lastMessage.current = null;
      return;
    }
    if (message === lastMessage.current) return;
    lastMessage.current = message;
    success(message);
  }, [message, success]);

  return null;
}

export function Loading({ label = "Carregando…" }: { label?: string }) {
  return (
    <p className="loading">
      <Loader2 size={16} className="spin" /> {label}
    </p>
  );
}
