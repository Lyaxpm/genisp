// Helper geografis: haversine + parsing kolom coverages.area (jsonb, format bebas).

export type CoverageCircle = {
  lat: number;
  lng: number;
  radius: number; // meter
};

/** Jarak dua titik koordinat dalam meter (haversine). */
export function haversine(lat1: number, lng1: number, lat2: number, lng2: number): number {
  const R = 6371000;
  const toRad = (d: number) => (d * Math.PI) / 180;
  const dLat = toRad(lat2 - lat1);
  const dLng = toRad(lng2 - lng1);
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLng / 2) ** 2;
  return 2 * R * Math.asin(Math.sqrt(a));
}

function num(v: unknown): number | null {
  const n = Number(v);
  return Number.isFinite(n) ? n : null;
}

/**
 * Ubah coverages.area menjadi lingkaran {lat,lng,radius}.
 * Mendukung: {lat,lng,radius}, {latitude,longitude,radius},
 * GeoJSON Point {type:"Point",coordinates:[lng,lat]}, GeoJSON Polygon
 * (diambil centroid + radius = jarak terjauh ke centroid).
 */
export function parseCoverageArea(area: unknown): CoverageCircle | null {
  if (!area || typeof area !== "object") return null;
  const a = area as Record<string, unknown>;

  const lat = num(a.lat) ?? num(a.latitude);
  const lng = num(a.lng) ?? num(a.longitude) ?? num(a.lon);
  if (lat !== null && lng !== null) {
    return { lat, lng, radius: num(a.radius) ?? 1000 };
  }

  if (a.type === "Point" && Array.isArray(a.coordinates) && a.coordinates.length >= 2) {
    const lng2 = num(a.coordinates[0]);
    const lat2 = num(a.coordinates[1]);
    if (lat2 !== null && lng2 !== null) {
      return { lat: lat2, lng: lng2, radius: num(a.radius) ?? 1000 };
    }
  }

  if (a.type === "Polygon" && Array.isArray(a.coordinates) && Array.isArray(a.coordinates[0])) {
    const ring = a.coordinates[0] as unknown[];
    const pts: Array<[number, number]> = [];
    for (const p of ring) {
      if (Array.isArray(p) && p.length >= 2) {
        const lo = num(p[0]);
        const la = num(p[1]);
        if (lo !== null && la !== null) pts.push([la, lo]);
      }
    }
    if (pts.length >= 3) {
      const lat = pts.reduce((s, p) => s + p[0], 0) / pts.length;
      const lng = pts.reduce((s, p) => s + p[1], 0) / pts.length;
      let r = 0;
      for (const [la, lo] of pts) r = Math.max(r, haversine(lat, lng, la, lo));
      return { lat, lng, radius: Math.max(Math.round(r), 200) };
    }
  }

  return null;
}
