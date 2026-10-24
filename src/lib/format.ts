import type { Availability, Category } from "./api";

const LOCALE = "es-AR";

/** $6,50 · $14 — cents only when there are any. */
export function money(value: number, currency = "ARS") {
  const digits = Number.isInteger(Math.round(value * 100) / 100) ? 0 : 2;
  return new Intl.NumberFormat(LOCALE, { style: "currency", currency, minimumFractionDigits: digits, maximumFractionDigits: digits })
    .format(value)
    .replace(/\s/g, "");
}

/** 3,6 km */
export const km = (value: number) => `${value.toLocaleString(LOCALE, { minimumFractionDigits: 1, maximumFractionDigits: 1 })} km`;

/** A date-only value from the API, read at noon so it never slips a day. */
const day = (iso: string) => new Date(`${iso.slice(0, 10)}T12:00:00`);

/** jue 23/10 */
export function shortDay(iso: string) {
  const d = day(iso);
  const weekday = d.toLocaleDateString(LOCALE, { weekday: "short" }).replace(".", "");
  return `${weekday} ${d.getDate()}/${d.getMonth() + 1}`;
}

/** Jue 23/10 */
export const ShortDay = (iso: string) => {
  const s = shortDay(iso);
  return s.charAt(0).toUpperCase() + s.slice(1);
};

/** 8/11 */
export const dayMonth = (iso: string) => `${day(iso).getDate()}/${day(iso).getMonth() + 1}`;

export function availabilityLabel(a: Availability) {
  if (a.kind === "now" || !a.from) return "Disponible ahora";
  return a.kind === "presale" ? `Preventa · desde ${dayMonth(a.from)}` : `Desde ${shortDay(a.from)}`;
}

export const CATEGORY_LABEL: Record<Category, string> = {
  hojas: "Hojas",
  frutos: "Frutos",
  aromaticas: "Aromáticas",
  raices: "Raíces",
  otros: "Otros",
};

/** The soft circle each card leads with (no product photos yet): a tint per category, from the design's ramps. */
export const CATEGORY_TINT: Record<Category, string> = {
  hojas: "var(--color-accent-2-300)",
  frutos: "var(--color-accent-300)",
  aromaticas: "var(--color-accent-2-400)",
  raices: "var(--color-accent-200)",
  otros: "var(--color-neutral-300)",
};

export const initials = (name: string) =>
  name
    .split(" ")
    .filter((w) => w.length > 2)
    .slice(0, 2)
    .map((w) => w[0])
    .join("")
    .toUpperCase();

export const plural = (n: number, one: string, many: string) => `${n} ${n === 1 ? one : many}`;
