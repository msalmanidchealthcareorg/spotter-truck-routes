from django.contrib import admin
from django.http import JsonResponse
from django.urls import include, path


def root(_request):
    return JsonResponse(
        {
            "status": "ok",
            "ui": "http://127.0.0.1:5173/",
            "route_api": "POST /api/route/",
        }
    )


urlpatterns = [
    path("", root),
    path("admin/", admin.site.urls),
    path("api/", include("api.urls")),
]
