RISK_ORDER = {"Low": 1, "Mod": 2, "High": 3, "Severe": 4, "No Travel": 5}
MI_PER_CP = 25


def _wind_tier(mph):
    if mph >= 55:
        return "No Travel"
    if mph >= 45:
        return "Severe"
    if mph >= 35:
        return "High"
    if mph >= 25:
        return "Mod"
    return "Low"


def _rain_tier(in_hr):
    if in_hr > 1.0:
        return "No Travel"
    if in_hr >= 0.5:
        return "Severe"
    if in_hr >= 0.25:
        return "High"
    if in_hr >= 0.1:
        return "Mod"
    return "Low"


def _snow_tier(in_hr):
    if in_hr > 3.0:
        return "No Travel"
    if in_hr >= 2.0:
        return "Severe"
    if in_hr >= 1.0:
        return "High"
    if in_hr >= 0.5:
        return "Mod"
    return "Low"


def _max_risk(*levels):
    return max(levels, key=lambda x: RISK_ORDER[x])


def calc_risk(cp, load_lb):
    w = cp.get("w_data") or {}
    wind = float(w.get("wind_mph") or 0)
    rain = float(w.get("rain_in_hr") or 0)
    snow = float(w.get("snow_in_hr") or 0)

    risk = _max_risk(_wind_tier(wind), _rain_tier(rain), _snow_tier(snow))

    if wind >= 55:
        risk = "No Travel"
    elif wind >= 45 and load_lb > 30000:
        risk = "No Travel"
    elif wind >= 35 and load_lb > 40000:
        risk = _max_risk(risk, "Severe")

    return risk


def _tier_miles(cps, tier):
    n = sum(1 for cp in cps if cp.get("risk") == tier)
    return n * MI_PER_CP


def _avg_risk(cps):
    if not cps:
        return 5.0
    return sum(RISK_ORDER.get(cp.get("risk"), 5) for cp in cps) / len(cps)


def recommend_route(routes):
    if not routes:
        return None

    scored = []
    for rt in routes:
        cps = rt.get("checkpoints") or []
        scored.append(
            (
                _tier_miles(cps, "Severe"),
                _tier_miles(cps, "High"),
                _avg_risk(cps),
                rt.get("time_seconds") or 0,
                rt.get("id"),
            )
        )

    scored.sort(key=lambda x: (x[0], x[1], x[2], x[3]))
    return scored[0][4]


def tag_routes(routes, load_lb, w_fn):
    # TODO: refactor this if I have time (batch weather calls?)
    for rt in routes:
        for cp in rt.get("checkpoints") or []:
            cp["w_data"] = w_fn(cp["lat"], cp["lon"], cp["eta"])
            cp["risk"] = calc_risk(cp, load_lb)
