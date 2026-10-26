"use client";

import { useMutation } from "@tanstack/react-query";
import { useRouter } from "next/navigation";
import { useState } from "react";

import { type Buyer, type BuyerKind, type Catalog, marketApi } from "@/lib/api";
import { CATEGORY_TINT, money, plural, shortDay, ShortDay } from "@/lib/format";
import { store, useStore } from "@/lib/store";

import { orderLimit } from "./ListingCard";

const KINDS: { value: BuyerKind; label: string }[] = [
  { value: "restaurante", label: "Restaurante" },
  { value: "verduleria", label: "Verdulería" },
  { value: "hotel", label: "Hotel" },
  { value: "comedor", label: "Comedor" },
  { value: "familia", label: "Familia" },
  { value: "otro", label: "Otro" },
];

/** The first consolidated delivery on or after every item is available (presales come later). */
function deliveryFor(catalog: Catalog, latest: string | null) {
  if (!latest || latest <= catalog.delivery.date) return catalog.delivery.date;
  const d = new Date(`${catalog.delivery.date}T12:00:00`);
  while (d.toISOString().slice(0, 10) < latest) d.setDate(d.getDate() + 7);
  return d.toISOString().slice(0, 10);
}

/** The design's cart: one delivery and one invoice from the network. Ordering needs no account, only who and where. */
export function Cart({ catalog }: { catalog: Catalog }) {
  const router = useRouter();
  const cart = useStore((s) => s.cart);
  const recurring = useStore((s) => s.recurring);
  const saved = useStore((s) => s.buyer);
  const myPlace = useStore((s) => s.place);
  const [checkout, setCheckout] = useState(false);
  const [buyer, setBuyer] = useState<Buyer>({ name: "", email: "", phone: "", kind: "restaurante", address: "" });
  const set = (patch: Partial<Buyer>) => setBuyer((b) => ({ ...b, ...patch }));

  const byId = new Map(catalog.listings.map((l) => [l.id, l]));
  const producers = new Map(catalog.producers.map((p) => [p.id, p]));
  const lines = Object.entries(cart).map(([id, kg]) => {
    const l = byId.get(id);
    // Gone from the catalog (sold out, the lot failed) or now asking more than is left: shown, not ordered.
    const ok = !!l && kg <= orderLimit(l);
    return { id, kg, l, ok };
  });
  const live = lines.filter((x) => x.ok);
  const subtotal = live.reduce((a, x) => a + x.kg * x.l!.price_per_kg, 0);
  const logistics = subtotal === 0 ? 0 : subtotal >= catalog.free_logistics_from ? 0 : catalog.logistics_fee;
  const farms = new Set(live.map((x) => x.l!.producer_id)).size;
  const latest = live.map((x) => x.l!.availability.from).filter((d): d is string => !!d && isFuture(d)).sort().pop() ?? null;
  const delivery = deliveryFor(catalog, latest);
  const c = catalog.currency;

  const place = useMutation({
    mutationFn: () =>
      marketApi.placeOrder({
        buyer: { ...buyer, phone: buyer.phone?.trim() || undefined },
        items: live.map((x) => ({ listing_id: x.id, kg: x.kg })),
        recurring,
      }),
    onSuccess: (order) => {
      store.saveBuyer(buyer);
      store.addOrder({ code: order.code, token: order.token, created_at: order.created_at, total: order.total, delivery_date: order.delivery_date });
      store.clearCart();
      router.push(`/pedido/${order.code}?t=${encodeURIComponent(order.token)}`);
    },
  });
  const valid = buyer.name.trim().length >= 2 && /\S+@\S+\.\S+/.test(buyer.email) && buyer.address.trim().length >= 4;

  return (
    <div className="card elev-md cart">
      <div className="row" style={{ alignItems: "center" }}>
        <span className="card-kicker">Tu carrito</span>
        <span className="tag tag-neutral">{plural(farms, "huerta", "huertas")}</span>
      </div>
      <div className="cart-lines">
        {lines.map(({ id, kg, l, ok }) => (
          <div key={id} className={`cart-line${ok ? "" : " gone"}`}>
            <span className="blob" style={{ background: l ? CATEGORY_TINT[l.category] : "var(--color-neutral-300)" }} />
            <div style={{ display: "flex", flexDirection: "column", flex: 1, minWidth: 0 }}>
              <span className="name">{l?.title ?? "Ya no está disponible"}</span>
              <span className="meta">
                {l ? `${producers.get(l.producer_id)?.name ?? ""} · ${kg} kg` : `${kg} kg`}
                {l && !ok && " · supera lo disponible"}
              </span>
            </div>
            {ok ? (
              <span className="total">{money(kg * l!.price_per_kg, c)}</span>
            ) : (
              <button className="link-btn" onClick={() => store.setQty(id, 0)}>
                Quitar
              </button>
            )}
          </div>
        ))}
        {lines.length === 0 && <span style={{ fontSize: 14, color: "var(--color-neutral-700)" }}>Elegí productos de las huertas cercanas.</span>}
      </div>
      <div className="totals">
        <div className="row">
          <span>Subtotal</span>
          <span>{money(subtotal, c)}</span>
        </div>
        <div className="row">
          <span>Logística consolidada</span>
          <span>{subtotal > 0 && logistics === 0 ? "Bonificada" : money(logistics, c)}</span>
        </div>
        {subtotal > 0 && logistics > 0 && (
          <span className="small-muted">Bonificada desde {money(catalog.free_logistics_from, c)}</span>
        )}
        <div className="row grand">
          <span>Total</span>
          <span>{money(subtotal + logistics, c)}</span>
        </div>
      </div>
      <div className="delivery">
        <strong>
          {ShortDay(delivery)} · {catalog.delivery.window}
        </strong>
        <span>
          Todo llega junto, en una factura de Red Km 0.
          {delivery !== catalog.delivery.date && ` Por la preventa, la entrega pasa del ${shortDay(catalog.delivery.date)} a esta fecha.`}
        </span>
      </div>
      <label className="check">
        <input type="checkbox" checked={recurring} onChange={(e) => store.setRecurring(e.target.checked)} />
        Repetir cada semana
      </label>

      {checkout && live.length > 0 && (
        <form
          className="form"
          onSubmit={(e) => {
            e.preventDefault();
            place.mutate();
          }}
        >
          <div className="field">
            <label htmlFor="b-name">Tu local o tu nombre</label>
            <input id="b-name" className="input" value={buyer.name} onChange={(e) => set({ name: e.target.value })} autoComplete="organization" />
          </div>
          <div className="field">
            <label htmlFor="b-email">Email</label>
            <input id="b-email" className="input" type="email" value={buyer.email} onChange={(e) => set({ email: e.target.value })} autoComplete="email" />
          </div>
          <div className="field">
            <label htmlFor="b-phone">Teléfono (opcional)</label>
            <input id="b-phone" className="input" type="tel" value={buyer.phone ?? ""} onChange={(e) => set({ phone: e.target.value })} autoComplete="tel" />
          </div>
          <div className="field">
            <label htmlFor="b-kind">Sos</label>
            <select id="b-kind" className="input" value={buyer.kind} onChange={(e) => set({ kind: e.target.value as BuyerKind })}>
              {KINDS.map((k) => (
                <option key={k.value} value={k.value}>
                  {k.label}
                </option>
              ))}
            </select>
          </div>
          <div className="field">
            <label htmlFor="b-address">Dirección de entrega</label>
            <input id="b-address" className="input" value={buyer.address} onChange={(e) => set({ address: e.target.value })} autoComplete="street-address" />
          </div>
          <span className="small-muted">Sin cuenta: con tu email te identificamos y te queda un enlace para seguir el pedido.</span>
          {place.error && <span className="error">{place.error.message}</span>}
          <button type="submit" className="btn btn-primary btn-block" disabled={!valid || place.isPending} style={{ padding: 14, fontSize: 15 }}>
            {place.isPending ? "Enviando…" : `Confirmar · ${money(subtotal + logistics, c)}`}
          </button>
        </form>
      )}
      {!checkout && (
        <button className="btn btn-primary btn-block" disabled={live.length === 0} onClick={() => {
            const base = saved && !buyer.name ? saved : buyer; // the details used last time, from this browser
            setBuyer(base.address || !myPlace?.address ? base : { ...base, address: myPlace.address }); // or the address just searched
            setCheckout(true);
          }} style={{ padding: 14, fontSize: 15 }}>
          Confirmar pedido
        </button>
      )}
    </div>
  );
}

const isFuture = (iso: string) => iso > new Date().toISOString().slice(0, 10);
