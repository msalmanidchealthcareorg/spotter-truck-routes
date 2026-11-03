# Spotter — Weather-Aware Truck Routing

Full-stack demo for the Spotter assessment: Django REST API + React (Vite) UI.  
Plans up to **3 driving routes**, samples weather every **25 miles**, scores **risk**, and picks a **recommended route**.

---

## Run locally

### 1. API key

Sign up at [Geoapify](https://myprojects.geoapify.com/) (free tier is enough).

```bash
cp backend/.env.example backend/.env
# edit backend/.env → GEOAPIFY_API_KEY=...
```

Open-Meteo does **not** need a key.

### 2. Backend (Django)

```bash
cd backend
python3 -m venv .venv
source .venv/bin/activate          # Windows: .venv\Scripts\activate
pip install -r requirements.txt
python manage.py migrate
python manage.py runserver
```

API: `http://127.0.0.1:8000`

### Deploy backend (Render / Railway / similar)

**Option A (recommended):** In Render → **Settings** → **Root Directory**, set `backend`. Then:

| Setting | Value |
|--------|--------|
| Build | `pip install -r requirements.txt && python manage.py migrate` |
| Start | `gunicorn config.wsgi:application --bind 0.0.0.0:$PORT` |

**Option B:** Leave root directory empty and use the repo-root `requirements.txt` (includes `backend/requirements.txt`). Build: `pip install -r requirements.txt && python backend/manage.py migrate`. Start: `cd backend && gunicorn config.wsgi:application --bind 0.0.0.0:$PORT`.

Or connect **`render.yaml`** at the repo root (Blueprint) — it sets `rootDir: backend` for you.

Set **Python 3.12** (not 3.14) under Environment if the build picks the wrong runtime.

Environment variables: `GEOAPIFY_API_KEY` (required), `DEBUG=False`, `SECRET_KEY`, `ALLOWED_HOSTS` (your host name), and `CORS_ALLOWED_ORIGINS` (frontend URL when you deploy the UI).

### 3. Frontend (React)

```bash
cd frontend
npm install
npm run dev
```

App: `http://127.0.0.1:5173` (Vite proxies `/api` → Django on `:8000`).

### 4. Quick test

```bash
curl -X POST http://127.0.0.1:8000/api/route/ \
  -H "Content-Type: application/json" \
  -d '{
    "origin_lat": 39.9526,
    "origin_lon": -75.1652,
    "dest_lat": 40.7128,
    "dest_lon": -74.006,
    "departure_time": "2026-11-05T14:00:00Z",
    "load_weight": 32000
  }'
```

---

## External APIs

| Service | Used for |
|--------|-----------|
| **Geoapify Routing** (`/v1/routing`) | 3 route alternatives, polylines, distance/time |
| **Geoapify Geocoding** (autocomplete + reverse) | Search origin/destination; label map clicks |
| **Open-Meteo Forecast** | Hourly `wind_speed_10m`, `rain`, `snowfall` at checkpoint ETA |

Routing and geocoding go through the backend so the Geoapify key stays in `.env`. Weather is fetched server-side per checkpoint (with simple in-memory caching per lat/lon/hour).

---

## Risk engine — design notes

Implementation lives in `backend/api/risk.py` (wired from `POST /api/route/`).

### Per-checkpoint weather

For each checkpoint we call Open-Meteo and pick the **forecast hour closest to that checkpoint’s ETA** (not “now”). That matches the brief: weather along the trip should reflect when the truck is expected to be there.

### Tier rules (assessment spec)

Wind, rain, and snow each get a tier: **Low → Mod → High → Severe → No Travel**, using the exact thresholds from the PDF.

For a single checkpoint I take the **worst tier** across wind, rain, and snow (max severity wins). Rain/snow use inch/hour values from Open-Meteo with `precipitation_unit=inch`; wind uses mph.

### Load overrides (after tiers)

These only adjust the **wind** side, as specified:

- Wind ≥ 55 mph → **No Travel** (any load)
- Wind 45–54 mph and load **> 30,000 lb** → **No Travel**
- Wind 35–44 mph and load **> 40,000 lb** → at least **Severe**

So a heavy truck can be blocked or downgraded even when rain/snow alone look acceptable.

### Route recommendation

`recommend_route()` compares the three routes in order:

1. Fewest **Severe** miles (each Severe checkpoint counts as 25 mi)
2. Fewest **High** miles (same 25 mi assumption)
3. Lowest **average risk score** (Low=1 … No Travel=5)
4. Shortest **travel time** (tie-break)

That ordering mirrors the assessment’s priority: safety first, then time.

### Trade-offs / TODOs

- Weather is **one API call per checkpoint** (cached by rounded lat/lon + hour). Batching would be nicer at scale.
- If Geoapify returns fewer than 3 alternatives, extra calls with different `type` / `avoid` fill the list.
- Frontend heatmap scrubber **reuses** checkpoint weather and shifts focus along the route; a production version would re-fetch forecast for the scrubbed hour.

---

## Project layout

```
backend/          Django + DRF (api app)
frontend/         React + Vite + Leaflet
```

Main endpoints:

- `POST /api/route/` — routes + weather + risk + `recommended_route_id`
- `GET /api/geocode/?text=...` — place search
- `GET /api/geocode/?lat=...&lon=...` — reverse geocode (map pick)

---

## Author

Muhammad Salman — Spotter AI full-stack assessment.
