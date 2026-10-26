// Same geocoder as agroai_web-monitoring (src/features/farm/geocode.ts): Mapbox first, Nominatim as fallback.
export interface AddressResult {
  display_name: string;
  lat: number;
  lon: number;
  city: string | null;
}

const MAPBOX_TOKEN = process.env.NEXT_PUBLIC_MAPBOX_TOKEN;

interface MapboxFeature {
  place_name: string;
  center: [number, number];
  context?: { id: string; text: string }[];
  place_type?: string[];
}

/** Mapbox Geocoding: understands "calle altura" in Argentina (it interpolates house numbers), which OSM often lacks. */
async function searchMapbox(query: string, signal: AbortSignal): Promise<AddressResult[]> {
  const url =
    `https://api.mapbox.com/geocoding/v5/mapbox.places/${encodeURIComponent(query)}.json` +
    `?country=ar&language=es&limit=5&autocomplete=true&access_token=${MAPBOX_TOKEN}`;
  const response = await fetch(url, { signal });
  if (!response.ok) throw new Error(`Mapbox ${response.status}`);
  const data: { features?: MapboxFeature[] } = await response.json();
  return (data.features ?? []).map((f) => {
    const own = f.place_type?.some((t) => t === "place" || t === "locality") ? f.place_name.split(",")[0] : null;
    const city = own ?? f.context?.find((c) => /^(locality|place|district)\./.test(c.id))?.text ?? null;
    return { display_name: f.place_name, lat: f.center[1], lon: f.center[0], city };
  });
}

const cityFromOsm = (address: Record<string, string> = {}) =>
  address.city || address.town || address.village || address.municipality || address.county || null;

/** OpenStreetMap Nominatim: free and keyless; weak on house numbers, so it is only the fallback. */
async function searchNominatim(query: string, signal: AbortSignal): Promise<AddressResult[]> {
  const url = `https://nominatim.openstreetmap.org/search?format=jsonv2&q=${encodeURIComponent(query)}&addressdetails=1&accept-language=es&limit=5&countrycodes=ar`;
  const response = await fetch(url, { headers: { Accept: "application/json" }, signal });
  if (!response.ok) throw new Error(`Nominatim ${response.status}`);
  const data: { display_name: string; lat: string; lon: string; address?: Record<string, string> }[] = await response.json();
  return data.map((r) => ({ display_name: r.display_name, lat: Number(r.lat), lon: Number(r.lon), city: cityFromOsm(r.address) }));
}

/** Mapbox first (when its token is configured), Nominatim when Mapbox fails or finds nothing. Throws only if
 * every provider failed, so the form can tell "no results" from "the search is down". */
export async function searchAddress(query: string, signal: AbortSignal): Promise<AddressResult[]> {
  let failed = 0;
  const providers = MAPBOX_TOKEN ? [searchMapbox, searchNominatim] : [searchNominatim];
  for (const provider of providers) {
    try {
      const results = await provider(query, signal);
      if (results.length > 0) return results;
    } catch (e) {
      if ((e as Error).name === "AbortError") throw e;
      failed += 1;
    }
  }
  if (failed === providers.length) throw new Error("search unavailable");
  return [];
}
