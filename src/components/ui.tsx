"use client";

import {
  forwardRef, useEffect, useId, useLayoutEffect, useRef, useState,
  type ButtonHTMLAttributes, type InputHTMLAttributes, type ReactNode,
} from "react";
import { createPortal } from "react-dom";
import { ChevronLeft, Delete, Loader2, X } from "lucide-react";
import { useApp } from "@/client/app-context.tsx";
import { plural, t, tMessage } from "@/core/i18n.ts";
import { formatMoney, parseMoney, toInputValue } from "@/core/money.ts";
import { haptic, useBackTarget, useLargeTitle, useMediaQuery } from "./native.tsx";
import { goBack as goBackInApp, useCanGoBack } from "@/client/router.ts";
import { DateInput, inputClass } from "./pickers.tsx";

export function cx(...parts: (string | false | null | undefined)[]) {
  return parts.filter(Boolean).join(" ");
}

// ---------- buttons ----------

type Variant = "primary" | "secondary" | "ghost" | "danger" | "positive";

const VARIANTS: Record<Variant, string> = {
  primary: "bg-primary text-on-primary shadow-[inset_0_1px_0_rgb(255_255_255/0.22),var(--shadow-primary)] hover:brightness-[1.06]",
  secondary: "bg-surface text-ink shadow-card ring-1 ring-line hover:bg-surface-2",
  ghost: "text-ink-2 hover:bg-surface-2",
  danger: "bg-negative text-white dark:text-black hover:brightness-110",
  positive: "bg-positive text-white dark:text-black hover:brightness-110",
};

export const Button = forwardRef<
  HTMLButtonElement,
  ButtonHTMLAttributes<HTMLButtonElement> & { variant?: Variant; size?: "md" | "lg" | "sm"; loading?: boolean; block?: boolean }
>(function Button({ variant = "primary", size = "md", loading, block, className, children, disabled, ...rest }, ref) {
  return (
    <button
      ref={ref}
      disabled={disabled || loading}
      className={cx(
        "inline-flex cursor-pointer select-none items-center justify-center gap-2 font-semibold tracking-[-0.01em] transition-[transform,filter,background-color,box-shadow] duration-150 ease-[var(--ease-out)] active:scale-[0.97] disabled:cursor-not-allowed disabled:opacity-45 disabled:shadow-none disabled:active:scale-100",
        size === "lg" ? "min-h-14 rounded-2xl px-6 text-base lg:min-h-12" : size === "sm" ? "min-h-9 rounded-xl px-3 text-sm" : "min-h-12 rounded-2xl px-4 text-sm lg:min-h-11 lg:rounded-xl",
        VARIANTS[variant],
        block && "w-full",
        className,
      )}
      {...rest}
    >
      {loading && <Loader2 className="size-4 animate-spin" aria-hidden />}
      {children}
    </button>
  );
});

export function IconButton({
  label, className, children, ...rest
}: ButtonHTMLAttributes<HTMLButtonElement> & { label: string }) {
  return (
    <button
      aria-label={label}
      title={label}
      className={cx(
        "inline-flex size-11 cursor-pointer items-center justify-center rounded-full text-ink-2 transition-[transform,background-color] duration-150 hover:bg-surface-2 active:scale-90 disabled:opacity-40",
        className,
      )}
      {...rest}
    >
      {children}
    </button>
  );
}

// ---------- layout ----------

export function PageHeader({
  title, subtitle, back, actions,
}: { title: string; subtitle?: ReactNode; back?: () => void; actions?: ReactNode }) {
  const titleRef = useLargeTitle(title);
  const stackBack = useBackTarget();
  const canBack = useCanGoBack();
  // Back to the previous screen (and where it was scrolled to); on a first screen, phones fall back to the menu.
  const goBack = back ?? (canBack ? goBackInApp : stackBack ? () => (window.location.hash = stackBack) : null);
  return (
    <header className="no-print animate-rise mb-5 flex items-start gap-2">
      {goBack && (
        <IconButton label={t("Back")} onClick={goBack} className={cx("back-btn -ml-1 mt-0.5 bg-surface shadow-card ring-1 ring-line", !back && !canBack && "lg:hidden")}>
          <ChevronLeft className="size-6" />
        </IconButton>
      )}
      <div className="min-w-0 flex-1 pt-1">
        <h1 ref={titleRef} className="text-[32px] font-extrabold leading-[1.05] tracking-[-0.035em] text-ink lg:text-[30px]">{title}</h1>
        {subtitle && <div className="mt-1 text-[15px] text-ink-3">{subtitle}</div>}
      </div>
      {actions && <div className="flex shrink-0 items-center gap-1">{actions}</div>}
    </header>
  );
}

