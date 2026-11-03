import os

import requests

AUTO_URL = "https://api.geoapify.com/v1/geocode/autocomplete"
REV_URL = "https://api.geoapify.com/v1/geocode/reverse"


def _key():
    k = os.environ.get("GEOAPIFY_API_KEY")
    if not k:
        raise RuntimeError("GEOAPIFY_API_KEY missing")
    return k


def _fmt_feat(f):
    p = f.get("properties") or {}
    return {
        "label": p.get("formatted") or p.get("name") or "unknown",
        "lat": p.get("lat"),
        "lon": p.get("lon"),
    }


def search(text, limit=6):
    resp = requests.get(
        AUTO_URL,
        params={"text": text, "limit": limit, "apiKey": _key()},
        timeout=20,
    )
    resp.raise_for_status()
    feats = resp.json().get("features") or []
    out = []
    for f in feats:
        row = _fmt_feat(f)
        if row["lat"] is not None and row["lon"] is not None:
            out.append(row)
    return out


def reverse(lat, lon):
    resp = requests.get(
        REV_URL,
        params={"lat": lat, "lon": lon, "apiKey": _key()},
        timeout=20,
    )
    resp.raise_for_status()
    feats = resp.json().get("features") or []
    if not feats:
        return [{"label": f"{lat:.4f}, {lon:.4f}", "lat": lat, "lon": lon}]
    return [_fmt_feat(feats[0])]
