"use client";

import "leaflet/dist/leaflet.css";

import L from "leaflet";
import { useEffect, useRef } from "react";

import type { Producer } from "@/lib/api";
import { km } from "@/lib/format";

// The real map: Mapbox tiles through Leaflet, as in agroai_web-monitoring (same NEXT_PUBLIC_MAPBOX_TOKEN). A light
// style keeps it as minimal as the design's; the pins and labels are the design's, drawn as HTML markers. The farms'
// points are approximate (the API snaps them to ~500 m), so the deepest zoom stays at neighbourhood level.

export const MAPBOX_TOKEN = process.env.NEXT_PUBLIC_MAPBOX_TOKEN;
const STYLE = process.env.NEXT_PUBLIC_MAPBOX_STYLE ?? "mapbox/light-v11";
const ATTRIBUTION =
  '© <a href="https://www.mapbox.com/about/maps/">Mapbox</a> © <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>';
const MAX_ZOOM = 15;

interface Props {
  producers: Producer[];
  me: { lat: number; lng: number; label: string };
  selected: string | null;
  onSelect: (id: string) => void;
}

const esc = (s: string) => s.replace(/[&<>"']/g, (c) => `&#${c.charCodeAt(0)};`);

function farmIcon(p: Producer, on: boolean, dim: boolean) {
  const dist = p.distance_km != null ? `<span class="d">${km(p.distance_km)}</span>` : "";
  return L.divIcon({
    className: "",
    html: `<div class="map-pin${on ? " on" : ""}${dim ? " dim" : ""}"><span class="dot"></span><span class="lbl">${esc(p.name)}${dist}</span></div>`,
    iconSize: [22, 22],
    iconAnchor: [11, 11],
  });
}

const meIcon = (label: string) =>
  L.divIcon({
    className: "",
    html: `<div class="map-me"><span class="halo"></span><span class="dot"></span><span class="lbl">${esc(label)}</span></div>`,
    iconSize: [26, 26],
    iconAnchor: [13, 13],
  });

export function MapboxMap({ producers, me, selected, onSelect }: Props) {
  const container = useRef<HTMLDivElement>(null);
  const map = useRef<L.Map | null>(null);
  const layer = useRef<L.LayerGroup | null>(null);
  const select = useRef(onSelect);

  useEffect(() => {
    select.current = onSelect;
  }, [onSelect]);

  useEffect(() => {
    if (!container.current) return;
    const instance = L.map(container.current, { zoomControl: true, scrollWheelZoom: false, maxZoom: MAX_ZOOM, attributionControl: true });
    const custom = process.env.NEXT_PUBLIC_MAP_TILES_URL; // any standard 256 px XYZ template
    if (custom) {
      L.tileLayer(custom, { maxZoom: MAX_ZOOM, attribution: '© <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>' }).addTo(instance);
    } else {
      L.tileLayer(`https://api.mapbox.com/styles/v1/${STYLE}/tiles/512/{z}/{x}/{y}@2x?access_token=${MAPBOX_TOKEN}`, {
        tileSize: 512, zoomOffset: -1, maxZoom: MAX_ZOOM, attribution: ATTRIBUTION,
      }).addTo(instance);
    }
    layer.current = L.layerGroup().addTo(instance);
    map.current = instance;
    return () => {
      instance.remove();
      map.current = null;
      layer.current = null;
    };
  }, []);

  // Fit the buyer and every farm whenever the set or the buyer's place changes.
  const key = `${me.lat},${me.lng}|${producers.map((p) => p.id).join(",")}`;
  useEffect(() => {
    const instance = map.current;
    if (!instance) return;
    const points: L.LatLngTuple[] = [[me.lat, me.lng], ...producers.map((p) => [p.lat, p.lng] as L.LatLngTuple)];
    instance.fitBounds(L.latLngBounds(points), { padding: [48, 48], maxZoom: 14 });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [key]);

  useEffect(() => {
    const group = layer.current;
    if (!group) return;
    group.clearLayers();
    const farthest = Math.max(1, ...producers.map((p) => p.distance_km ?? 0));
    // the delivery reach around the buyer, as in the design
    L.circle([me.lat, me.lng], {
      radius: farthest * 1000,
      stroke: false,
      fillColor: "#7a8a5e",
      fillOpacity: 0.08,
      interactive: false,
    }).addTo(group);
    for (const p of producers) {
      const on = selected === p.id;
      L.marker([p.lat, p.lng], {
        icon: farmIcon(p, on, !!selected && !on),
        keyboard: true,
        title: p.name,
        zIndexOffset: on ? 1000 : 0,
      })
        .on("click", () => select.current(p.id))
        .addTo(group);
    }
    L.marker([me.lat, me.lng], { icon: meIcon(me.label), interactive: false, zIndexOffset: 500 }).addTo(group);
  }, [producers, me, selected]);

  return <div ref={container} className="mapbox-map" role="region" aria-label="Mapa de huertas cercanas" />;
}