/** The brand mark: orange crossed blades, cut out on a transparent background. Decorative: a name is always written beside it. */
export function LogoMark({ className, white }: { className?: string; white?: boolean }) {
  // eslint-disable-next-line @next/next/no-img-element
  return <img src={white ? "/brand/logo-white.png" : "/brand/logo.png"} alt="" aria-hidden draggable={false} className={cx("pointer-events-none select-none object-contain", className)} />;
}

export function Card({ className, children, ...rest }: { className?: string; children: ReactNode } & React.HTMLAttributes<HTMLDivElement>) {
  return (
    <div className={cx("rounded-3xl bg-surface shadow-card ring-1 ring-line/70", className)} {...rest}>
      {children}
    </div>
  );
}

export function SectionTitle({ children, action }: { children: ReactNode; action?: ReactNode }) {
  return (
    <div className="mb-3 mt-8 flex min-h-11 items-center justify-between gap-2 lg:mt-6">
      <h2 className="text-[19px] font-bold tracking-[-0.02em] text-ink">{children}</h2>
      {action}
    </div>
  );
}

export function Empty({ icon, title, children, action }: { icon?: ReactNode; title: string; children?: ReactNode; action?: ReactNode }) {
  return (
    <div className="animate-rise flex flex-col items-center rounded-3xl bg-surface px-6 py-12 text-center shadow-card ring-1 ring-line/70">
      {icon && <div className="mb-4 flex size-16 animate-float items-center justify-center rounded-full bg-accent-soft text-accent">{icon}</div>}
      <p className="text-lg font-bold tracking-tight text-ink">{title}</p>
      {children && <p className="mt-1 max-w-sm text-sm text-ink-3">{children}</p>}
      {action && <div className="mt-4">{action}</div>}
    </div>
  );
}

export function Stat({
  label, value, hint, tone,
}: { label: string; value: ReactNode; hint?: ReactNode; tone?: "positive" | "negative" | "accent" }) {
  return (
    <div className="@container flex min-h-[112px] min-w-0 flex-col rounded-3xl bg-surface p-4 shadow-card ring-1 ring-line/70">
      <div className="text-[13px] font-medium leading-tight text-ink-2">{label}</div>
      <div
        className={cx(
          // Scales with the tile so long figures (KES 73,817.50) always fit.
          "num mt-auto whitespace-nowrap pt-3 text-[clamp(15px,12.5cqi,26px)] font-extrabold leading-none tracking-[-0.03em]",
          tone === "positive" && "text-positive",
          tone === "negative" && "text-negative",
          tone === "accent" && "text-accent",
        )}
      >
        {value}
      </div>
      {hint && <div className="mt-1.5 text-xs text-ink-3">{hint}</div>}
    </div>
  );
}

export function Badge({ children, tone = "neutral" }: { children: ReactNode; tone?: "neutral" | "positive" | "negative" | "warning" | "accent" }) {
  const tones = {
    neutral: "bg-surface-2 text-ink-2",
    positive: "bg-positive-soft text-positive",
    negative: "bg-negative-soft text-negative",
    warning: "bg-warning-soft text-warning",
    accent: "bg-accent-soft text-accent",
  };
  return <span className={cx("inline-flex items-center gap-1 rounded-lg px-2 py-0.5 text-xs font-semibold", tones[tone])}>{children}</span>;
}

