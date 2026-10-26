"use client";

import { useQuery } from "@tanstack/react-query";
import dynamic from "next/dynamic";
import { useMemo, useState } from "react";

import { Cart } from "@/components/Cart";
import { Header } from "@/components/Header";
import { ListingCard } from "@/components/ListingCard";
import { NetworkMap } from "@/components/NetworkMap";
import { type Category, marketApi } from "@/lib/api";
import { CATEGORY_LABEL, km, plural, shortDay } from "@/lib/format";
import { store, useStore } from "@/lib/store";

// The real map (Mapbox, as in agroai_web-monitoring) needs the token; without it, the design's drawn map.
const MapboxMap = dynamic(() => import("@/components/MapboxMap").then((m) => m.MapboxMap), { ssr: false });
const REAL_MAP = !!(process.env.NEXT_PUBLIC_MAPBOX_TOKEN || process.env.NEXT_PUBLIC_MAP_TILES_URL);

const DEFAULT_PLACE = {
  lat: Number(process.env.NEXT_PUBLIC_DEFAULT_LAT ?? -34.8712),
  lng: Number(process.env.NEXT_PUBLIC_DEFAULT_LNG ?? -58.0455),
  label: process.env.NEXT_PUBLIC_DEFAULT_PLACE ?? "City Bell",
};

/** The buyer's home: a minimal map of the farms nearby, the farms row, what's available as cards, the cart. */
export default function Home() {
  const savedPlace = useStore((s) => s.place);
  const place = savedPlace ?? DEFAULT_PLACE;
  const near = useMemo(() => ({ lat: place.lat, lng: place.lng }), [place.lat, place.lng]);
  const catalog = useQuery({ queryKey: ["catalog", near], queryFn: () => marketApi.catalog(near) });
  const [farm, setFarm] = useState<string | null>(null);
  const [cat, setCat] = useState<Category | "todo">("todo");
  const [q, setQ] = useState("");
  const [locating, setLocating] = useState(false);

  const data = catalog.data;
  const producers = useMemo(() => new Map((data?.producers ?? []).map((p) => [p.id, p])), [data]);
  const toggleFarm = (id: string) => setFarm((f) => (f === id ? null : id));
  const needle = q.trim().toLowerCase();
  const listings = (data?.listings ?? []).filter(
    (l) =>
      (!farm || l.producer_id === farm) &&
      (cat === "todo" || l.category === cat) &&
      (!needle || l.title.toLowerCase().includes(needle) || producers.get(l.producer_id)?.name.toLowerCase().includes(needle)),
  );
  const cats = ["todo", ...new Set((data?.listings ?? []).map((l) => l.category))] as (Category | "todo")[];
  const farthest = Math.max(0, ...(data?.producers ?? []).map((p) => p.distance_km ?? 0));
  const me = useMemo(() => ({ ...near, label: savedPlace ? "Tu local" : `Tu local · ${place.label}` }), [near, savedPlace, place.label]);

  const locate = () => {
    if (!navigator.geolocation) return;
    setLocating(true);
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        store.setPlace({ lat: pos.coords.latitude, lng: pos.coords.longitude, label: "tu ubicación" });
        setLocating(false);
      },
      () => setLocating(false),
      { maximumAge: 600_000, timeout: 10_000 },
    );
  };

  return (
    <div className="page">
      <Header />
      <main className="main" data-screen-label="Comprador · Inicio">
        <div className="main-col">
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-end", gap: 16, flexWrap: "wrap" }}>
            <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
              <h1 className="title">Huertas cerca de tu cocina</h1>
              {data && (
                <span className="muted">
                  {plural(data.producers.length, "productor", "productores")}
                  {farthest > 0 && ` en ${Math.ceil(farthest)} km de ${place.label}`} · próxima entrega consolidada {shortDay(data.delivery.date)}
                  {" · "}
                  {savedPlace ? (
                    <button className="link-btn" onClick={() => store.setPlace(null)}>
                      volver a {DEFAULT_PLACE.label}
                    </button>
                  ) : (
                    <button className="link-btn" onClick={locate} disabled={locating}>
                      {locating ? "ubicando…" : "usar mi ubicación"}
                    </button>
                  )}
                </span>
              )}
            </div>
            <input
              className="input"
              placeholder="Buscar cultivo o huerta"
              value={q}
              onChange={(e) => setQ(e.target.value)}
              style={{ width: 260, maxWidth: "100%", padding: "10px 16px", fontSize: 14 }}
              aria-label="Buscar cultivo o huerta"
            />
          </div>

          <div className="map-frame">
            {data &&
              (REAL_MAP ? (
                <MapboxMap producers={data.producers} me={me} selected={farm} onSelect={toggleFarm} />
              ) : (
                <NetworkMap producers={data.producers} me={me} selected={farm} onSelect={toggleFarm} />
              ))}
          </div>

          {catalog.isError && <div className="error">{catalog.error.message}</div>}

          <div className="farms" aria-label="Huertas">
            {data?.producers.map((p) => (
              <button key={p.id} className={`farm-chip${farm === p.id ? " on" : ""}`} onClick={() => toggleFarm(p.id)} aria-pressed={farm === p.id}>
                <span className="farm-score" title="Trazabilidad: lotes publicados con registro en la bitácora en los últimos 14 días">
                  {p.traceability_pct ?? "–"}
                </span>
                <span>
                  <span className="farm-name">{p.name}</span>
                  <span className="farm-meta">
                    {p.distance_km != null ? `${km(p.distance_km)} · ` : ""}
                    {plural(p.listing_count, "producto", "productos")}
                    {p.sealed ? " · sello" : ""}
                  </span>
                </span>
              </button>
            ))}
          </div>

          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 12, flexWrap: "wrap" }}>
            <div style={{ display: "flex", alignItems: "baseline", gap: 12, flexWrap: "wrap" }}>
              <h2 className="h2">Disponible en la red</h2>
              <span style={{ fontSize: 14, color: "var(--color-neutral-700)" }}>{plural(listings.length, "publicación", "publicaciones")} · más cercanas primero</span>
              {farm && (
                <button className="tag tag-accent-2" onClick={() => setFarm(null)} style={{ border: 0, cursor: "pointer", fontSize: 12, padding: "5px 12px" }}>
                  {producers.get(farm)?.name} ✕
                </button>
              )}
            </div>
            <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
              {cats.map((c) => (
                <button key={c} className={`btn ${c === cat ? "btn-primary" : "btn-secondary"}`} onClick={() => setCat(c)} style={{ fontSize: 13, padding: "6px 14px" }}>
                  {c === "todo" ? "Todo" : CATEGORY_LABEL[c]}
                </button>
              ))}
            </div>
          </div>

          {catalog.isLoading && <div className="empty">Buscando huertas cercanas…</div>}
          {data && listings.length === 0 && (
            <div className="empty">{data.listings.length === 0 ? "Todavía no hay publicaciones en la red." : "Nada coincide con el filtro."}</div>
          )}
          <div className="grid">
            {data &&
              listings.map((l) => (
                <ListingCard key={l.id} listing={l} producer={producers.get(l.producer_id)} currency={data.currency} onFarm={() => setFarm(l.producer_id)} />
              ))}
          </div>
        </div>

        <aside className="aside">{data && <Cart catalog={data} />}</aside>
      </main>
    </div>
  );
}
