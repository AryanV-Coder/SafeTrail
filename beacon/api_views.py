import json
from decimal import Decimal, InvalidOperation
from django.http import JsonResponse
from django.views.decorators.csrf import csrf_exempt
from django.views.decorators.http import require_http_methods
from django.db import transaction
from django.utils import timezone
from .models import EmergencyAlert, LocationPing


def _parse_coordinate(val, min_val, max_val, name):
    try:
        dec = Decimal(str(val))
    except (InvalidOperation, TypeError, ValueError):
        raise ValueError(f"Invalid {name} coordinate value: '{val}'.")
    if not (min_val <= dec <= max_val):
        raise ValueError(f"{name} must be between {min_val} and {max_val}.")
    return dec


@csrf_exempt
@require_http_methods(["POST"])
def trigger_sos_api(request):
    """
    Public API endpoint to ingest incoming emergency SOS alerts.
    Accepts JSON:
    {
        "sender_name": "Jane Doe",
        "sender_phone": "+1234567890",  (optional)
        "message": "Need help on trail", (optional)
        "latitude": 37.774929,
        "longitude": -122.419416,
        "accuracy": 10.5                (optional)
    }
    """
    try:
        data = json.loads(request.body.decode('utf-8'))
    except Exception:
        return JsonResponse({"status": "error", "message": "Malformed JSON payload."}, status=400)

    sender_name = data.get('sender_name', '').strip()
    if not sender_name:
        return JsonResponse({"status": "error", "message": "sender_name is required."}, status=400)

    sender_phone = data.get('sender_phone', '').strip()
    message = data.get('message', '').strip() or 'Emergency assistance requested.'

    lat_raw = data.get('latitude')
    lng_raw = data.get('longitude')
    if lat_raw is None or lng_raw is None:
        return JsonResponse({"status": "error", "message": "latitude and longitude are required."}, status=400)

    try:
        lat = _parse_coordinate(lat_raw, -90, 90, "Latitude")
        lng = _parse_coordinate(lng_raw, -180, 180, "Longitude")
    except ValueError as e:
        return JsonResponse({"status": "error", "message": str(e)}, status=400)

    accuracy = data.get('accuracy')
    if accuracy is not None:
        try:
            accuracy = float(accuracy)
        except (ValueError, TypeError):
            accuracy = None

    with transaction.atomic():
        alert = EmergencyAlert.objects.create(
            sender_name=sender_name,
            sender_phone=sender_phone,
            message=message,
            status='ACTIVE'
        )
        LocationPing.objects.create(
            alert=alert,
            latitude=lat,
            longitude=lng,
            accuracy=accuracy
        )

    return JsonResponse({
        "status": "success",
        "alert_id": alert.id,
        "message": "Distress alert received successfully. Continuous location tracking active.",
        "created_at": alert.created_at.strftime('%Y-%m-%d %H:%M:%S UTC')
    }, status=201)


@csrf_exempt
@require_http_methods(["POST"])
def ping_location_api(request, alert_id):
    """
    Subsequent periodic coordinate updates for an active alert.
    """
    try:
        alert = EmergencyAlert.objects.get(pk=alert_id)
    except EmergencyAlert.DoesNotExist:
        return JsonResponse({"status": "error", "message": f"Alert #{alert_id} not found."}, status=404)

    if alert.status == 'RESOLVED':
        return JsonResponse({
            "status": "closed",
            "message": f"Alert #{alert_id} has been marked as resolved. Ping ignored."
        }, status=200)

    try:
        data = json.loads(request.body.decode('utf-8'))
    except Exception:
        return JsonResponse({"status": "error", "message": "Malformed JSON payload."}, status=400)

    lat_raw = data.get('latitude')
    lng_raw = data.get('longitude')
    if lat_raw is None or lng_raw is None:
        return JsonResponse({"status": "error", "message": "latitude and longitude are required."}, status=400)

    try:
        lat = _parse_coordinate(lat_raw, -90, 90, "Latitude")
        lng = _parse_coordinate(lng_raw, -180, 180, "Longitude")
    except ValueError as e:
        return JsonResponse({"status": "error", "message": str(e)}, status=400)

    accuracy = data.get('accuracy')
    if accuracy is not None:
        try:
            accuracy = float(accuracy)
        except (ValueError, TypeError):
            accuracy = None

    ping = LocationPing.objects.create(
        alert=alert,
        latitude=lat,
        longitude=lng,
        accuracy=accuracy
    )

    return JsonResponse({
        "status": "success",
        "ping_id": ping.id,
        "alert_id": alert.id,
        "timestamp": ping.timestamp.strftime('%Y-%m-%d %H:%M:%S UTC')
    }, status=201)


@require_http_methods(["GET"])
def live_alerts_api(request):
    """
    Internal AJAX polling feed for the Watcher Dashboard.
    Returns all active alerts, plus the 10 most recent resolved alerts.
    """
    active_qs = EmergencyAlert.objects.filter(status='ACTIVE').prefetch_related('pings')
    resolved_qs = EmergencyAlert.objects.filter(status='RESOLVED').prefetch_related('pings')[:10]

    alerts_data = []
    for alert in list(active_qs) + list(resolved_qs):
        latest_ping = alert.latest_ping
        alerts_data.append({
            "id": alert.id,
            "sender_name": alert.sender_name,
            "sender_phone": alert.sender_phone,
            "status": alert.status,
            "message": alert.message,
            "created_at": alert.created_at.strftime('%Y-%m-%d %H:%M:%S'),
            "latitude": float(latest_ping.latitude) if latest_ping else None,
            "longitude": float(latest_ping.longitude) if latest_ping else None,
            "accuracy": latest_ping.accuracy if latest_ping else None,
            "ping_count": alert.pings.count(),
            "google_maps_url": alert.google_maps_url,
            "assigned_contact": alert.assigned_contact.username if alert.assigned_contact else None,
            "resolution_notes": alert.resolution_notes,
        })

    return JsonResponse({
        "status": "success",
        "server_time": timezone.now().strftime('%Y-%m-%d %H:%M:%S'),
        "active_count": active_qs.count(),
        "alerts": alerts_data
    })