/** Skeleton placeholder shaped like a typical screen: a row of figures, then a list. */
export function Spinner({ label }: { label?: string }) {
  return (
    <div role="status" aria-label={label ?? t("Loading")} className="animate-fade-in space-y-3 py-1">
      <div className="grid grid-cols-2 gap-3">
        {[0, 1].map((i) => (
          <div key={i} className="h-[112px] animate-pulse rounded-3xl bg-surface-2" />
        ))}
      </div>
      <div className="overflow-hidden rounded-3xl bg-surface shadow-card ring-1 ring-line/70">
        {[0, 1, 2, 3].map((i) => (
          <div key={i} className="flex items-center gap-3 border-b border-line px-4 py-3.5 last:border-0">
            <div className="size-10 shrink-0 animate-pulse rounded-full bg-surface-2" />
            <div className="flex-1 space-y-2">
              <div className="h-3 w-2/5 animate-pulse rounded bg-surface-2" />
              <div className="h-2.5 w-3/5 animate-pulse rounded bg-surface-2" />
            </div>
            <div className="h-3 w-14 animate-pulse rounded bg-surface-2" />
          </div>
        ))}
      </div>
    </div>
  );
}

// ---------- forms ----------

export function Field({
  label, hint, error, children, htmlFor,
}: { label: string; hint?: ReactNode; error?: string | null; children: ReactNode; htmlFor?: string }) {
  return (
    <div className="space-y-1.5 lg:space-y-1">
      <label htmlFor={htmlFor} className="block text-sm font-medium text-ink-2 lg:text-[13px]">
        {label}
      </label>
      {children}
      {error ? (
        <p className="text-sm text-negative" role="alert">
          {error}
        </p>
      ) : hint ? (
        <p className="text-xs text-ink-3">{hint}</p>
      ) : null}
    </div>
  );
}


export const Input = forwardRef<HTMLInputElement, InputHTMLAttributes<HTMLInputElement>>(function Input(
  { className, ...rest },
  ref,
) {
  // Dates use the app's own calendar instead of the browser's grey picker.
  if (rest.type === "date") {
    const { value, min, max, onChange, id } = rest;
    return (
      <DateInput
        id={id}
        value={String(value ?? "")}
        min={min === undefined ? undefined : String(min)}
        max={max === undefined ? undefined : String(max)}
        label={rest["aria-label"]}
        className={className}
        onChange={(v) => onChange?.({ target: { value: v }, currentTarget: { value: v } } as unknown as React.ChangeEvent<HTMLInputElement>)}
      />
    );
  }
  return <input ref={ref} className={cx(inputClass, className)} {...rest} />;
});

export { Select, DateInput } from "./pickers.tsx";

export function Textarea(props: React.TextareaHTMLAttributes<HTMLTextAreaElement>) {
  return <textarea {...props} className={cx(inputClass, "min-h-20 py-3", props.className)} />;
}

/** Money input that works in minor units but lets people type normal amounts. */
export function MoneyInput({
  value, onChange, id, autoFocus, placeholder, disabled,
}: { value: number | null; onChange: (v: number | null) => void; id?: string; autoFocus?: boolean; placeholder?: string; disabled?: boolean }) {
  const { settings } = useApp();
  const [text, setText] = useState(() => toInputValue(value, settings.currency));
  const last = useRef(value);
  useEffect(() => {
    if (value !== last.current) {
      last.current = value;
      setText(toInputValue(value, settings.currency));
    }
  }, [value, settings.currency]);
  return (
    <div className="relative">
      <span className="pointer-events-none absolute inset-y-0 left-3.5 flex items-center text-sm font-semibold text-ink-3">
        {settings.currency}
      </span>
      <Input
        id={id}
        inputMode="decimal"
        autoComplete="off"
        autoFocus={autoFocus}
        disabled={disabled}
        placeholder={placeholder ?? "0"}
        className="num pl-14 text-lg font-semibold"
        value={text}
        onChange={(e) => {
          const typed = e.target.value;
          setText(typed);
          const parsed = parseMoney(typed, settings.currency);
          last.current = parsed;
          onChange(parsed);
        }}
      />
    </div>
  );
}

