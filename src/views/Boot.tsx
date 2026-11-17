"use client";

import { useCallback, useEffect, useState } from "react";
import { AppWindow, ArchiveRestore, ChevronRight, FileUp, ShieldCheck, WifiOff } from "lucide-react";
import type { Actor } from "@/core/commands.ts";
import { isValidPin, verifyPin } from "@/core/pin.ts";
import { ROLE_LABEL, type Role } from "@/core/permissions.ts";
import { AppProvider } from "@/client/app-context.tsx";
import { Engine } from "@/client/engine.ts";
import { backupTables, inspectBackup, openLocalStore, setMeta, type BackupSummary, type LocalStore } from "@/client/localdb.ts";
import { formatDate } from "@/core/dates.ts";
import { Button, Card, Field, Input, LogoMark, PinPad, Select, Signature, Spinner, cx } from "@/components/ui.tsx";
import { Shell } from "./Shell.tsx";
import { LanguageSwitch, useLang } from "@/components/i18n.tsx";
import { applyStoredTheme } from "@/components/theme.tsx";
import { getLang, locale, plural, t, tk, tMessage } from "@/core/i18n.ts";

type Phase =
  | { name: "loading" }
  | { name: "error"; message: string }
  | { name: "setup" }
  | { name: "register"; users: { id: string; name: string; role: Role }[]; shopName: string | null }
  | { name: "login" }
  | { name: "app"; user: Actor }
  // Another tab has the shop open. `moved`: this tab had it and handed over.
  | { name: "elsewhere"; moved: boolean };

const SESSION_KEY = "bms_session";
/** Tabs talk here so one can ask the other to step aside ("Use here"). */
const TAB_CHANNEL = "bms-tab";

