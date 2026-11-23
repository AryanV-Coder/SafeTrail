from django.db import models
from django.contrib.auth.models import User


class EmergencyAlert(models.Model):
    STATUS_CHOICES = [
        ('ACTIVE', 'Active'),
        ('RESOLVED', 'Resolved'),
    ]

    sender_name = models.CharField(max_length=100)
    sender_phone = models.CharField(max_length=20, blank=True)
    status = models.CharField(max_length=20, choices=STATUS_CHOICES, default='ACTIVE')
    message = models.TextField(blank=True, default='Emergency assistance requested.')
    created_at = models.DateTimeField(auto_now_add=True)
    resolved_at = models.DateTimeField(null=True, blank=True)
    resolution_notes = models.TextField(blank=True)
    assigned_contact = models.ForeignKey(
        User,
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name='assigned_alerts'
    )

    class Meta:
        ordering = ['-created_at']

    def __str__(self):
        return f"Alert #{self.id} - {self.sender_name} [{self.status}]"

    @property
    def latest_ping(self):
        return self.pings.order_by('-timestamp').first()

    @property
    def google_maps_url(self):
        ping = self.latest_ping
        if ping:
            return f"https://www.google.com/maps?q={ping.latitude},{ping.longitude}"
        return ""


class LocationPing(models.Model):
    alert = models.ForeignKey(
        EmergencyAlert,
        on_delete=models.CASCADE,
        related_name='pings'
    )
    latitude = models.DecimalField(max_digits=9, decimal_places=6)
    longitude = models.DecimalField(max_digits=9, decimal_places=6)
    accuracy = models.FloatField(null=True, blank=True, help_text="Accuracy in meters")
    timestamp = models.DateTimeField(auto_now_add=True)

    class Meta:
        ordering = ['-timestamp']

    def __str__(self):
        return f"Ping for Alert #{self.alert_id} @ ({self.latitude}, {self.longitude})"
