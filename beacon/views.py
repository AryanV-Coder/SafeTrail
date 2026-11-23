import csv
import json
from django.shortcuts import render, redirect, get_object_or_404
from django.contrib.auth.decorators import login_required
from django.contrib.auth.forms import UserCreationForm
from django.contrib.auth import login
from django.contrib import messages
from django.http import HttpResponse, JsonResponse
from django.utils import timezone
from .models import EmergencyAlert, LocationPing
from .forms import AlertResolveForm


def trigger_view(request):
    """
    Public web interface for triggering an SOS from a mobile device or laptop browser.
    """
    return render(request, 'beacon/trigger.html')


@login_required
def dashboard_view(request):
    """
    Watcher dashboard for authenticated responders and emergency contacts.
    """
    active_alerts = EmergencyAlert.objects.filter(status='ACTIVE').prefetch_related('pings')
    resolved_alerts = EmergencyAlert.objects.filter(status='RESOLVED').prefetch_related('pings')[:25]
    
    context = {
        'active_alerts': active_alerts,
        'resolved_alerts': resolved_alerts,
        'active_count': active_alerts.count(),
        'resolved_count': EmergencyAlert.objects.filter(status='RESOLVED').count(),
        'resolve_form': AlertResolveForm(),
    }
    return render(request, 'beacon/dashboard.html', context)


@login_required
def alert_detail_view(request, alert_id):
    """
    Detailed incident view showing all historical location pings and breadcrumb trail.
    """
    alert = get_object_or_404(EmergencyAlert.objects.prefetch_related('pings'), pk=alert_id)
    pings = alert.pings.order_by('timestamp')
    
    trail_data = [
        {
            'lat': float(p.latitude),
            'lng': float(p.longitude),
            'time': p.timestamp.strftime('%H:%M:%S'),
            'accuracy': p.accuracy
        }
        for p in pings
    ]

    context = {
        'alert': alert,
        'pings': pings,
        'trail_json': json.dumps(trail_data),
        'resolve_form': AlertResolveForm(instance=alert) if alert.status == 'ACTIVE' else None,
    }
    return render(request, 'beacon/alert_detail.html', context)


@login_required
def resolve_alert_view(request, alert_id):
    """
    Mark an active alert as resolved with optional notes and contact assignment.
    """
    alert = get_object_or_404(EmergencyAlert, pk=alert_id)
    if request.method == 'POST':
        form = AlertResolveForm(request.POST, instance=alert)
        if form.is_valid():
            resolved_alert = form.save(commit=False)
            resolved_alert.status = 'RESOLVED'
            resolved_alert.resolved_at = timezone.now()
            if not resolved_alert.assigned_contact:
                resolved_alert.assigned_contact = request.user
            resolved_alert.save()
            messages.success(request, f"Incident #{alert.id} ({alert.sender_name}) marked as RESOLVED.")
            
            if request.headers.get('x-requested-with') == 'XMLHttpRequest':
                return JsonResponse({"status": "success", "message": f"Incident #{alert.id} resolved."})
            return redirect('dashboard')
        else:
            messages.error(request, "Failed to resolve alert. Please check input.")
    return redirect('dashboard')


@login_required
def delete_alert_view(request, alert_id):
    """
    Delete test alerts during lab demonstrations.
    """
    alert = get_object_or_404(EmergencyAlert, pk=alert_id)
    if request.method == 'POST':
        alert_num = alert.id
        alert.delete()
        messages.info(request, f"Incident #{alert_num} removed.")
    return redirect('dashboard')


@login_required
def export_alerts_csv(request):
    """
    Export all emergency incident records and their latest coordinates as a CSV spreadsheet.
    """
    response = HttpResponse(content_type='text/csv')
    timestamp_str = timezone.now().strftime('%Y%m%d_%H%M%S')
    response['Content-Disposition'] = f'attachment; filename="safetrail_incidents_{timestamp_str}.csv"'

    writer = csv.writer(response)
    writer.writerow([
        'Incident ID',
        'Status',
        'Sender Name',
        'Phone',
        'Message',
        'Created At (UTC)',
        'Resolved At (UTC)',
        'Latest Latitude',
        'Latest Longitude',
        'Total GPS Pings',
        'Assigned Contact',
        'Resolution Notes'
    ])

    alerts = EmergencyAlert.objects.all().order_by('-created_at').prefetch_related('pings', 'assigned_contact')
    for a in alerts:
        latest = a.latest_ping
        writer.writerow([
            a.id,
            a.status,
            a.sender_name,
            a.sender_phone,
            a.message,
            a.created_at.strftime('%Y-%m-%d %H:%M:%S'),
            a.resolved_at.strftime('%Y-%m-%d %H:%M:%S') if a.resolved_at else '',
            latest.latitude if latest else '',
            latest.longitude if latest else '',
            a.pings.count(),
            a.assigned_contact.username if a.assigned_contact else 'Unassigned',
            a.resolution_notes.replace('\n', ' ')
        ])

    return response


def register_view(request):
    """
    Responder / Emergency Contact registration.
    """
    if request.user.is_authenticated:
        return redirect('dashboard')

    if request.method == 'POST':
        form = UserCreationForm(request.POST)
        if form.is_valid():
            user = form.save()
            login(request, user)
            messages.success(request, f"Welcome to SafeTrail, {user.username}. Account created successfully.")
            return redirect('dashboard')
    else:
        form = UserCreationForm()

    return render(request, 'registration/register.html', {'form': form})