export default function Boot() {
  // Re-render the whole app when the language changes.
  useLang();
  // The server pre-renders in English but a phone may be in French: show a
  // wordless splash until mounted, so the first paint never disagrees.
  const [mounted, setMounted] = useState(false);
  useEffect(() => {
    setMounted(true);
    applyStoredTheme(); // match the phone's status bar to this device's Light/Dark choice
  }, []);
  const [store, setStore] = useState<LocalStore | null>(null);
  const [engine, setEngine] = useState<Engine | null>(null);
  const [phase, setPhase] = useState<Phase>({ name: "loading" });

  const startEngine = useCallback(async (s: LocalStore, device: { id: string; code: string }) => {
    const e = new Engine(s, device.id, device.code);
    e.onDeviceRevoked = async () => {
      await s.wipe();
      sessionStorage.removeItem(SESSION_KEY);
      setEngine(null);
      setPhase({ name: "loading" });
      void checkServer(s);
    };
    setEngine(e);
    return e;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const checkServer = useCallback(async (s: LocalStore) => {
    try {
      const res = await fetch("/api/status", { credentials: "same-origin" });
      const data = await res.json();
      if (!data.setup) return setPhase({ name: "setup" });
      if (data.device) {
        await setMeta(s, "device_id", data.device.id);
        await setMeta(s, "device_code", data.device.code);
        await s.flush();
        const e = await startEngine(s, data.device);
        await e.sync();
        return setPhase({ name: "login" });
      }
      setPhase({ name: "register", users: data.users, shopName: data.shopName });
    } catch {
      setPhase({
        name: "error",
        message: tk("This device is not connected to the shop yet, and the server can't be reached. Connect to the internet once to set it up."),
      });
    }
  }, [startEngine]);

  useEffect(() => {
    if ("serviceWorker" in navigator && process.env.NODE_ENV === "production") {
      void navigator.serviceWorker.register("/sw.js");
    }
    let cancelled = false;
    // Releases the one-tab lock. It must be released on unmount: React runs this
    // effect twice in development, and hot reloads remount it, so a lock that is
    // never let go makes the second run think another tab has the app open.
    let releaseLock: (() => void) | undefined;
    let opened: LocalStore | null = null;
    const channel = typeof BroadcastChannel !== "undefined" ? new BroadcastChannel(TAB_CHANNEL) : null;
    const tryLock = () =>
      new Promise<boolean>((resolve) => {
        void navigator.locks.request("bms-db", { ifAvailable: true }, (lock) => {
          resolve(!!lock);
          return lock ? new Promise<void>((r) => (releaseLock = r)) : undefined;
        });
      });
    (async () => {
      try {
        if (navigator.locks) {
          // A lock released by an unmount a moment ago frees asynchronously, so
          // retry briefly before deciding another tab really holds it.
          let held = await tryLock();
          for (let i = 0; !held && !cancelled && i < 10; i++) {
            await new Promise((r) => setTimeout(r, 100));
            held = await tryLock();
          }
          if (cancelled) {
            releaseLock?.();
            return;
          }
          if (!held) {
            setPhase({ name: "elsewhere", moved: false });
            return;
          }
          // Holding the shop: if another tab asks to take over, save everything
          // to the device first, stop syncing, then let go and step aside.
          if (channel) {
            channel.onmessage = async (e) => {
              if (e.data !== "takeover" || cancelled) return;
              cancelled = true;
              try {
                await opened?.flush();
              } catch {
                /* the database stays as last saved; the other tab reads that */
              }
              setEngine(null);
              releaseLock?.();
              releaseLock = undefined;
              setPhase({ name: "elsewhere", moved: true });
            };
          }
        }
        const s = await openLocalStore();
        opened = s;
        if (cancelled) return;
        setStore(s);
        const device = await Engine.readDevice(s);
        if (device) {
          await startEngine(s, device);
          const saved = sessionStorage.getItem(SESSION_KEY);
          const user = saved ? await loadActor(s, saved) : null;
          setPhase(user ? { name: "app", user } : { name: "login" });
        } else {
          await checkServer(s);
        }
      } catch (e) {
        console.error(e);
        setPhase({ name: "error", message: tk("Could not open the app's offline storage on this browser.") });
      }
    })();
    return () => {
      cancelled = true;
      channel?.close();
      releaseLock?.();
    };
  }, [checkServer, startEngine]);

  useEffect(() => engine?.start(), [engine]);

  const signIn = (user: Actor) => {
    sessionStorage.setItem(SESSION_KEY, user.id);
    setPhase({ name: "app", user });
  };
  const lock = useCallback(() => {
    sessionStorage.removeItem(SESSION_KEY);
    setPhase({ name: "login" });
  }, []);

  const afterConnect = async (deviceId: string, deviceCode: string, userId: string) => {
    if (!store) return;
    await setMeta(store, "device_id", deviceId);
    await setMeta(store, "device_code", deviceCode);
    await store.flush();
    const e = await startEngine(store, { id: deviceId, code: deviceCode });
    await e.sync();
    const user = await loadActor(store, userId);
    if (user) signIn(user);
    else setPhase({ name: "login" });
  };

  switch (phase.name) {
    case "loading":
      if (!mounted) return <Splash />;
      return (
        <Centered>
          <Spinner label={t("Opening")} />
        </Centered>
      );
    case "error":
      return (
        <Centered>
          <Card className="max-w-md p-6 text-center">
            <WifiOff className="mx-auto mb-3 size-8 text-ink-3" />
            <p className="text-ink-2">{t(phase.message)}</p>
            <Button className="mt-5" onClick={() => location.reload()}>
              {t("Try again")}
            </Button>
          </Card>
        </Centered>
      );
    case "elsewhere":
      return <OpenElsewhere moved={phase.moved} />;
    case "setup":
      return <Setup onDone={afterConnect} store={store} />;
    case "register":
      return <Register users={phase.users} shopName={phase.shopName} onDone={afterConnect} />;
    case "login":
      return store ? <Login store={store} onSignIn={signIn} /> : null;
    case "app":
      return store && engine ? (
        <AppProvider store={store} engine={engine} user={phase.user} onLock={lock}>
          <Shell />
        </AppProvider>
      ) : null;
  }
}

async function loadActor(store: LocalStore, id: string): Promise<Actor | null> {
  const u = await store.get<{ id: string; name: string; role: Role }>(
    "SELECT id, name, role FROM users WHERE id = ? AND active = 1",
    [id],
  );
  return u ?? null;
}

/**
 * The dark stage behind sign-in, setup and loading: an orange glow falling into
 * espresso over a dimmed barber photo. `.theme-panel` flips every token to its
 * dark-glass variant, so forms, PIN pad and buttons all read correctly here.
 */
function Centered({ children, shopName }: { children: React.ReactNode; shopName?: string | null }) {
  return (
    <main className="theme-panel relative isolate min-h-dvh overflow-hidden bg-[#120d0a] md:grid md:grid-cols-[minmax(0,1.1fr)_minmax(380px,1fr)]">
      {/* Atmosphere behind everything: graded photo, two drifting orange auroras, grain. */}
      <div aria-hidden className="pointer-events-none fixed inset-0 -z-10">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src="/img/hero-dark.webp" alt="" className="absolute inset-0 size-full animate-kenburns object-cover opacity-[0.22] grayscale md:opacity-[0.08]" />
        <div className="absolute inset-0 bg-[linear-gradient(180deg,rgb(214_96_44/0.85)_0%,rgb(120_48_20/0.5)_30%,rgb(18_13_10/0.94)_64%,#120d0a_100%)] md:bg-[radial-gradient(120%_80%_at_100%_0%,rgb(160_62_26/0.55),transparent_60%),linear-gradient(#120d0a,#120d0a)]" />
        <div className="absolute -left-24 -top-24 size-[26rem] animate-glow rounded-full bg-[radial-gradient(circle,rgb(255_140_80/0.42),transparent_65%)] blur-2xl md:left-auto md:right-[-8rem]" />
        <div className="absolute -bottom-40 right-[-6rem] size-[30rem] animate-glow rounded-full bg-[radial-gradient(circle,rgb(207_74_31/0.28),transparent_65%)] blur-3xl [animation-delay:-4s]" />
        <div className="ndop absolute inset-0 opacity-[0.035]" />
        <div className="grain absolute inset-0" />
      </div>

      <Showcase shopName={shopName} />

      {/* FR | EN, top-right of the stage, clear of the notch; the column below is padded so it never covers the clock or brand. */}
      <div className="absolute right-4 top-[max(env(safe-area-inset-top),1rem)] z-20">
        <LanguageSwitch />
      </div>

      <div className="relative flex min-h-dvh flex-col items-center justify-center px-5 pb-[max(env(safe-area-inset-bottom),1.5rem)] pt-[calc(max(env(safe-area-inset-top),1rem)+3.25rem)] sm:px-8 md:py-6">
        <div className="animate-rise flex w-full flex-col items-center">{children}</div>
      </div>
    </main>
  );
}

/**
 * The shop can only be open in one tab at a time (two tabs writing the same
 * on-device database would overwrite each other). Instead of a dead end, offer
 * "Use here": the other tab saves, steps aside, and this one opens.
 */
function OpenElsewhere({ moved }: { moved: boolean }) {
  const [busy, setBusy] = useState(false);
  const useHere = async () => {
    setBusy(true);
    if (typeof BroadcastChannel !== "undefined") {
      const ch = new BroadcastChannel(TAB_CHANNEL);
      ch.postMessage("takeover");
      ch.close();
    }
    // Wait (up to 6 s) for the other tab to save and let go, then start fresh here.
    try {
      if (navigator.locks) await navigator.locks.request("bms-db", { signal: AbortSignal.timeout(6000) }, async () => {});
    } catch {
      /* timed out: reloading shows this screen again if the other tab still has it */
    }
    location.reload();
  };
  return (
    <Centered>
      <div className="flex w-full max-w-sm flex-col items-center text-center">
        <div className="relative mb-6 flex size-24 items-center justify-center">
          <span aria-hidden className="absolute inset-0 animate-float-slow rounded-full border border-white/15" />
          <span aria-hidden className="absolute inset-3 animate-float rounded-full border border-white/20 [animation-delay:-2s]" />
          <span className="relative flex size-14 items-center justify-center rounded-2xl bg-surface text-ink ring-1 ring-line backdrop-blur-md">
            <AppWindow className="size-7" />
          </span>
        </div>
        <p className="font-serif text-2xl italic text-ink-2">{moved ? t("Moved to another tab") : t("Already open")}</p>
        <h1 className="mt-1 text-[30px] font-extrabold leading-tight tracking-[-0.03em]">
          {moved ? t("You're using the shop in another tab") : t("The shop is open in another tab")}
        </h1>
        <p className="mt-3 text-[15px] text-ink-2">
          {t("It can only be open in one tab at a time, so no sale is ever overwritten. Your work is saved — switch here and carry on.")}
        </p>
        <Button size="lg" block className="mt-8" loading={busy} onClick={useHere}>
          {t("Use here")}
        </Button>
        <p className="mt-3 text-xs text-ink-3">{t("The other tab will save and step aside.")}</p>
      </div>
    </Centered>
  );
}

/** First paint before the language is known: the dark stage and the logo, no words. */
function Splash() {
  return (
    <main aria-busy="true" className="flex min-h-dvh items-center justify-center bg-[#120d0a]">
      <span className="flex size-16 animate-pulse items-center justify-center rounded-[22px] bg-[#1b1410] ring-1 ring-white/10 shadow-[0_14px_32px_-12px_rgb(236_106_56/0.7)]">
        <LogoMark className="size-10" />
      </span>
    </main>
  );
}

/** Ticks once per minute boundary. Null until mounted, so the server render never disagrees with the client. */
function useNow() {
  const [now, setNow] = useState<Date | null>(null);
  useEffect(() => {
    setNow(new Date());
    let interval: ReturnType<typeof setInterval> | undefined;
    const align = setTimeout(() => {
      setNow(new Date());
      interval = setInterval(() => setNow(new Date()), 60_000);
    }, 60_000 - (Date.now() % 60_000));
    return () => {
      clearTimeout(align);
      if (interval) clearInterval(interval);
    };
  }, []);
  return now;
}

function welcome(d: Date | null) {
  const h = d?.getHours() ?? 9;
  return h < 12 ? t("Good morning, welcome to") : h < 17 ? t("Good afternoon, welcome to") : t("Good evening, welcome to");
}

/**
 * The left half on tablets and computers: a framed, colour-graded photo with a
 * live clock and the shop's name, like a phone's lock screen blown up.
 */
function Showcase({ shopName }: { shopName?: string | null }) {
  const now = useNow();
  const time = now ? now.toLocaleTimeString(locale(), { hour: "2-digit", minute: "2-digit" }) : "··:··";
  const date = now ? now.toLocaleDateString(locale(), { weekday: "long", day: "numeric", month: "long" }) : " ";
  return (
    <aside aria-hidden className="relative m-3 hidden overflow-hidden rounded-[36px] ring-1 ring-white/10 md:block">
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img src="/img/hero-dark.webp" alt="" className="absolute inset-0 size-full animate-kenburns object-cover grayscale" />
      {/* Warm grade + vignette over the black-and-white photo. */}
      <div className="absolute inset-0 bg-[linear-gradient(160deg,rgb(232_110_52/0.55)_0%,rgb(120_46_18/0.35)_38%,rgb(16_11_8/0.92)_78%)] mix-blend-multiply" />
      <div className="absolute inset-0 bg-[radial-gradient(90%_70%_at_30%_100%,rgb(0_0_0/0.75),transparent_70%)]" />
      <div className="rings absolute inset-0 animate-float-slow opacity-70" />
      <div className="ndop absolute inset-0 opacity-[0.06]" />
      <div className="grain absolute inset-0" />

      <div className="relative flex h-full flex-col justify-between p-10 xl:p-14">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <span className="flex size-11 items-center justify-center rounded-2xl bg-white/10 ring-1 ring-white/20 backdrop-blur-md">
              <LogoMark className="size-7" />
            </span>
            <span className="whitespace-nowrap text-[11px] font-semibold uppercase tracking-[0.3em] text-white/75">Barbershop Manager</span>
          </div>
          <span className="hidden items-center gap-2 rounded-full bg-black/25 px-3.5 lg:flex py-1.5 text-xs font-semibold text-white/85 ring-1 ring-white/15 backdrop-blur-md">
            <span className="relative flex size-2">
              <span className="absolute inset-0 animate-ping rounded-full bg-[#7be2a9] opacity-60" />
              <span className="relative size-2 rounded-full bg-[#7be2a9]" />
            </span>
            {t("Ready for today")}
          </span>
        </div>

        {/* Floating glass badges */}
        <div className="pointer-events-none absolute right-10 top-[30%] flex flex-col items-end gap-3 xl:right-14 [@media(max-height:720px)]:hidden">
          <Badge3 icon={<ShieldCheck className="size-4" />} className="animate-float">{t("Everyone signs in with their own PIN")}</Badge3>
          <Badge3 icon={<WifiOff className="size-4" />} className="mr-10 animate-float [animation-delay:-2.5s]">{t("Keeps working with no internet")}</Badge3>
          <Badge3 icon={<ArchiveRestore className="size-4" />} className="mr-3 animate-float [animation-delay:-5s]">{t("Every sale backed up")}</Badge3>
        </div>

        <div>
          <p className="num text-[clamp(72px,min(9vw,17dvh),148px)] font-extrabold leading-[0.85] tracking-[-0.06em] text-white">{time}</p>
          <p className="mt-4 text-lg font-medium text-white/75">{date}</p>
          <div className="mt-[clamp(16px,4dvh,40px)]">
            {/* Toghu embroidery band in place of a plain rule. */}
            <div aria-hidden className="toghu-band mb-[clamp(12px,2.5dvh,24px)] opacity-90" />
            <p className="font-serif text-2xl italic text-white/80">{welcome(now)}</p>
            <p className="mt-1 text-[clamp(40px,4.4vw,68px)] font-extrabold leading-none tracking-[-0.04em] text-white">
              {shopName || t("your shop")}
            </p>
          </div>
        </div>
      </div>
      {/* A comet of light that travels round the card's edge. */}
      <div className="orbit-border" />
    </aside>
  );
}

function Badge3({ icon, children, className }: { icon: React.ReactNode; children: React.ReactNode; className?: string }) {
  return (
    <span className={cx("flex items-center gap-2.5 rounded-2xl bg-white/10 py-2.5 pl-2.5 pr-4 text-sm font-semibold text-white shadow-[0_20px_40px_-20px_rgb(0_0_0/0.8)] ring-1 ring-white/15 backdrop-blur-xl", className)}>
      <span className="flex size-8 items-center justify-center rounded-xl bg-[#d4501f] shadow-[inset_0_1px_0_rgb(255_255_255/0.3)]">{icon}</span>
      {children}
    </span>
  );
}

/** Phone lock-screen header: the time, large, above the sign-in. Hidden where the showcase shows it. */
function PhoneClock() {
  const now = useNow();
  return (
    <div className="mb-[clamp(10px,2.5dvh,24px)] text-center md:hidden" aria-hidden>
      <p className="num text-[clamp(44px,7.5dvh,64px)] font-extrabold leading-none tracking-[-0.05em] text-white">
        {now ? now.toLocaleTimeString(locale(), { hour: "2-digit", minute: "2-digit" }) : "··:··"}
      </p>
      <p className="mt-1 text-sm font-medium text-white/70">
        {now ? now.toLocaleDateString(locale(), { weekday: "long", day: "numeric", month: "long" }) : " "}
      </p>
    </div>
  );
}

function Brand({ shopName }: { shopName?: string | null }) {
  return (
    <div className="mb-[clamp(12px,3dvh,32px)] flex flex-col items-center text-center">
      <div className="relative mb-[clamp(4px,1.4dvh,16px)] flex size-[clamp(56px,8.5dvh,80px)] items-center justify-center [@media(max-height:700px)]:hidden">
        <span aria-hidden className="absolute inset-0 animate-float-slow rounded-full border border-white/15" />
        <span aria-hidden className="absolute inset-2.5 animate-float rounded-full border border-white/20 [animation-delay:-2s]" />
        <span className="relative flex size-12 items-center justify-center rounded-2xl bg-[#1b1410] ring-1 ring-white/15 shadow-[inset_0_1px_0_rgb(255_255_255/0.08),0_12px_28px_-10px_rgb(236_106_56/0.8)]">
          <LogoMark className="size-8" />
        </span>
      </div>
      <p className="text-[11px] font-semibold uppercase tracking-[0.28em] text-ink-2">Barbershop Manager</p>
      {shopName && <h1 className="mt-1.5 text-[28px] font-extrabold tracking-[-0.03em]">{shopName}</h1>}
    </div>
  );
}

// ---------- login ----------

function Login({ store, onSignIn }: { store: LocalStore; onSignIn: (u: Actor) => void }) {
  const [users, setUsers] = useState<(Actor & { pin_hash: string; pin_salt: string })[] | null>(null);
  const [shopName, setShopName] = useState<string | null>(null);
  const [selected, setSelected] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [failures, setFailures] = useState(0);
  const [lockedUntil, setLockedUntil] = useState(0);

  useEffect(() => {
    const load = async () => {
      setUsers(
        await store.all(
          "SELECT id, name, role, pin_hash, pin_salt FROM users WHERE active = 1 ORDER BY CASE role WHEN 'owner' THEN 0 WHEN 'manager' THEN 1 ELSE 2 END, name",
        ),
      );
      const s = await store.get<{ value: string }>("SELECT value FROM settings WHERE id = 'shop_name'");
      setShopName(s?.value ?? null);
    };
    void load();
    return store.onChange(() => void load());
  }, [store]);

  const user = users?.find((u) => u.id === selected);

  const submit = useCallback(
    async (pin: string) => {
      if (!user) return;
      if (Date.now() < lockedUntil) {
        setError(t("Too many wrong PINs. Wait 30 seconds."));
        return;
      }
      setBusy(true);
      const ok = await verifyPin(pin, user.pin_salt, user.pin_hash);
      setBusy(false);
      if (ok) {
        setFailures(0);
        onSignIn({ id: user.id, name: user.name, role: user.role });
      } else {
        const n = failures + 1;
        setFailures(n);
        if (n >= 5) {
          setLockedUntil(Date.now() + 30_000);
          setFailures(0);
          setError(t("Too many wrong PINs. Wait 30 seconds."));
        } else setError(t("Wrong PIN. Try again."));
      }
    },
    [user, failures, lockedUntil, onSignIn],
  );

  if (!users) return <Centered shopName={shopName}><Spinner /></Centered>;

  return (
    <Centered shopName={shopName}>
      <div className="w-full max-w-sm">
        <div className={user ? "[@media(max-height:760px)]:hidden" : undefined}>
          <PhoneClock />
        </div>
        {/* Once a person is chosen their avatar says who it is; dropping the logo keeps the PIN pad on screen. */}
        {!user && (
          <div className="md:hidden">
            <Brand shopName={shopName} />
          </div>
        )}
        <div className={cx("mb-[clamp(12px,3.5dvh,32px)] hidden text-center md:block", user && "[@media(max-height:760px)]:!hidden")}>
          <p className="font-serif text-[28px] italic leading-none text-accent">{t("Welcome back")}</p>
          <h1 className="mt-2.5 text-balance font-display text-[32px] font-bold uppercase leading-[1.05] tracking-[-0.01em]">{t("Sign in")}</h1>
        </div>
        {!user ? (
          <>
            <h2 className="mb-3 text-center text-sm font-semibold text-ink-3 md:text-left">{t("Who is signing in?")}</h2>
            {users.length === 0 ? (
              <p className="text-center text-sm text-ink-3">{t("Downloading the shop's data… make sure this device is online.")}</p>
            ) : (
              <div className="stagger grid gap-2.5">
                {users.map((u) => (
                  <button
                    key={u.id}
                    onClick={() => {
                      setSelected(u.id);
                      setError(null);
                    }}
                    className="press flex min-h-[72px] cursor-pointer items-center gap-3 rounded-[22px] bg-surface px-3.5 text-left ring-1 ring-line backdrop-blur-md hover:bg-surface-2"
                  >
                    <Avatar name={u.name} />
                    <div className="min-w-0 flex-1">
                      <div className="font-semibold">{u.name}</div>
                      <div className="text-sm text-ink-3">{t(ROLE_LABEL[u.role])}</div>
                    </div>
                    <ChevronRight className="size-5 text-ink-3" />
                  </button>
                ))}
              </div>
            )}
          </>
        ) : (
          <div key={user.id} className="animate-rise">
            <div className="mb-[clamp(10px,2.6dvh,28px)] flex flex-col items-center">
              <span className="relative">
                <span aria-hidden className="absolute -inset-3 animate-glow rounded-[34px] bg-[radial-gradient(circle,rgb(236_106_56/0.55),transparent_70%)] blur-md" />
                <span className="relative block"><Avatar name={user.name} large /></span>
              </span>
              <p className="mt-[clamp(8px,1.8dvh,16px)] font-serif text-[22px] italic leading-none text-ink-2">{t("Hello,")}</p>
              <p className="mt-1.5 max-w-full truncate font-display text-[26px] font-bold leading-tight tracking-[-0.01em]">{user.name}</p>
              <button className="mt-1 min-h-11 cursor-pointer rounded-full px-3.5 text-[13px] font-semibold tracking-[0.01em] text-ink-3 underline decoration-line-strong underline-offset-4 transition-colors hover:text-accent hover:decoration-accent" onClick={() => setSelected(null)}>
                {t("Not you?")}
              </button>
            </div>
            <PinPad onSubmit={submit} busy={busy} error={error} />
          </div>
        )}
        <div className="mt-[clamp(14px,4dvh,48px)]">
          <Signature />
        </div>
      </div>
    </Centered>
  );
}


export function Avatar({ name, large, small }: { name: string; large?: boolean; small?: boolean }) {
  const initials = name
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((p) => p[0]?.toUpperCase())
    .join("");
  return (
    <span
      aria-hidden
      className={cx(
        "flex shrink-0 items-center justify-center bg-linear-to-br from-[#f59a63] to-[#c2461d] font-display font-bold text-white shadow-[inset_0_1px_0_rgb(255_255_255/0.3)]",
        large ? "size-[clamp(60px,9dvh,80px)] rounded-[clamp(20px,3dvh,26px)] text-2xl" : small ? "size-9 rounded-full text-xs" : "size-11 rounded-2xl text-sm",
      )}
    >
      {initials}
    </span>
  );
}

// ---------- first run ----------

// Cameroon first (XAF, the default); names are translated where they're shown.
const CURRENCIES = [
  ["XAF", tk("CFA franc (CEMAC)")], ["XOF", tk("CFA franc (UEMOA)")],
  ["NGN", tk("Nigerian naira")], ["GHS", tk("Ghanaian cedi")], ["KES", tk("Kenyan shilling")], ["UGX", tk("Ugandan shilling")],
  ["TZS", tk("Tanzanian shilling")], ["RWF", tk("Rwandan franc")], ["ZAR", tk("South African rand")], ["ZMW", tk("Zambian kwacha")],
  ["ETB", tk("Ethiopian birr")], ["EUR", tk("Euro")], ["USD", tk("US dollar")], ["GBP", tk("British pound")], ["INR", tk("Indian rupee")],
];

function Setup({ onDone, store }: { onDone: (deviceId: string, code: string, userId: string) => Promise<void>; store: LocalStore | null }) {
  const [restoring, setRestoring] = useState(false);
  if (restoring && store) return <Restore store={store} onDone={onDone} onCancel={() => setRestoring(false)} />;
  return <NewShop onDone={onDone} onRestore={() => setRestoring(true)} />;
}

function NewShop({ onDone, onRestore }: { onDone: (deviceId: string, code: string, userId: string) => Promise<void>; onRestore: () => void }) {
  const [shopName, setShopName] = useState("");
  const [ownerName, setOwnerName] = useState("");
  const [currency, setCurrency] = useState("XAF");
  const [pin, setPin] = useState("");
  const [pin2, setPin2] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    if (!shopName.trim() || !ownerName.trim()) return setError(t("Enter the shop name and your name."));
    if (!isValidPin(pin)) return setError(t("Your PIN must be 4 to 6 digits."));
    if (pin !== pin2) return setError(t("The two PINs don't match."));
    setBusy(true);
    try {
      const res = await fetch("/api/setup", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ shopName, ownerName, currency, pin, deviceName: deviceName(), lang: getLang() }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ? tMessage(data.error) : t("Setup failed."));
      await onDone(data.deviceId, data.deviceCode, data.userId);
    } catch (err) {
      setError(err instanceof Error ? err.message : t("Setup failed."));
      setBusy(false);
    }
  };

  return (
    <Centered>
      <div className="w-full max-w-md">
        <Brand />
        <Card className="p-6 backdrop-blur-xl">
          <h1 className="text-[26px] font-extrabold tracking-[-0.03em]">{t("Set up your shop")}</h1>
          <p className="mt-1 text-sm text-ink-2">{t("You'll be the owner. You can add your manager, cashier and staff next.")}</p>
          <form onSubmit={submit} className="mt-5 space-y-4">
            <Field label={t("Shop name")} htmlFor="shop">
              <Input id="shop" value={shopName} onChange={(e) => setShopName(e.target.value)} autoComplete="organization" />
            </Field>
            <Field label={t("Your name")} htmlFor="owner">
              <Input id="owner" value={ownerName} onChange={(e) => setOwnerName(e.target.value)} autoComplete="name" />
            </Field>
            <Field label={t("Currency")} htmlFor="currency" hint={t("All amounts in the app use this currency.")}>
              <Select id="currency" value={currency} onChange={(e) => setCurrency(e.target.value)}>
                {CURRENCIES.map(([code, name]) => (
                  <option key={code} value={code}>
                    {code} — {t(name)}
                  </option>
                ))}
              </Select>
            </Field>
            <div className="grid grid-cols-2 gap-3">
              <Field label={t("Owner PIN")} htmlFor="pin" hint={t("4–6 digits")}>
                <Input id="pin" type="password" inputMode="numeric" autoComplete="new-password" value={pin} onChange={(e) => setPin(e.target.value.replace(/\D/g, "").slice(0, 6))} />
              </Field>
              <Field label={t("Repeat PIN")} htmlFor="pin2">
                <Input id="pin2" type="password" inputMode="numeric" autoComplete="new-password" value={pin2} onChange={(e) => setPin2(e.target.value.replace(/\D/g, "").slice(0, 6))} />
              </Field>
            </div>
            {error && <p className="text-sm text-negative" role="alert">{error}</p>}
            <Button type="submit" size="lg" block loading={busy}>
              {t("Create shop")}
            </Button>
          </form>
        </Card>
        <button onClick={onRestore} className="press mt-4 flex min-h-[52px] w-full cursor-pointer items-center justify-center gap-2 rounded-2xl bg-surface text-sm font-semibold text-ink-2 ring-1 ring-line backdrop-blur-md hover:bg-surface-2">
          <ArchiveRestore className="size-4" /> {t("Restore a shop from a backup file")}
        </button>
        <div className="mt-10"><Signature /></div>
      </div>
    </Centered>
  );
}

