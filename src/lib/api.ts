// The AgroAI API's public market endpoints (no account): the catalog, placing an order and following it.

export const API_BASE_URL = (process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:8000/api/v1").replace(/\/$/, "");

export type Category = "hojas" | "frutos" | "aromaticas" | "raices" | "otros";
export type BuyerKind = "restaurante" | "verduleria" | "hotel" | "comedor" | "familia" | "otro";

export interface Availability {
  kind: "now" | "from" | "presale";
  from?: string | null;
}

export interface Producer {
  id: string;
  name: string;
  barrio?: string | null;
  /** Approximate (snapped to ~500 m by the API), never the farm's exact place. */
  lat: number;
  lng: number;
  distance_km?: number | null;
  sealed: boolean;
  /** Share of its listed lots with something in the bitácora in the last 14 days. */
  traceability_pct?: number | null;
  listing_count: number;
}

export interface Listing {
  id: string;
  producer_id: string;
  title: string;
  category: Category;
  price_per_kg: number;
  weekly_capacity_kg: number;
  weeks: number;
  /** Free this week; 0 for a presale (it reserves against the weekly capacity). */
  stock_kg: number;
  availability: Availability;
  order_step_kg: number;
}

export interface Catalog {
  producers: Producer[];
  listings: Listing[];
  delivery: { date: string; window: string };
  currency: string;
  logistics_fee: number;
  free_logistics_from: number;
}

export interface Buyer {
  name: string;
  email: string;
  phone?: string;
  kind: BuyerKind;
  address: string;
}

export type OrderStatus = "recibido" | "en_preparacion" | "en_camino" | "entregado" | "cancelado";

export interface BuyerOrder {
  code: number;
  buyer_name: string;
  buyer_email: string;
  delivery_address: string;
  delivery_date: string;
  delivery_window: string;
  recurring: boolean;
  status: OrderStatus;
  parts: {
    producer_name: string;
    status: "nuevo" | "prep" | "listo" | "entregado" | "rechazado";
    items: { title: string; kg: number; price_per_kg: number; total: number; from_stock: boolean }[];
    subtotal: number;
  }[];
  subtotal: number;
  logistics_fee: number;
  total: number;
  created_at: string;
}

export interface PlacedOrder extends BuyerOrder {
  /** Returned only once: with the code, it opens the order. */
  token: string;
}

export class ApiError extends Error {
  constructor(
    public status: number,
    message: string,
  ) {
    super(message);
  }
}

async function call<T>(path: string, init?: RequestInit): Promise<T> {
  let response: Response;
  try {
    response = await fetch(`${API_BASE_URL}${path}`, {
      ...init,
      headers: { "Content-Type": "application/json", ...(init?.headers ?? {}) },
    });
  } catch {
    throw new ApiError(0, "No se pudo conectar con la red. Revisá tu conexión.");
  }
  if (!response.ok) {
    let detail = response.statusText;
    try {
      const body = await response.json();
      if (typeof body?.detail === "string") detail = body.detail;
      else if (Array.isArray(body?.detail)) detail = body.detail.map((d: { msg?: string }) => d.msg).join(", ");
    } catch {
      // non-JSON error body
    }
    throw new ApiError(response.status, detail);
  }
  return (await response.json()) as T;
}

export const marketApi = {
  catalog: (near?: { lat: number; lng: number }) =>
    call<Catalog>(`/market/public/catalog${near ? `?lat=${near.lat}&lng=${near.lng}` : ""}`),
  placeOrder: (body: { buyer: Buyer; items: { listing_id: string; kg: number }[]; recurring: boolean }) =>
    call<PlacedOrder>("/market/public/orders", { method: "POST", body: JSON.stringify(body) }),
  order: (code: number | string, token: string) =>
    call<BuyerOrder>(`/market/public/orders/${encodeURIComponent(code)}?token=${encodeURIComponent(token)}`),
};
