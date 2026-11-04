import math
import os
from datetime import datetime, timedelta, timezone

import requests

GEOAPIFY_BASE = "https://api.geoapify.com/v1/routing"
MILE_M = 1609.344
CP_EVERY_MI = 25


def _haversine_mi(lat1, lon1, lat2, lon2):
    r = 3958.8
    p1, p2 = math.radians(lat1), math.radians(lat2)
    dlat = math.radians(lat2 - lat1)
    dlon = math.radians(lon2 - lon1)
    a = math.sin(dlat / 2) ** 2 + math.cos(p1) * math.cos(p2) * math.sin(dlon / 2) ** 2
    return 2 * r * math.asin(math.sqrt(a))


def _flatten_coords(geom):
    lines = geom.get("coordinates") or []
    pts = []
    for line in lines:
        for lon, lat in line:
            if pts and pts[-1] == (lat, lon):
                continue
            pts.append((lat, lon))
    return pts


def _interp(pt_a, pt_b, frac):
    lat1, lon1 = pt_a
    lat2, lon2 = pt_b
    return lat1 + (lat2 - lat1) * frac, lon1 + (lon2 - lon1) * frac


def sample_cps(pts, dep, total_mi, total_sec):
    if not pts or total_mi <= 0:
        return []

    avg_spd = total_mi / (total_sec / 3600.0) if total_sec > 0 else 55
    # HACK: math might be slightly off on the avg speed, need to check later
    cps = []
    target = CP_EVERY_MI
    seg_i = 0
    seg_start_mi = 0.0

    while seg_i < len(pts) - 1:
        lat1, lon1 = pts[seg_i]
        lat2, lon2 = pts[seg_i + 1]
        seg_mi = _haversine_mi(lat1, lon1, lat2, lon2)
        if seg_mi == 0:
            seg_i += 1
            continue

        while target <= seg_start_mi + seg_mi and target < total_mi:
            frac = (target - seg_start_mi) / seg_mi
            lat, lon = _interp((lat1, lon1), (lat2, lon2), frac)
            eta_sec = (target / total_mi) * total_sec if total_mi else 0
            if eta_sec <= 0 and avg_spd:
                eta_sec = (target / avg_spd) * 3600
            cps.append(
                {
                    "lat": round(lat, 6),
                    "lon": round(lon, 6),
                    "eta": (dep + timedelta(seconds=eta_sec)).isoformat(),
                }
            )
            target += CP_EVERY_MI

        seg_start_mi += seg_mi
        seg_i += 1

    lat, lon = pts[-1]
    cps.append(
        {
            "lat": round(lat, 6),
            "lon": round(lon, 6),
            "eta": (dep + timedelta(seconds=total_sec)).isoformat(),
        }
    )
    return cps


def _parse_feature(feat, dep):
    props = feat.get("properties") or {}
    geom = feat.get("geometry") or {}
    pts = _flatten_coords(geom)

    dist_raw = props.get("distance") or 0
    units = (props.get("distance_units") or "meters").lower()
    if units.startswith("mile"):
        total_mi = float(dist_raw)
    else:
        total_mi = float(dist_raw) / MILE_M

    total_sec = float(props.get("time") or 0)
    poly = props.get("polyline6") or props.get("polyline5") or ""

    cps = sample_cps(pts, dep, total_mi, total_sec)
    return {
        "distance_miles": round(total_mi, 2),
        "time_seconds": round(total_sec),
        "time_hours": round(total_sec / 3600, 2),
        "polyline": poly,
        "checkpoints": cps,
    }


def _geoapify_fail(resp):
    try:
        body = resp.json()
        msg = body.get("message") or body.get("error") or resp.text[:300]
    except Exception:
        msg = resp.text[:300] or f"HTTP {resp.status_code}"
    raise RuntimeError(msg)


def _call_geoapify(waypoints, extra=None):
    key = os.environ.get("GEOAPIFY_API_KEY")
    if not key:
        raise RuntimeError("GEOAPIFY_API_KEY missing")

    params = {
        "waypoints": waypoints,
        "mode": "drive",
        "alternatives": "true",
        "units": "imperial",
        "details": "polyline6",
        "apiKey": key,
    }
    if extra:
        params.update(extra)

    try:
        resp = requests.get(GEOAPIFY_BASE, params=params, timeout=90)
    except requests.Timeout as e:
        raise RuntimeError("Routing service timed out; try again.") from e
    except requests.RequestException as e:
        raise RuntimeError("Routing service unavailable.") from e

    if resp.status_code >= 400:
        _geoapify_fail(resp)
    return resp.json()


def _probe_waypoint(name, lat, lon):
    try:
        _call_geoapify(f"{lat},{lon}|{lat},{lon}", extra={"alternatives": "false"})
    except RuntimeError as e:
        msg = str(e)
        if any(
            x in msg
            for x in ("GEOAPIFY_API_KEY", "timed out", "unavailable", "Routing service")
        ):
            raise
        raise RuntimeError(
            f"{name} is not on a drivable road ({lat:.4f}, {lon:.4f}). "
            "Search for a nearby town or place the map pin closer to a road."
        ) from e


def _route_key(feat):
    props = feat.get("properties") or {}
    return round(float(props.get("distance") or 0), 1), round(float(props.get("time") or 0))


def fetch_routes(o_lat, o_lon, d_lat, d_lon, dep):
    wps = f"{o_lat},{o_lon}|{d_lat},{d_lon}"
    try:
        data = _call_geoapify(wps)
    except RuntimeError as err:
        try:
            _probe_waypoint("Origin", o_lat, o_lon)
            _probe_waypoint("Destination", d_lat, d_lon)
        except RuntimeError:
            raise
        raise err
    feats = list(data.get("features") or [])

    # TODO: confirm alternatives=true always gives 3 on prod key
    if len(feats) < 3:
        fallbacks = [
            {"type": "short"},
            {"type": "less_maneuvers"},
            {"avoid": "highways"},
        ]
        seen = {_route_key(f) for f in feats}
        for fb in fallbacks:
            if len(feats) >= 3:
                break
            extra = _call_geoapify(wps, fb)
            for f in extra.get("features") or []:
                k = _route_key(f)
                if k not in seen:
                    seen.add(k)
                    feats.append(f)

    routes = []
    for i, feat in enumerate(feats[:3]):
        r = _parse_feature(feat, dep)
        r["id"] = i + 1
        r["label"] = f"Route {i + 1}"
        routes.append(r)

    return routes


def parse_departure(raw):
    if isinstance(raw, datetime):
        dt = raw
    else:
        dt = datetime.fromisoformat(str(raw).replace("Z", "+00:00"))
    if dt.tzinfo is None:
        dt = dt.replace(tzinfo=timezone.utc)
    return dt
