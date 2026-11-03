import { useEffect, useRef, useState } from 'react'
import axios from 'axios'
import { apiPath } from './api'

function PlaceSearch({
  label,
  placeLabel,
  lat,
  lon,
  pickActive,
  onStartPick,
  onSelect,
  disabled,
}) {
  const [q, setQ] = useState(placeLabel || '')
  const [hits, setHits] = useState([])
  const [open, setOpen] = useState(false)
  const [busy, setBusy] = useState(false)
  const boxRef = useRef(null)

  useEffect(() => {
    setQ(placeLabel || '')
  }, [placeLabel])

  useEffect(() => {
    const onDoc = (e) => {
      if (boxRef.current && !boxRef.current.contains(e.target)) setOpen(false)
    }
    document.addEventListener('mousedown', onDoc)
    return () => document.removeEventListener('mousedown', onDoc)
  }, [])

  useEffect(() => {
    if (!q || q.length < 2 || q === placeLabel) {
      setHits([])
      return undefined
    }

    const t = setTimeout(async () => {
      setBusy(true)
      try {
        const { data } = await axios.get(apiPath('/api/geocode/'), {
          params: { text: q },
        })
        setHits(data.results || [])
        setOpen(true)
      } catch {
        setHits([])
      } finally {
        setBusy(false)
      }
    }, 320)

    return () => clearTimeout(t)
  }, [q, placeLabel])

  const pickHit = (row) => {
    onSelect(row)
    setQ(row.label)
    setOpen(false)
  }

  return (
    <div className="placeSearch" ref={boxRef}>
      <div className="placeHead">
        <label>{label}</label>
        <button
          type="button"
          className={pickActive ? 'pickBtn on' : 'pickBtn'}
          onClick={onStartPick}
          disabled={disabled}
        >
          {pickActive ? 'Click map…' : 'Map pin'}
        </button>
      </div>
      <input
        value={q}
        placeholder="Search city or address"
        disabled={disabled}
        onChange={(e) => setQ(e.target.value)}
        onFocus={() => hits.length && setOpen(true)}
      />
      <p className="coordTiny">
        {Number(lat).toFixed(4)}, {Number(lon).toFixed(4)}
      </p>
      {busy && <p className="searchBusy">searching…</p>}
      {open && hits.length > 0 && (
        <ul className="hitList">
          {hits.map((h) => (
            <li key={`${h.lat}-${h.lon}-${h.label}`}>
              <button type="button" onClick={() => pickHit(h)}>
                {h.label}
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}

export default PlaceSearch
