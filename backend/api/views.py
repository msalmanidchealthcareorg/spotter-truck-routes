import requests
from rest_framework import status
from rest_framework.response import Response
from rest_framework.views import APIView

from .geocode import reverse, search
from .risk import recommend_route, tag_routes
from .routing import fetch_routes, parse_departure
from .serializers import RouteRequestSerializer
from .weather import get_weather


class GeocodeView(APIView):
    def get(self, request):
        lat = request.query_params.get("lat")
        lon = request.query_params.get("lon")
        text = request.query_params.get("text") or request.query_params.get("q")

        try:
            if lat is not None and lon is not None:
                rows = reverse(float(lat), float(lon))
            elif text:
                rows = search(text.strip())
            else:
                return Response({"detail": "need text or lat/lon"}, status=400)
        except RuntimeError as e:
            return Response({"detail": str(e)}, status=500)
        except requests.RequestException:
            return Response({"detail": "upstream failed"}, status=502)
        except ValueError:
            return Response({"detail": "bad coords"}, status=400)

        return Response({"results": rows})


class RouteView(APIView):
    def post(self, request):
        ser = RouteRequestSerializer(data=request.data)
        if not ser.is_valid():
            return Response(ser.errors, status=status.HTTP_400_BAD_REQUEST)

        d = ser.validated_data
        dep = parse_departure(d["departure_time"])

        try:
            routes = fetch_routes(
                d["origin_lat"],
                d["origin_lon"],
                d["dest_lat"],
                d["dest_lon"],
                dep,
            )
            tag_routes(routes, d["load_weight"], get_weather)
        except RuntimeError as e:
            return Response({"detail": str(e)}, status=status.HTTP_400_BAD_REQUEST)
        except requests.RequestException as e:
            return Response(
                {"detail": "Weather service unavailable."},
                status=status.HTTP_502_BAD_GATEWAY,
            )

        return Response(
            {
                "departure_time": dep.isoformat(),
                "load_weight": d["load_weight"],
                "recommended_route_id": recommend_route(routes),
                "routes": routes,
            }
        )
