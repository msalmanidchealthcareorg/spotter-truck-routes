import { useEffect, useState } from 'react'
import axios from 'axios'
import { ROUTE_URL, apiPath } from './api'
import PlaceSearch from './PlaceSearch'
import RouteMap from './RouteMap'
import { applyTheme, readTheme } from './theme'
import './App.css'

function SunIcon() {
  return (
    <svg viewBox="0 0 24 24" width="18" height="18" aria-hidden="true">
      <circle cx="12" cy="12" r="4" fill="currentColor" />
      <g stroke="currentColor" strokeWidth="2" strokeLinecap="round">
        <line x1="12" y1="2" x2="12" y2="5" />
        <line x1="12" y1="19" x2="12" y2="22" />
        <line x1="2" y1="12" x2="5" y2="12" />
        <line x1="19" y1="12" x2="22" y2="12" />
        <line x1="4.2" y1="4.2" x2="6.3" y2="6.3" />
        <line x1="17.7" y1="17.7" x2="19.8" y2="19.8" />
        <line x1="4.2" y1="19.8" x2="6.3" y2="17.7" />
        <line x1="17.7" y1="6.3" x2="19.8" y2="4.2" />
      </g>
    </svg>
  )
}

function MoonIcon() {
  return (
    <svg viewBox="0 0 24 24" width="18" height="18" aria-hidden="true">
      <path
        fill="currentColor"
        d="M21 14.5A8.5 8.5 0 0 1 9.5 3 7 7 0 1 0 21 14.5z"
      />
    </svg>
  )
}

const defaults = {
  origin_lat: 39.9526,
  origin_lon: -75.1652,
  origin_label: 'Philadelphia, PA',
  dest_lat: 40.7128,
  dest_lon: -74.006,
  dest_label: 'New York, NY',
  departure_time: new Date(Date.now() + 3600000).toISOString().slice(0, 16),
  load_weight: 32000,
}

