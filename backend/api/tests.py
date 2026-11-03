from datetime import datetime, timezone

from django.test import SimpleTestCase

from .risk import calc_risk, recommend_route
from .routing import sample_cps, _flatten_coords


class CheckpointTests(SimpleTestCase):
    def test_sample_every_25_miles(self):
        pts = [(40.0, -75.0), (41.0, -75.0), (42.0, -75.0)]
        dep = datetime(2026, 11, 4, 8, 0, tzinfo=timezone.utc)
        cps = sample_cps(pts, dep, 138.0, 7200)
        self.assertGreaterEqual(len(cps), 4)
        self.assertIn("eta", cps[0])

    def test_flatten_skips_dupes(self):
        geom = {
            "coordinates": [
                [[-75.0, 40.0], [-74.5, 40.5]],
                [[-74.5, 40.5], [-74.0, 41.0]],
            ]
        }
        self.assertEqual(len(_flatten_coords(geom)), 3)


class RiskTests(SimpleTestCase):
    def test_load_no_travel(self):
        cp = {"w_data": {"wind_mph": 46, "rain_in_hr": 0, "snow_in_hr": 0}}
        self.assertEqual(calc_risk(cp, 35000), "No Travel")

    def test_recommend_prefers_safer(self):
        routes = [
            {
                "id": 1,
                "time_seconds": 1000,
                "checkpoints": [{"risk": "Severe"}, {"risk": "Low"}],
            },
            {
                "id": 2,
                "time_seconds": 2000,
                "checkpoints": [{"risk": "Low"}, {"risk": "Low"}],
            },
        ]
        self.assertEqual(recommend_route(routes), 2)