export function Toggle({
  checked, onChange, label, description,
}: { checked: boolean; onChange: (v: boolean) => void; label: string; description?: string }) {
  const id = useId();
  return (
    <div className="flex items-center justify-between gap-4 py-2">
      <label htmlFor={id} className="min-w-0 cursor-pointer">
        <div className="text-sm font-medium text-ink">{label}</div>
        {description && <div className="text-xs text-ink-3">{description}</div>}
      </label>
      <button
        id={id}
        role="switch"
        aria-checked={checked}
        onClick={() => onChange(!checked)}
        className={cx(
          "relative h-7 w-12 shrink-0 cursor-pointer rounded-full transition-colors duration-200",
          checked ? "bg-primary" : "bg-line-strong",
        )}
      >
        <span
          className={cx(
            "absolute top-1 left-1 size-5 rounded-full bg-surface shadow transition-transform duration-200",
            checked && "translate-x-5",
          )}
        />
      </button>
    </div>
  );
}

export function Segmented<T extends string>({
  value, onChange, options, label,
}: { value: T; onChange: (v: T) => void; options: { value: T; label: string }[]; label: string }) {
  return (
    <div role="radiogroup" aria-label={label} className="flex gap-1 overflow-x-auto rounded-2xl bg-surface-2 p-1">
      {options.map((o) => (
        <button
          key={o.value}
          role="radio"
          aria-checked={value === o.value}
          onClick={() => onChange(o.value)}
          className={cx(
            "min-h-10 shrink-0 cursor-pointer whitespace-nowrap rounded-xl px-3.5 text-sm font-semibold transition-[background-color,color,box-shadow,transform] duration-200 active:scale-95",
            value === o.value ? "bg-surface text-ink shadow-card" : "text-ink-3 hover:text-ink",
          )}
        >
          {o.label}
        </button>
      ))}
    </div>
  );
}

export function Chip({
  active, onClick, children,
}: { active?: boolean; onClick?: () => void; children: ReactNode }) {
  return (
    <button
      onClick={onClick}
      aria-pressed={active}
      className={cx(
        "min-h-11 shrink-0 cursor-pointer whitespace-nowrap rounded-full px-4 text-sm font-semibold transition-[background-color,color,box-shadow,transform] duration-200 active:scale-95",
        active ? "bg-primary text-on-primary shadow-cta" : "bg-surface text-ink-2 shadow-card ring-1 ring-line hover:bg-surface-2",
      )}
    >
      {children}
    </button>
  );
}

// ---------- sheet / dialog ----------

const DRAWER_EASE = "cubic-bezier(0.32, 0.72, 0, 1)";

/**
 * Bottom sheet on phones (drag the handle or flick down to dismiss), centred
 * dialog on larger screens. Closing by X, backdrop, Escape or swipe animates
 * out first and then calls onClose.
 */
