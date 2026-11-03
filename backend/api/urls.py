from django.urls import path

from .views import GeocodeView, RouteView

urlpatterns = [
    path("geocode/", GeocodeView.as_view(), name="geocode"),
    path("route/", RouteView.as_view(), name="route"),
]
