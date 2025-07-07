from django.urls import path
from . import views
urlpatterns = [
  path('', views.control_view, name='controls_page'),
  path("api/led/toggle/", views.toggle_led, name="toggle_led"),
  path("api/led/state/", views.get_led_state, name="get_led_state"),
  path("api/led/toggle-schedule/", views.toggle_schedule, name="toggle_schedule"),
  path("api/led/update-time/", views.update_auto_time, name="update_auto_time"),
  path("api/led/auto-refresh/", views.auto_control_refresh, name="led_auto_refresh"),
]