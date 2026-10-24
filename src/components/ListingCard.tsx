"use client";

import type { Listing, Producer } from "@/lib/api";
import { availabilityLabel, CATEGORY_TINT, km, money } from "@/lib/format";
import { store, useStore } from "@/lib/store";

/** How much one listing can take in an order: this week's free stock, or a presale's weekly capacity. */
export const orderLimit = (l: Listing) => (l.availability.kind === "now" ? l.stock_kg : l.weekly_capacity_kg);

export function ListingCard({ listing: l, producer, currency, onFarm }: {
  listing: Listing;
  producer?: Producer;
  currency: string;
  onFarm: () => void;
}) {
  const qty = useStore((s) => s.cart[l.id] ?? 0);
  const now = l.availability.kind === "now";
  const limit = orderLimit(l);
  const step = l.order_step_kg;
  const next = Math.min(qty + step, limit);
  const tag = now ? "tag-accent-2" : l.availability.kind === "presale" ? "tag-neutral" : "tag-accent";
  const stockPct = now ? Math.round((l.stock_kg / l.weekly_capacity_kg) * 100) : 0;

  return (
    <article className="card listing">
      <div className="listing-head">
        <span className="blob" style={{ background: CATEGORY_TINT[l.category] }} />
        <div style={{ display: "flex", flexDirection: "column", gap: 2, minWidth: 0 }}>
          <span className="card-title">{l.title}</span>
          <button className="farm-link" onClick={onFarm}>
            {producer?.name}
            {producer?.distance_km != null && ` · ${km(producer.distance_km)}`}
          </button>
        </div>
      </div>
      <span className={`tag ${tag}`} style={{ alignSelf: "flex-start" }}>
        {availabilityLabel(l.availability)}
      </span>
      <div className="facts">
        <div className="row">
          <span className="k">Abastece</span>
          <span className="v">
            hasta {l.weekly_capacity_kg} kg/sem · {l.weeks} sem
          </span>
        </div>
        <div className="row">
          <span className="k">Esta semana</span>
          <span className="v">{now ? (l.stock_kg > 0 ? `${l.stock_kg} kg libres` : "Sin stock") : `Reservá hasta ${l.weekly_capacity_kg} kg`}</span>
        </div>
        <div className="bar">
          <div style={{ width: `${Math.min(100, stockPct)}%` }} />
        </div>
      </div>
      <div className="price-row">
        <span className="price">
          {money(l.price_per_kg, currency)}
          <small> /kg</small>
        </span>
        {qty === 0 ? (
          <button className="btn btn-primary" style={{ fontSize: 13, padding: "8px 14px" }} disabled={limit <= 0} onClick={() => store.setQty(l.id, next)}>
            {limit <= 0 ? "Agotado" : `${now ? "Agregar" : "Reservar"} ${next} kg`}
          </button>
        ) : (
          <div className="stepper">
            <button className="btn btn-secondary btn-icon" aria-label="Quitar" onClick={() => store.setQty(l.id, Math.max(0, qty - step))}>
              −
            </button>
            <span>{qty} kg</span>
            <button className="btn btn-secondary btn-icon" aria-label="Agregar" disabled={qty >= limit} onClick={() => store.setQty(l.id, next)}>
              +
            </button>
          </div>
        )}
      </div>
    </article>
  );
}
