from django.urls import path
from django.contrib.auth import views as auth_views
from . import views
from . import api_views

urlpatterns = [
    # Main Views
    path('', views.trigger_view, name='home'),
    path('trigger/', views.trigger_view, name='trigger'),
    path('dashboard/', views.dashboard_view, name='dashboard'),
    path('alerts/<int:alert_id>/', views.alert_detail_view, name='alert_detail'),
    path('alerts/<int:alert_id>/resolve/', views.resolve_alert_view, name='resolve_alert'),
    path('alerts/<int:alert_id>/delete/', views.delete_alert_view, name='delete_alert'),
    path('alerts/export-csv/', views.export_alerts_csv, name='export_csv'),

    # Authentication
    path('register/', views.register_view, name='register'),
    path('login/', auth_views.LoginView.as_view(template_name='registration/login.html'), name='login'),
    path('logout/', auth_views.LogoutView.as_view(), name='logout'),

    # REST / JSON API Endpoints
    path('api/trigger-sos/', api_views.trigger_sos_api, name='api_trigger_sos'),
    path('api/ping-location/<int:alert_id>/', api_views.ping_location_api, name='api_ping_location'),
    path('api/live-alerts/', api_views.live_alerts_api, name='api_live_alerts'),
    path('api/alerts/<int:alert_id>/pings/', api_views.alert_pings_api, name='api_alert_pings'),
]

