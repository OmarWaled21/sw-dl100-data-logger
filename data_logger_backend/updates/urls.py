from django.urls import path

from updates.views import CheckFirmwareView, LatestFirmwareView


urlpatterns = [
  path("firmware/latest/", LatestFirmwareView.as_view(), name="latest-firmware"),
  path("firmware/check/", CheckFirmwareView.as_view(), name="check-firmware"),
]