function Register({
  users, shopName, onDone,
}: { users: { id: string; name: string; role: Role }[]; shopName: string | null; onDone: (deviceId: string, code: string, userId: string) => Promise<void> }) {
  const [userId, setUserId] = useState(users[0]?.id ?? "");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const submit = async (pin: string) => {
    setBusy(true);
    setError(null);
    try {
      const res = await fetch("/api/devices", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ userId, pin, deviceName: deviceName() }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ? tMessage(data.error) : t("Could not connect this device."));
      await onDone(data.deviceId, data.deviceCode, userId);
    } catch (err) {
      setError(err instanceof Error ? err.message : t("Could not connect this device."));
      setBusy(false);
    }
  };

  return (
    <Centered shopName={shopName}>
      <div className="w-full max-w-md">
        <Brand shopName={shopName} />
        <Card className="mb-[clamp(10px,2.2dvh,24px)] flex gap-3 p-4 backdrop-blur-xl [@media(max-height:700px)]:p-3">
          <ShieldCheck className="size-5 shrink-0 text-accent" />
          <p className="text-sm text-ink-2 [@media(max-height:700px)]:text-xs">
            {t("Connect this phone or computer to the shop. After this it works offline too, and everyone signs in with their own PIN.")}
          </p>
        </Card>
        <Field label={t("Your name")} htmlFor="who">
          <Select id="who" value={userId} onChange={(e) => setUserId(e.target.value)}>
            {users.map((u) => (
              <option key={u.id} value={u.id}>
                {u.name} — {t(ROLE_LABEL[u.role])}
              </option>
            ))}
          </Select>
        </Field>
        <div className="mt-[clamp(10px,2.2dvh,24px)]">
          <PinPad onSubmit={submit} busy={busy} error={error} />
        </div>
      </div>
    </Centered>
  );
}