function App() {
  const [form, setForm] = useState(defaults)
  const [busy, setBusy] = useState(false)
  const [err, setErr] = useState('')
  const [trip, setTrip] = useState(null)
  const [forecastHr, setForecastHr] = useState(0)
  const [activeRouteId, setActiveRouteId] = useState(null)
  const [pickMode, setPickMode] = useState(null)
  const [theme, setTheme] = useState(readTheme)

  const flipTheme = () => {
    const next = theme === 'dark' ? 'light' : 'dark'
    applyTheme(next)
    setTheme(next)
  }

  useEffect(() => {
    if (!trip?.routes?.length) {
      setActiveRouteId(null)
      return
    }
    setActiveRouteId(trip.recommended_route_id || trip.routes[0].id)
  }, [trip])

  const onCh = (e) => {
    const { name, value } = e.target
    setForm((f) => ({ ...f, [name]: value }))
  }

  const setOrigin = (row) => {
    setForm((f) => ({
      ...f,
      origin_lat: row.lat,
      origin_lon: row.lon,
      origin_label: row.label,
    }))
    setPickMode(null)
  }

  const setDest = (row) => {
    setForm((f) => ({
      ...f,
      dest_lat: row.lat,
      dest_lon: row.lon,
      dest_label: row.label,
    }))
    setPickMode(null)
  }

  const onMapPick = async (which, lat, lon) => {
    let label = `${lat.toFixed(4)}, ${lon.toFixed(4)}`
    try {
      const { data } = await axios.get(apiPath('/api/geocode/'), { params: { lat, lon } })
      label = data.results?.[0]?.label || label
    } catch {
      // keep coords label
    }
    const row = { lat, lon, label }
    if (which === 'origin') setOrigin(row)
    else setDest(row)
  }

  const submit = async (e) => {
    e.preventDefault()
    setBusy(true)
    setErr('')
    setTrip(null)
    setForecastHr(0)
    setActiveRouteId(null)
    setPickMode(null)
    try {
      const payload = {
        origin_lat: Number(form.origin_lat),
        origin_lon: Number(form.origin_lon),
        dest_lat: Number(form.dest_lat),
        dest_lon: Number(form.dest_lon),
        load_weight: Number(form.load_weight),
        departure_time: new Date(form.departure_time).toISOString(),
      }
      const { data } = await axios.post(ROUTE_URL, payload)
      setTrip(data)
    } catch (ex) {
      setErr(ex.response?.data?.detail || ex.message || 'failed')
    } finally {
      setBusy(false)
    }
  }

  const activeRt = trip?.routes?.find((r) => r.id === activeRouteId)
  const origin = {
    lat: form.origin_lat,
    lon: form.origin_lon,
    label: form.origin_label,
  }
  const dest = {
    lat: form.dest_lat,
    lon: form.dest_lon,
    label: form.dest_label,
  }

  return (
    <div className="app">
      <aside className="sidebar">
        <div className="brand">
          <div className="brandRow">
            <div>
              <h1>Spotter Routes</h1>
              <p>Weather-aware truck planning</p>
            </div>
            <button
              type="button"
              className="themeToggle"
              onClick={flipTheme}
              title={theme === 'dark' ? 'Switch to light theme' : 'Switch to dark theme'}
              aria-label={
                theme === 'dark' ? 'Switch to light theme' : 'Switch to dark theme'
              }
            >
              {theme === 'dark' ? <SunIcon /> : <MoonIcon />}
            </button>
          </div>
        </div>

        <form onSubmit={submit} className="tripForm">
          <PlaceSearch
            label="Origin"
            placeLabel={form.origin_label}
            lat={form.origin_lat}
            lon={form.origin_lon}
            pickActive={pickMode === 'origin'}
            onStartPick={() =>
              setPickMode((m) => (m === 'origin' ? null : 'origin'))
            }
            onSelect={setOrigin}
            disabled={busy}
          />

          <PlaceSearch
            label="Destination"
            placeLabel={form.dest_label}
            lat={form.dest_lat}
            lon={form.dest_lon}
            pickActive={pickMode === 'dest'}
            onStartPick={() =>
              setPickMode((m) => (m === 'dest' ? null : 'dest'))
            }
            onSelect={setDest}
            disabled={busy}
          />

          <div className="formBlock">
            <label>
              Departure
              <input
                type="datetime-local"
                name="departure_time"
                value={form.departure_time}
                onChange={onCh}
                disabled={busy}
              />
            </label>
            <label>
              Load (lbs)
              <input
                name="load_weight"
                value={form.load_weight}
                onChange={onCh}
                disabled={busy}
              />
            </label>
          </div>

          <button type="submit" className="primaryBtn" disabled={busy}>
            {busy ? 'Calculating…' : 'Plan route'}
          </button>
        </form>

        {err && <p className="err">{err}</p>}

        <div className="riskKey">
          <span>Risk key</span>
          <ul>
            <li><i className="dot low" /> Low</li>
            <li><i className="dot mod" /> Mod</li>
            <li><i className="dot high" /> High</li>
            <li><i className="dot sev" /> Severe</li>
            <li><i className="dot nt" /> No travel</li>
          </ul>
        </div>
      </aside>

      <section className="main">
        <div className={`mapShell ${pickMode ? 'picking' : ''}`}>
          {pickMode && (
            <div className="pickBanner">
              Click the map to set{' '}
              {pickMode === 'origin' ? 'origin' : 'destination'}
            </div>
          )}
          {busy && (
            <div className="spinnerOverlay">
              <div className="spinner">Calculating routes…</div>
            </div>
          )}
          {!trip && !busy && (
            <div className="mapEmpty">
              <p>Search places or use map pins, then plan your route.</p>
            </div>
          )}
          <RouteMap
            trip={trip}
            forecastHr={forecastHr}
            activeRouteId={activeRouteId}
            origin={origin}
            dest={dest}
            pickMode={pickMode}
            onMapPick={onMapPick}
            theme={theme}
          />
        </div>

        <div className="bottomPanel">
          <div className="forecastBar">
            <div className="forecastHead">
              <h2>Forecast scrubber</h2>
              <p>
                Hour <strong>{forecastHr}</strong> / 48 from departure
              </p>
            </div>
            <input
              id="forecastSlider"
              type="range"
              min={0}
              max={48}
              step={1}
              value={forecastHr}
              disabled={!trip}
              onInput={(e) => setForecastHr(Number(e.target.value))}
              onChange={(e) => setForecastHr(Number(e.target.value))}
            />
            <p className="forecastHint">
              {trip
                ? 'Drag to move the heat focus along the selected route.'
                : 'Available after you plan a route.'}
            </p>
          </div>

          <div className="summary">
            <div className="summaryHead">
              <h2>Routes</h2>
              {activeRt && (
                <p className="activeLine">
                  Showing <strong>{activeRt.label}</strong>
                </p>
              )}
            </div>

            {!trip?.routes?.length && (
              <p className="muted">Tap a route card below after planning.</p>
            )}

            <div className="routeList">
              {trip?.routes?.map((rt) => {
                const rec = rt.id === trip.recommended_route_id
                const active = rt.id === activeRouteId
                return (
                  <article
                    key={rt.id}
                    role="button"
                    tabIndex={0}
                    className={`routeCard ${rec ? 'rec' : ''} ${active ? 'active' : ''}`}
                    onClick={() => setActiveRouteId(rt.id)}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter' || e.key === ' ') {
                        e.preventDefault()
                        setActiveRouteId(rt.id)
                      }
                    }}
                  >
                    <header>
                      <h3>{rt.label}</h3>
                      <div className="badges">
                        {active && <span className="badge sel">On map</span>}
                        {rec && <span className="badge rec">Best pick</span>}
                      </div>
                    </header>
                    <div className="metrics">
                      <div>
                        <span className="val">{rt.distance_miles}</span>
                        <span className="lbl">miles</span>
                      </div>
                      <div>
                        <span className="val">{rt.time_hours}</span>
                        <span className="lbl">hours</span>
                      </div>
                      <div>
                        <span className="val">
                          {(rt.checkpoints || []).length}
                        </span>
                        <span className="lbl">stops</span>
                      </div>
                    </div>
                  </article>
                )
              })}
            </div>
          </div>
        </div>
      </section>
    </div>
  )
}

export default App
