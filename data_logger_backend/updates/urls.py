from django.urls import path

from updates.views import LatestUpdateView, CheckFirmwareUpdateView, SyncUpdatesView

urlpatterns = [
  path('latest/', LatestUpdateView.as_view(), name='latest-update'),
  path('sync/', SyncUpdatesView.as_view(), name='sync-updates'),
  path('check/firmware/', CheckFirmwareUpdateView.as_view(), name='check-firmware-update'),
]