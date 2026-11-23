from django.contrib import admin
from .models import EmergencyAlert, LocationPing


class LocationPingInline(admin.TabularInline):
    model = LocationPing
    extra = 0
    readonly_fields = ('latitude', 'longitude', 'accuracy', 'timestamp')
    can_delete = False


@admin.register(EmergencyAlert)
class EmergencyAlertAdmin(admin.ModelAdmin):
    list_display = ('id', 'sender_name', 'sender_phone', 'status', 'created_at', 'resolved_at', 'assigned_contact')
    list_filter = ('status', 'created_at')
    search_fields = ('sender_name', 'sender_phone', 'message', 'resolution_notes')
    inlines = [LocationPingInline]


@admin.register(LocationPing)
class LocationPingAdmin(admin.ModelAdmin):
    list_display = ('id', 'alert', 'latitude', 'longitude', 'accuracy', 'timestamp')
    list_filter = ('timestamp',)
    search_fields = ('alert__sender_name',)