function deviceName(): string {
  const ua = navigator.userAgent;
  const os = /Android/i.test(ua) ? "Android" : /iPhone|iPad/i.test(ua) ? "iPhone/iPad" : /Windows/i.test(ua) ? "Windows" : /Mac/i.test(ua) ? "Mac" : /Linux/i.test(ua) ? "Linux" : "Device";
  const browser = /Edg\//.test(ua) ? "Edge" : /Chrome\//.test(ua) ? "Chrome" : /Firefox\//.test(ua) ? "Firefox" : /Safari\//.test(ua) ? "Safari" : "Browser";
  return `${os} · ${browser}`;
}

/**
 * Rebuild a lost shop on a new, empty server from a backup file. The file is
 * read on this device; its records are uploaded, the owner's PIN is checked,
 * then this device is connected and any changes that never reached the old
 * server are sent through the normal checks.
 */
function Restore({ store, onDone, onCancel }: { store: LocalStore; onDone: (deviceId: string, code: string, userId: string) => Promise<void>; onCancel: () => void }) {
  const [file, setFile] = useState<{ name: string; bytes: Uint8Array; info: BackupSummary } | null>(null);
  const [ownerId, setOwnerId] = useState("");
  const [pin, setPin] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [progress, setProgress] = useState<string | null>(null);

  const choose = async (f: File | undefined) => {
    setError(null);
    setFile(null);
    if (!f) return;
    try {
      const bytes = new Uint8Array(await f.arrayBuffer());
      const info = await inspectBackup(bytes);
      if (!info.owners.length) throw new Error(t("This backup has no owner account, so it can't be restored."));
      setFile({ name: f.name, bytes, info });
      setOwnerId(info.owners[0].id);
    } catch (e) {
      setError(e instanceof Error ? tMessage(e.message) : t("Could not read that file."));
    }
  };

  const post = async (body: unknown) => {
    const res = await fetch("/api/restore", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) });
    const data = await res.json().catch(() => ({}));
    if (!res.ok) throw new Error(data.error ? tMessage(data.error) : t("Restore failed ({status}).", { status: res.status }));
    return data;
  };

  const run = async () => {
    if (!file) return;
    setError(null);
    const owner = file.info.owners.find((o) => o.id === ownerId);
    if (!owner || !(await verifyPin(pin, owner.pin_salt, owner.pin_hash))) return setError(t("That PIN doesn't match the owner in this backup."));
    try {
      setProgress(t("Reading the backup…"));
      const tables = await backupTables(file.bytes);
      const { token } = await post({ step: "begin" });
      const names = (Object.keys(tables) as (keyof typeof tables)[]).filter((name) => name !== "users");
      const total = names.reduce((n, name) => n + tables[name].length, 0);
      let done = 0;
      for (const table of names) {
        const rows = tables[table];
        for (let i = 0; i < rows.length; i += 400) {
          const chunk = rows.slice(i, i + 400);
          await post({ step: "rows", token, table, rows: chunk });
          done += chunk.length;
          setProgress(t("Uploading records… {pct}%", { pct: Math.round((done / Math.max(total, 1)) * 100) }));
        }
      }
      setProgress(t("Checking the owner PIN…"));
      await post({ step: "finish", token, users: tables.users, ownerId, pin, label: file.name });

      setProgress(t("Connecting this device…"));
      const res = await fetch("/api/devices", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ userId: ownerId, pin, deviceName: deviceName() }),
      });
      const dev = await res.json();
      if (!res.ok) throw new Error(dev.error ? tMessage(dev.error) : t("Could not connect this device."));

      // Changes that never reached the old server go out again as normal changes.
      if (file.info.unsent.length) {
        await store.tx(async (db) => {
          for (const u of file.info.unsent) {
            await db.run("INSERT OR IGNORE INTO outbox (id, body, created_at) VALUES (?, ?, ?)", [u.id, u.body, u.created_at]);
          }
        });
        await store.flush();
      }
      setProgress(t("Downloading the shop to this device…"));
      await onDone(dev.deviceId, dev.deviceCode, ownerId);
    } catch (e) {
      setProgress(null);
      setError(e instanceof Error ? e.message : t("Restore failed."));
    }
  };

  return (
    <Centered>
      <div className="w-full max-w-md">
        <Brand />
        <Card className="p-6 backdrop-blur-xl">
          <h1 className="text-[26px] font-extrabold tracking-[-0.03em]">{t("Restore from a backup")}</h1>
          <p className="mt-1 text-sm text-ink-3">
            {t("Use this on a new or empty server to bring the whole shop back: sales, staff, pay, expenses, clients and logins. Choose the newest backup you have.")}
          </p>

          <label className="mt-5 flex min-h-14 cursor-pointer items-center justify-center gap-2 rounded-2xl border-2 border-dashed border-line-strong px-4 text-sm font-semibold text-ink-2 hover:bg-surface-2">
            <FileUp className="size-5" />
            {file ? file.name : t("Choose backup file (.sqlite)")}
            <input type="file" accept=".sqlite,.db,.sqlite3,application/octet-stream,application/vnd.sqlite3" className="sr-only" onChange={(e) => choose(e.target.files?.[0])} />
          </label>

          {file && (
            <div className="mt-4 space-y-4">
              <div className="rounded-xl bg-surface-2 p-3 text-sm">
                <div className="font-semibold">{file.info.shopName ?? t("Shop")}</div>
                <div className="text-ink-3">
                  {file.info.lastSaleDate
                    ? plural(file.info.sales, "{n} sale, latest {date}", "{n} sales, latest {date}", { date: formatDate(file.info.lastSaleDate) })
                    : plural(file.info.sales, "{n} sale", "{n} sales")}
                  {" · "}{plural(file.info.staff, "{n} staff member", "{n} staff members")} · {file.info.currency}
                </div>
                {file.info.unsent.length > 0 && (
                  <div className="mt-1 text-warning">
                    {plural(
                      file.info.unsent.length,
                      "Includes {n} change that never reached the old server. It will be sent too.",
                      "Includes {n} changes that never reached the old server. They will be sent too.",
                    )}
                  </div>
                )}
              </div>
              {file.info.owners.length > 1 && (
                <Field label={t("Owner")} htmlFor="rowner">
                  <Select id="rowner" value={ownerId} onChange={(e) => setOwnerId(e.target.value)}>
                    {file.info.owners.map((o) => <option key={o.id} value={o.id}>{o.name}</option>)}
                  </Select>
                </Field>
              )}
              <Field
                label={(() => {
                  const name = file.info.owners.find((o) => o.id === ownerId)?.name;
                  return name ? t("PIN of {name}", { name }) : t("Owner PIN");
                })()}
                htmlFor="rpin"
                hint={t("The owner's PIN from when this backup was made.")}
              >
                <Input id="rpin" type="password" inputMode="numeric" autoComplete="off" value={pin} onChange={(e) => setPin(e.target.value.replace(/\D/g, "").slice(0, 6))} />
              </Field>
            </div>
          )}

          {progress && <p className="mt-4 text-sm text-accent" role="status">{progress}</p>}
          {error && <p className="mt-4 text-sm text-negative" role="alert">{error}</p>}

          <div className="mt-5 grid grid-cols-2 gap-2">
            <Button variant="secondary" size="lg" onClick={onCancel} disabled={!!progress}>{t("Back")}</Button>
            <Button size="lg" disabled={!file || pin.length < 4} loading={!!progress} onClick={run}>{t("Restore shop")}</Button>
          </div>
        </Card>
      </div>
    </Centered>
  );
}
