"use client";

import { useEffect, useState } from "react";

import { type AddressResult, searchAddress } from "@/lib/geocode";
import { type Place, store } from "@/lib/store";

/** Above this, the browser's fix is a guess (IP or cell based, often the province's centre): not used. */
const MAX_ACCURACY_M = 1500;

/** Setting where the buyer's kitchen is: typing the address (geocoded), or the device's location when it is precise. */
export function PlacePicker({ place }: { place: Place | null }) {
  const [editing, setEditing] = useState(!place);
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<AddressResult[]>([]);
  const [status, setStatus] = useState<"idle" | "searching" | "empty" | "down">("idle");
  const [locating, setLocating] = useState(false);
  const [notice, setNotice] = useState<string | null>(null);

  useEffect(() => {
    const q = query.trim();
    if (q.length < 4) return;
    const controller = new AbortController();
    const timer = window.setTimeout(() => {
      setStatus("searching");
      searchAddress(q, controller.signal)
        .then((found) => {
          setResults(found);
          setStatus(found.length ? "idle" : "empty");
        })
        .catch((e: Error) => e.name !== "AbortError" && setStatus("down"));
    }, 350);
    return () => {
      controller.abort();
      window.clearTimeout(timer);
    };
  }, [query]);

  const choose = (r: AddressResult) => {
    store.setPlace({ lat: r.lat, lng: r.lon, label: r.display_name.split(",").slice(0, 2).join(","), address: r.display_name });
    setEditing(false);
    setQuery("");
    setResults([]);
    setNotice(null);
  };

  const locate = () => {
    if (!navigator.geolocation) {
      setNotice("Este navegador no comparte la ubicación: escribí la dirección.");
      return;
    }
    setLocating(true);
    setNotice(null);
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        setLocating(false);
        if (pos.coords.accuracy > MAX_ACCURACY_M) {
          setNotice(
            `Tu navegador te ubica con un margen de ${Math.round(pos.coords.accuracy / 1000)} km, demasiado para medir distancias. Escribí la dirección de tu local.`,
          );
          return;
        }
        store.setPlace({ lat: pos.coords.latitude, lng: pos.coords.longitude, label: "Tu ubicación actual", address: null });
        setEditing(false);
      },
      () => {
        setLocating(false);
        setNotice("No se pudo obtener tu ubicación: escribí la dirección.");
      },
      { enableHighAccuracy: true, maximumAge: 0, timeout: 15_000 },
    );
  };

  if (!editing && place) {
    return (
      <span className="muted">
        Distancias desde <strong>{place.label}</strong> ·{" "}
        <button className="link-btn" onClick={() => setEditing(true)}>
          cambiar
        </button>
        <span className="small-muted"> · podés arrastrar tu punto en el mapa</span>
      </span>
    );
  }

  return (
    <div className="place-picker">
      <div style={{ display: "flex", gap: 8, flexWrap: "wrap", alignItems: "center" }}>
        <input
          className="input"
          placeholder="Dirección de tu local (calle y altura, localidad)"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          aria-label="Dirección de tu local"
          style={{ flex: "1 1 280px", padding: "10px 16px", fontSize: 14 }}
          autoComplete="street-address"
        />
        <button className="btn btn-secondary" onClick={locate} disabled={locating} style={{ fontSize: 13 }}>
          {locating ? "Ubicando…" : "Usar mi ubicación"}
        </button>
        {place && (
          <button className="link-btn" onClick={() => setEditing(false)}>
            cancelar
          </button>
        )}
      </div>
      {results.length > 0 && query.trim().length >= 4 && (
        <ul className="place-results">
          {results.map((r) => (
            <li key={`${r.lat},${r.lon}`}>
              <button onClick={() => choose(r)}>{r.display_name}</button>
            </li>
          ))}
        </ul>
      )}
      {status === "searching" && <span className="small-muted">Buscando…</span>}
      {status === "empty" && query.trim().length >= 4 && <span className="small-muted">No encontramos esa dirección. Probá con calle, altura y localidad.</span>}
      {status === "down" && <span className="small-muted">La búsqueda de direcciones no responde ahora. Probá con “Usar mi ubicación”.</span>}
      {notice && <span className="error">{notice}</span>}
      {!place && <span className="small-muted">Indicá dónde está tu local para ver a qué distancia está cada huerta.</span>}
    </div>
  );
}
