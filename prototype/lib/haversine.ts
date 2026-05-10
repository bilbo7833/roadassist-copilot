// Great-circle distance + naive ETA. In production we replace this with
// OSRM / Google Distance Matrix; for the prototype this gives plausible
// 10-35 min ETAs in the NYC tri-state without any external dependency.

const EARTH_RADIUS_MI = 3958.8;
// Real roads detour ~20-40% over a straight line — pick the middle.
const CIRCUITY_FACTOR = 1.3;
// NYC tri-state mixed surface streets + bridges + freeway with traffic.
const AVG_SPEED_MPH = 20;

export type LatLng = { lat: number; lng: number };

const toRad = (deg: number) => (deg * Math.PI) / 180;

export function distanceAndEta(a: LatLng, b: LatLng) {
    const dLat = toRad(b.lat - a.lat);
    const dLng = toRad(b.lng - a.lng);
    const lat1 = toRad(a.lat);
    const lat2 = toRad(b.lat);
    const h =
        Math.sin(dLat / 2) ** 2 +
        Math.sin(dLng / 2) ** 2 * Math.cos(lat1) * Math.cos(lat2);
    const straightMi = 2 * EARTH_RADIUS_MI * Math.asin(Math.sqrt(h));
    const roadMi = straightMi * CIRCUITY_FACTOR;
    return {
        straightMi: Math.round(straightMi * 10) / 10,
        roadMi: Math.round(roadMi * 10) / 10,
        etaMin: Math.max(3, Math.round((roadMi / AVG_SPEED_MPH) * 60)),
    };
}
