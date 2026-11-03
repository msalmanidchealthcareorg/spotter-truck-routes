import { useEffect, useRef } from 'react'
import {
  CircleMarker,
  MapContainer,
  Polyline,
  Popup,
  TileLayer,
  useMap,
  useMapEvents,
} from 'react-leaflet'
import L from 'leaflet'
import { HeatLayer } from 'leaflet.heat'
import { buildHeatPoints, decodeRoute, fmtEta, riskColor, riskLabel } from './mapUtils'

const START = [39.95, -75.17]
const ZOOM = 7

const TILE = {
  url: 'https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png',
  attr: '&copy; OpenStreetMap',
}

const HEAT_OPTS = {
  radius: 42,
  blur: 28,
  max: 1,
  minOpacity: 0.3,
  gradient: {
    0.2: '#22c55e',
    0.45: '#eab308',
    0.65: '#f97316',
    0.85: '#ef4444',
    1: '#111827',
  },
}

function FitRoutes({ routes, activeId }) {
  const map = useMap()
  useEffect(() => {
    if (!routes?.length) return
    const rt = routes.find((r) => r.id === activeId) || routes[0]
    const b = L.latLngBounds([])
    decodeRoute(rt.polyline, rt.checkpoints).forEach((pt) => b.extend(pt))
    if (b.isValid()) map.fitBounds(b, { padding: [40, 40] })
  }, [routes, activeId, map])
  return null
}

function FitEndpoints({ origin, dest, enabled }) {
  const map = useMap()
  useEffect(() => {
    if (!enabled || !origin?.lat || !dest?.lat) return
    const b = L.latLngBounds([
      [origin.lat, origin.lon],
      [dest.lat, dest.lon],
    ])
    map.fitBounds(b, { padding: [50, 50] })
  }, [origin, dest, enabled, map])
  return null
}

function MapPickClick({ pickMode, onMapPick }) {
  useMapEvents({
    click(e) {
      if (!pickMode) return
      onMapPick(pickMode, e.latlng.lat, e.latlng.lng)
    },
  })
  return null
}

function WeatherHeat({ trip, hrOff, activeId }) {
  const map = useMap()
  const layerRef = useRef(null)

  useEffect(() => {
    if (!trip?.routes?.length) return undefined

    const layer = new HeatLayer([], HEAT_OPTS)
    layer.addTo(map)
    layerRef.current = layer

    return () => {
      map.removeLayer(layer)
      layerRef.current = null
    }
  }, [trip, map])

  useEffect(() => {
    if (!layerRef.current || !trip) return
    layerRef.current.setLatLngs(buildHeatPoints(trip, hrOff, activeId))
  }, [trip, hrOff, activeId])

  return null
}

function RouteMap({
  trip,
  forecastHr,
  activeRouteId,
  origin,
  dest,
  pickMode,
  onMapPick,
  theme,
}) {
  const routes = trip?.routes || []
  const activeId = activeRouteId || trip?.recommended_route_id
  const showTrip = routes.length > 0
  return (
    <MapContainer
      center={START}
      zoom={ZOOM}
      className={`map ${theme === 'dark' ? 'map-dark' : ''}`}
      scrollWheelZoom
    >
      <TileLayer attribution={TILE.attr} url={TILE.url} />

      <FitEndpoints origin={origin} dest={dest} enabled={!showTrip} />
      {showTrip && <FitRoutes routes={routes} activeId={activeId} />}
      <MapPickClick pickMode={pickMode} onMapPick={onMapPick} />

      {origin?.lat && (
        <CircleMarker
          center={[origin.lat, origin.lon]}
          radius={9}
          pathOptions={{
            color: '#fff',
            weight: 2,
            fillColor: '#2563eb',
            fillOpacity: 1,
          }}
        >
          <Popup>
            <strong>Origin</strong>
            <div>{origin.label || 'Start'}</div>
          </Popup>
        </CircleMarker>
      )}

      {dest?.lat && (
        <CircleMarker
          center={[dest.lat, dest.lon]}
          radius={9}
          pathOptions={{
            color: '#fff',
            weight: 2,
            fillColor: '#dc2626',
            fillOpacity: 1,
          }}
        >
          <Popup>
            <strong>Destination</strong>
            <div>{dest.label || 'End'}</div>
          </Popup>
        </CircleMarker>
      )}

      {trip && (
        <WeatherHeat trip={trip} hrOff={forecastHr} activeId={activeId} />
      )}

      {routes.map((rt) => {
        const pts = decodeRoute(rt.polyline, rt.checkpoints)
        const on = rt.id === activeId
        return (
          <Polyline
            key={`line-${rt.id}`}
            positions={pts}
            pathOptions={{
              color: on ? '#15803d' : '#9ca3af',
              weight: on ? 5 : 3,
              opacity: on ? 0.95 : 0.45,
            }}
          />
        )
      })}

      {(routes.find((r) => r.id === activeId)?.checkpoints || []).map(
        (cp, idx) => {
          const w = cp.w_data || {}
          const risk = cp.risk || 'Low'
          const rt = routes.find((r) => r.id === activeId)
          return (
            <CircleMarker
              key={`${activeId}-cp-${idx}`}
              center={[cp.lat, cp.lon]}
              radius={7}
              pathOptions={{
                color: '#fff',
                weight: 1,
                fillColor: riskColor[risk] || '#666',
                fillOpacity: 0.95,
              }}
            >
              <Popup>
                <div className="popup">
                  <strong>{rt?.label}</strong>
                  <div>ETA: {fmtEta(cp.eta)}</div>
                  <div>Wind: {w.wind_mph ?? '—'} mph</div>
                  <div>Rain: {w.rain_in_hr ?? '—'} in/hr</div>
                  <div>Snow: {w.snow_in_hr ?? '—'} in/hr</div>
                  <div>Risk: {riskLabel(risk)}</div>
                </div>
              </Popup>
            </CircleMarker>
          )
        },
      )}
    </MapContainer>
  )
}

export default RouteMap
