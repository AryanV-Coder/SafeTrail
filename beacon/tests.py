import json
from django.test import TestCase, Client
from django.contrib.auth.models import User
from django.urls import reverse
from beacon.models import EmergencyAlert, LocationPing


class SafeTrailSystemTests(TestCase):
    def setUp(self):
        self.client = Client()
        self.user = User.objects.create_user(
            username='ranger1',
            password='password123',
            email='ranger1@example.com'
        )

    def test_trigger_sos_api_valid(self):
        payload = {
            "sender_name": "John Doe",
            "sender_phone": "+919876543210",
            "message": "Injured knee on ridge",
            "latitude": 28.613929,
            "longitude": 77.209021,
            "accuracy": 8.5
        }
        response = self.client.post(
            reverse('api_trigger_sos'),
            data=json.dumps(payload),
            content_type='application/json'
        )
        self.assertEqual(response.status_code, 201)
        data = response.json()
        self.assertEqual(data['status'], 'success')
        self.assertIn('alert_id', data)

        # Verify database record
        alert = EmergencyAlert.objects.get(pk=data['alert_id'])
        self.assertEqual(alert.sender_name, "John Doe")
        self.assertEqual(alert.status, "ACTIVE")
        self.assertEqual(alert.pings.count(), 1)
        self.assertAlmostEqual(float(alert.latest_ping.latitude), 28.613929, places=5)

    def test_trigger_sos_api_invalid_coords(self):
        # Latitude out of bounds (> 90)
        payload = {
            "sender_name": "Jane",
            "latitude": 120.0,
            "longitude": -122.0
        }
        response = self.client.post(
            reverse('api_trigger_sos'),
            data=json.dumps(payload),
            content_type='application/json'
        )
        self.assertEqual(response.status_code, 400)
        self.assertIn('Latitude must be between -90 and 90', response.json()['message'])

    def test_continuous_location_ping(self):
        alert = EmergencyAlert.objects.create(
            sender_name="Trail Runner",
            status="ACTIVE"
        )
        # Initial ping
        LocationPing.objects.create(alert=alert, latitude=28.6139, longitude=77.2090)

        # Send subsequent ping via API
        payload = {
            "latitude": 28.6145,
            "longitude": 77.2095,
            "accuracy": 5.0
        }
        response = self.client.post(
            reverse('api_ping_location', args=[alert.id]),
            data=json.dumps(payload),
            content_type='application/json'
        )
        self.assertEqual(response.status_code, 201)
        self.assertEqual(alert.pings.count(), 2)

    def test_live_alerts_api(self):
        alert = EmergencyAlert.objects.create(
            sender_name="Camper 1",
            status="ACTIVE",
            message="Need help"
        )
        LocationPing.objects.create(alert=alert, latitude=28.61, longitude=77.20)

        response = self.client.get(reverse('api_live_alerts'))
        self.assertEqual(response.status_code, 200)
        data = response.json()
        self.assertEqual(data['status'], 'success')
        self.assertEqual(data['active_count'], 1)
        self.assertEqual(len(data['alerts']), 1)
        self.assertEqual(data['alerts'][0]['sender_name'], "Camper 1")

    def test_dashboard_access_control(self):
        # Unauthenticated request redirects to login
        response = self.client.get(reverse('dashboard'))
        self.assertEqual(response.status_code, 302)
        self.assertIn('/login/', response.url)

        # Logged in responder gets dashboard 200
        self.client.login(username='ranger1', password='password123')
        response = self.client.get(reverse('dashboard'))
        self.assertEqual(response.status_code, 200)
        self.assertContains(response, "SafeTrail Dispatch Monitor")

    def test_resolve_alert_flow(self):
        alert = EmergencyAlert.objects.create(
            sender_name="Hiker Lost",
            status="ACTIVE"
        )
        self.client.login(username='ranger1', password='password123')

        resolve_url = reverse('resolve_alert', args=[alert.id])
        response = self.client.post(resolve_url, data={
            'resolution_notes': 'Found hiker and returned to trailhead safely.',
            'assigned_contact': self.user.id
        })
        self.assertEqual(response.status_code, 302)

        alert.refresh_from_db()
        self.assertEqual(alert.status, 'RESOLVED')
        self.assertIsNotNone(alert.resolved_at)
        self.assertEqual(alert.assigned_contact, self.user)

    def test_csv_export(self):
        alert = EmergencyAlert.objects.create(
            sender_name="Forest User",
            status="ACTIVE",
            message="Test distress"
        )
        LocationPing.objects.create(alert=alert, latitude=28.65, longitude=77.40)

        self.client.login(username='ranger1', password='password123')
        response = self.client.get(reverse('export_csv'))
        self.assertEqual(response.status_code, 200)
        self.assertEqual(response['Content-Type'], 'text/csv')
        self.assertIn('attachment; filename="safetrail_incidents_', response['Content-Disposition'])

        content = response.content.decode('utf-8')
        self.assertIn('Incident ID,Status,Sender Name', content)
        self.assertIn('Forest User', content)
