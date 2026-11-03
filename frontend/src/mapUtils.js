import polyline from '@mapbox/polyline'

export function decodeRoute(encoded, cps) {
  if (encoded) {
    const pts = polyline.decode(encoded, 6).map(([lat, lon]) => [lat, lon])
    if (pts.length) return pts
  }
  if (cps?.length) return cps.map((cp) => [cp.lat, cp.lon])
  return []
}

export const riskColor = {
  Low: '#22c55e',
  Mod: '#eab308',
  High: '#f97316',
  Severe: '#ef4444',
  'No Travel': '#111827',
}

const riskPts = {
  Low: 1,
  Mod: 2,
  High: 3,
  Severe: 4,
  'No Travel': 5,
}

export function buildHeatPoints(trip, hrOff, routeId) {
  if (!trip?.routes?.length) return []

  const rt =
    trip.routes.find((r) => r.id === routeId) ||
    trip.routes.find((r) => r.id === trip.recommended_route_id) ||
    trip.routes[0]
  const cps = rt.checkpoints || []
  if (!cps.length) return []

  const dep = new Date(trip.departure_time).getTime()
  const tripHr = Math.max(Number(rt.time_hours) || 1, 0.25)
  const out = []

  // 0-48h slider -> where we "focus" on the trip (trip is usually ~2h)
  const focusHr = (hrOff / 48) * tripHr
  const focusIdx = (hrOff / 48) * Math.max(cps.length - 1, 1)

  for (let i = 0; i < cps.length; i++) {
    const cp = cps[i]
    const w = cp.w_data || {}
    const rs = riskPts[cp.risk] || 1
    const wind = Number(w.wind_mph) || 0
    let hot = (rs / 5) * 0.55 + Math.min(wind / 55, 1) * 0.45

    const cpHr = (new Date(cp.eta).getTime() - dep) / 3600000
    const tWt = Math.max(0.12, 1 - Math.abs(cpHr - focusHr) / (tripHr * 0.6 + 0.5))
    const iWt = Math.max(0.12, 1 - Math.abs(i - focusIdx) / 1.8)

    // NOTE: real implementation would re-fetch forecast for specific hour
    hot *= tWt * iWt * (0.85 + (hrOff / 48) * 0.35)

    out.push([cp.lat, cp.lon, Math.min(hot, 1)])
  }

  // extra point on polyline so heat actually moves
  const line = decodeRoute(rt.polyline, cps)
  if (line.length > 1) {
    const t = hrOff / 48
    const idx = Math.min(Math.floor(t * (line.length - 1)), line.length - 2)
    const frac = t * (line.length - 1) - idx
    const [lat1, lon1] = line[idx]
    const [lat2, lon2] = line[idx + 1]
    const lat = lat1 + (lat2 - lat1) * frac
    const lon = lon1 + (lon2 - lon1) * frac
    out.push([lat, lon, 0.95])
  }

  return out
}

export function riskLabel(risk) {
  if (risk === 'Mod') return 'Moderate'
  return risk || '—'
}

export function fmtEta(iso) {
  if (!iso) return '—'
  return new Date(iso).toLocaleString()
}
