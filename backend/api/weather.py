from datetime import datetime, timezone

import requests

FORECAST_URL = "https://api.open-meteo.com/v1/forecast"
_w_cache = {}


def _as_utc(eta):
    if isinstance(eta, datetime):
        dt = eta
    else:
        dt = datetime.fromisoformat(str(eta).replace("Z", "+00:00"))
    if dt.tzinfo is None:
        dt = dt.replace(tzinfo=timezone.utc)
    return dt.astimezone(timezone.utc)


def get_weather(lat, lon, eta):
    dt = _as_utc(eta)
    ck = (round(lat, 3), round(lon, 3), dt.strftime("%Y-%m-%dT%H"))
    if ck in _w_cache:
        return _w_cache[ck]

    params = {
        "latitude": lat,
        "longitude": lon,
        "hourly": "wind_speed_10m,rain,snowfall",
        "forecast_days": 16,
        "timezone": "UTC",
        "wind_speed_unit": "mph",
        "precipitation_unit": "inch",
    }
    resp = requests.get(FORECAST_URL, params=params, timeout=30)
    resp.raise_for_status()
    hourly = resp.json().get("hourly") or {}
    times = hourly.get("time") or []
    if not times:
        out = {"wind_mph": 0.0, "rain_in_hr": 0.0, "snow_in_hr": 0.0}
        _w_cache[ck] = out
        return out

    best_i = 0
    best_diff = None
    for i, t in enumerate(times):
        slot = datetime.fromisoformat(t).replace(tzinfo=timezone.utc)
        diff = abs((slot - dt).total_seconds())
        if best_diff is None or diff < best_diff:
            best_diff = diff
            best_i = i

    wind = float((hourly.get("wind_speed_10m") or [0])[best_i] or 0)
    rain = float((hourly.get("rain") or [0])[best_i] or 0)
    snow = float((hourly.get("snowfall") or [0])[best_i] or 0)

    out = {
        "wind_mph": round(wind, 2),
        "rain_in_hr": round(rain, 3),
        "snow_in_hr": round(snow, 3),
        "forecast_hour": times[best_i],
    }
    _w_cache[ck] = out
    return out