export function Sheet({
  open, onClose, title, children, footer, wide,
}: { open: boolean; onClose: () => void; title: string; children: ReactNode; footer?: ReactNode; wide?: boolean }) {
  const desktop = useMediaQuery("(min-width: 640px)");
  const [rendered, setRendered] = useState(open);
  const panel = useRef<HTMLDivElement>(null);
  const scrim = useRef<HTMLDivElement>(null);
  const closeRef = useRef(onClose);
  closeRef.current = onClose;
  const closing = useRef(false);
  const drag = useRef<{ y: number; t: number; dy: number } | null>(null);

  const hidden = desktop ? "translateY(8px) scale(0.97)" : "translateY(100%)";
  const show = () => {
    const p = panel.current, sc = scrim.current;
    if (!p || !sc) return;
    p.style.transition = `transform ${desktop ? 220 : 340}ms ${DRAWER_EASE}, opacity 180ms ease-out`;
    p.style.transform = "none";
    p.style.opacity = "1";
    sc.style.transition = "opacity 240ms ease-out";
    sc.style.opacity = "1";
  };
  const hide = (then: () => void) => {
    const p = panel.current, sc = scrim.current;
    if (!p || !sc) return then();
    p.style.transition = `transform 220ms ${DRAWER_EASE}, opacity 160ms ease-out`;
    p.style.transform = hidden;
    if (desktop) p.style.opacity = "0";
    sc.style.transition = "opacity 200ms ease-out";
    sc.style.opacity = "0";
    p.parentElement!.style.pointerEvents = "none";
    setTimeout(then, 220);
  };
  const requestClose = () => {
    if (closing.current) return;
    closing.current = true;
    hide(() => closeRef.current());
  };

  useEffect(() => {
    if (open) {
      closing.current = false;
      setRendered(true);
    } else if (rendered) {
      if (closing.current) setRendered(false);
      else hide(() => setRendered(false));
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open]);

  // Enter: start off-screen, then glide in.
  useLayoutEffect(() => {
    if (!rendered || !open) return;
    const p = panel.current, sc = scrim.current;
    if (!p || !sc) return;
    p.parentElement!.style.pointerEvents = "";
    p.style.transition = "none";
    p.style.transform = hidden;
    p.style.opacity = desktop ? "0" : "1";
    sc.style.transition = "none";
    sc.style.opacity = "0";
    p.getBoundingClientRect();
    const raf = requestAnimationFrame(show);
    return () => cancelAnimationFrame(raf);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [rendered, open]);

  // Runs only when the sheet opens, so re-renders while typing never move focus.
  useEffect(() => {
    if (!open || !rendered) return;
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && requestClose();
    document.addEventListener("keydown", onKey);
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    const first = panel.current?.querySelector<HTMLElement>("input, select, textarea, button:not([data-close])");
    // On phones, don't pop the keyboard up over a sheet the user only wanted to look at.
    if (desktop || first?.tagName !== "INPUT" || first.hasAttribute("autofocus")) first?.focus({ preventScroll: true });
    else panel.current?.focus({ preventScroll: true });
    return () => {
      document.removeEventListener("keydown", onKey);
      document.body.style.overflow = prev;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, rendered]);

  if (!rendered) return null;

  const onPointerDown = (e: React.PointerEvent<HTMLDivElement>) => {
    if (desktop || e.button !== 0 || drag.current) return;
    if ((e.target as HTMLElement).closest("button")) return;
    drag.current = { y: e.clientY, t: performance.now(), dy: 0 };
    e.currentTarget.setPointerCapture(e.pointerId);
    if (panel.current) panel.current.style.transition = "none";
    if (scrim.current) scrim.current.style.transition = "none";
  };
  const onPointerMove = (e: React.PointerEvent<HTMLDivElement>) => {
    const d = drag.current, p = panel.current;
    if (!d || !p) return;
    let dy = e.clientY - d.y;
    if (dy < 0) dy = -Math.sqrt(-dy) * 2; // friction when pulling up past the top
    d.dy = dy;
    p.style.transform = `translateY(${dy}px)`;
    if (scrim.current) scrim.current.style.opacity = String(Math.max(0, 1 - Math.max(dy, 0) / p.offsetHeight));
  };
  const onPointerUp = () => {
    const d = drag.current, p = panel.current;
    drag.current = null;
    if (!d || !p) return;
    const velocity = d.dy / Math.max(1, performance.now() - d.t);
    if (d.dy > p.offsetHeight * 0.25 || (velocity > 0.11 && d.dy > 12)) requestClose();
    else show();
  };

  // Rendered at the end of <body>, so no animated or transformed ancestor can
  // trap the sheet beneath the floating tab bar.
  return createPortal(
    <div className="no-print fixed inset-0 z-50 flex items-end justify-center sm:items-center sm:p-6">
      <div ref={scrim} className="absolute inset-0 bg-[var(--scrim)]" style={{ opacity: 0 }} onClick={requestClose} aria-hidden />
      <div
        ref={panel}
        role="dialog"
        aria-modal="true"
        aria-label={title}
        tabIndex={-1}
        style={{ transform: hidden }}
        className={cx(
          "relative flex max-h-[92dvh] w-full flex-col rounded-t-[32px] bg-surface shadow-float outline-none will-change-transform sm:rounded-[28px]",
          wide ? "sm:max-w-2xl" : "sm:max-w-lg",
        )}
      >
        <div
          className="shrink-0 touch-none select-none sm:touch-auto"
          onPointerDown={onPointerDown}
          onPointerMove={onPointerMove}
          onPointerUp={onPointerUp}
          onPointerCancel={onPointerUp}
        >
          <div className="flex justify-center pb-1 pt-2.5 sm:hidden" aria-hidden>
            <span className="h-1.5 w-10 rounded-full bg-line-strong" />
          </div>
          <div className="flex items-center justify-between gap-2 border-b border-line px-5 pb-3 pt-1 sm:pt-3">
            <h2 className="text-xl font-bold tracking-[-0.02em]">{title}</h2>
            <IconButton label={t("Close")} onClick={requestClose} data-close className="-mr-2">
              <X className="size-5" />
            </IconButton>
          </div>
        </div>
        <div className={cx("overscroll-contain overflow-y-auto px-5 py-4", !footer && "pb-[max(env(safe-area-inset-bottom),1rem)]")}>{children}</div>
        {footer && <div className="shrink-0 border-t border-line px-5 pt-3 pb-[max(env(safe-area-inset-bottom),0.75rem)]">{footer}</div>}
      </div>
    </div>,
    document.body,
  );
}

/** Ask for a reason before voiding something. */
export function VoidSheet({
  open, onClose, title, onConfirm, children,
}: { open: boolean; onClose: () => void; title: string; onConfirm: (reason: string) => Promise<boolean>; children?: ReactNode }) {
  const [reason, setReason] = useState("");
  const [busy, setBusy] = useState(false);
  useEffect(() => {
    if (open) setReason("");
  }, [open]);
  return (
    <Sheet
      open={open}
      onClose={onClose}
      title={title}
      footer={
        <div className="flex gap-2">
          <Button variant="secondary" block onClick={onClose}>
            {t("Keep it")}
          </Button>
          <Button
            variant="danger"
            block
            loading={busy}
            disabled={reason.trim().length < 3}
            onClick={async () => {
              setBusy(true);
              const ok = await onConfirm(reason.trim());
              setBusy(false);
              if (ok) onClose();
            }}
          >
            {t("Void")}
          </Button>
        </div>
      }
    >
      <div className="space-y-4">
        {children}
        <p className="text-sm text-ink-3">
          {t("Voiding keeps the record in the history, marked as cancelled, and removes it from all totals. The owner can see who voided it and why.")}
        </p>
        <Field label={t("Reason")} htmlFor="void-reason">
          <Input id="void-reason" value={reason} onChange={(e) => setReason(e.target.value)} placeholder={t("e.g. Entered twice by mistake")} />
        </Field>
      </div>
    </Sheet>
  );
}

// ---------- money ----------

export function useMoney() {
  const { settings } = useApp();
  return (minor: number, opts?: { sign?: boolean }) => formatMoney(minor, settings.currency, opts);
}

export function Money({ value, sign, className }: { value: number; sign?: boolean; className?: string }) {
  const fmt = useMoney();
  return <span className={cx("num", className)}>{fmt(value, { sign })}</span>;
}

// ---------- PIN pad ----------

export function PinPad({
  onSubmit, busy, error, length = 4,
}: { onSubmit: (pin: string) => void; busy?: boolean; error?: string | null; length?: number }) {
  const [pin, setPin] = useState("");
  // Enter reads the current PIN from here, so submitting never happens inside a state update.
  const pinRef = useRef(pin);
  pinRef.current = pin;
  const dots = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (!error) return;
    setPin("");
    haptic("error");
    dots.current?.animate(
      [{ transform: "translateX(0)" }, { transform: "translateX(-10px)" }, { transform: "translateX(9px)" }, { transform: "translateX(-6px)" }, { transform: "translateX(3px)" }, { transform: "translateX(0)" }],
      { duration: 380, easing: "cubic-bezier(0.36, 0.07, 0.19, 0.97)" },
    );
  }, [error]);
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (/^\d$/.test(e.key)) setPin((p) => (p.length < 6 ? p + e.key : p));
      else if (e.key === "Backspace") setPin((p) => p.slice(0, -1));
      else if (e.key === "Enter" && pinRef.current.length >= 4) onSubmit(pinRef.current);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onSubmit]);
  const press = (d: string) => {
    haptic();
    setPin((p) => (p.length < 6 ? p + d : p));
  };
  const keys = ["1", "2", "3", "4", "5", "6", "7", "8", "9"];
  return (
    <div className="mx-auto w-full max-w-xs">
      <div ref={dots} className="mb-2 flex h-6 items-center justify-center gap-3" aria-label={plural(pin.length, "{n} digit entered", "{n} digits entered")}>
        {Array.from({ length: Math.max(length, pin.length) }).map((_, i) => (
          <span
            key={i}
            className={cx(
              "size-3.5 rounded-full border-2 transition-[background-color,border-color,transform,box-shadow] duration-200 ease-[cubic-bezier(0.34,1.56,0.64,1)]",
              i < pin.length ? "scale-125 border-primary bg-primary" : "border-line-strong",
            )}
          />
        ))}
      </div>
      <p className="mb-[clamp(6px,1.6dvh,16px)] h-5 text-center text-sm text-negative" role="alert">
        {error ? tMessage(error) : ""}
      </p>
      <div className="grid grid-cols-3 gap-[clamp(8px,1.3dvh,12px)]">
        {keys.map((k) => (
          <PadKey key={k} onClick={() => press(k)}>
            {k}
          </PadKey>
        ))}
        <PadKey onClick={() => setPin((p) => p.slice(0, -1))} label={t("Delete last digit")}>
          <Delete className="size-6" />
        </PadKey>
        <PadKey onClick={() => press("0")}>0</PadKey>
        <button
          disabled={pin.length < 4 || busy}
          onClick={() => onSubmit(pin)}
          className="flex h-[clamp(46px,7dvh,64px)] cursor-pointer items-center justify-center rounded-[22px] bg-primary text-base font-bold text-on-primary shadow-[inset_0_1px_0_rgb(255_255_255/0.22),var(--shadow-primary)] transition-[transform,background-color,color,box-shadow] duration-200 active:scale-95 disabled:cursor-default disabled:bg-surface disabled:text-ink-3 disabled:shadow-none disabled:ring-1 disabled:ring-line"
        >
          {busy ? <Loader2 className="size-5 animate-spin" /> : t("OK")}
        </button>
      </div>
    </div>
  );
}

function PadKey({ children, onClick, label }: { children: ReactNode; onClick: () => void; label?: string }) {
  return (
    <button
      aria-label={label}
      onClick={onClick}
      className="num flex h-[clamp(46px,7dvh,64px)] cursor-pointer items-center justify-center rounded-[22px] bg-surface text-2xl font-semibold text-ink shadow-card ring-1 ring-line transition-[transform,background-color] duration-150 active:scale-95 active:bg-surface-2"
    >
      {children}
    </button>
  );
}

export function Signature() {
  return (
    <p className="flex flex-wrap items-baseline justify-center gap-x-2 text-center">
      <span className="text-[10px] font-medium uppercase tracking-[0.4em] text-ink/30 transition-opacity hover:text-ink/60">
        Developed by
      </span>
      <a
        href="mailto:kenj52974@gmail.com"
        aria-label="Contact the developer, W!CE"
        className="animate-sheen bg-[linear-gradient(110deg,var(--ink-3)_20%,var(--ink)_45%,var(--ink-3)_70%)] bg-[length:250%_100%] bg-clip-text text-base font-black tracking-wider text-transparent"
      >
        W!CE
      </a>
    </p>
  );
}

// ---------- count-up figures ----------

/**
 * A number that rolls up to its value when it first appears (or changes), the
 * way premium finance apps animate balances. Shows the final value at once
 * when the person prefers reduced motion.
 */
export function CountUp({ value, format, duration = 900, className }: { value: number; format: (n: number) => string; duration?: number; className?: string }) {
  const [shown, setShown] = useState(value);
  const from = useRef(0);
  useEffect(() => {
    const reduce = typeof window !== "undefined" && window.matchMedia?.("(prefers-reduced-motion: reduce)").matches;
    if (reduce || value === from.current) {
      setShown(value);
      from.current = value;
      return;
    }
    const start = performance.now();
    const a = from.current;
    let raf = 0;
    const tick = (now: number) => {
      const progress = Math.min(1, (now - start) / duration);
      const eased = 1 - Math.pow(1 - progress, 4);
      setShown(Math.round(a + (value - a) * eased));
      if (progress < 1) raf = requestAnimationFrame(tick);
      else from.current = value;
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [value, duration]);
  return (
    <span className={cx("num", className)} aria-label={format(value)}>
      <span aria-hidden>{format(shown)}</span>
    </span>
  );
}
