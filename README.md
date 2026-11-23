# SafeTrail: Emergency Distress & Real-Time Location Tracking System

SafeTrail is a lightweight, unified emergency distress monitoring system built with Django. It bridges the gap between individuals in distress (hikers, campus walkers, travelers) and emergency responders through a real-time web console.

The entire project runs inside a single, modular Django server with no external mobile app installations or heavy API frameworks required.

---

## 1. System Architecture (The 3-Part Flow)

1. **The Trigger (`/trigger/`)**:
   - A lightweight, mobile-optimized web page accessible from any smartphone, tablet, or laptop browser.
   - Captures device coordinates using the standard browser **HTML5 Geolocation API** (`navigator.geolocation`).
   - Includes a **"Use Demo Coordinates"** feature for immediate testing in indoor environments or labs where satellite signals are obstructed.
   - After dispatching the distress call, continuously transmits periodic location pings every 10 seconds to log movement.

2. **The Manager (Django Backend)**:
   - Ingests incoming SOS alerts via JSON endpoints (`/api/trigger-sos/` and `/api/ping-location/<id>/`).
   - Validates coordinates and enforces database transactions using Django ORM.
   - Restricts dashboard access to authenticated responders and emergency contacts.
   - Provides live polling feeds (`/api/live-alerts/`) and generates downloadable incident reports in CSV format.

3. **The Watcher (`/dashboard/`)**:
   - Authenticated responder console updating in real time via JavaScript `setInterval()` AJAX polling (every 3 seconds).
   - Dynamically injects new alerts into the incident table without page reloads.
   - Renders live tactical pins on an embedded **Leaflet.js** map powered by free Esri World Street Map tiles (no API keys or watermarks required).
   - Generates one-click direct Google Maps navigation links.
   - Allows responders to resolve incidents, log notes, and inspect historical breadcrumb trails.

---

## 2. Tech Stack

- **Backend**: Python 3, Django 6.x (MVT architecture)
- **Database**: SQLite (built-in Django ORM)
- **Frontend**: Django Templates, clean utilitarian CSS, vanilla JavaScript (Fetch API)
- **Mapping**: Leaflet.js with Esri World Street Map (high resolution, free, no API keys or watermarks)
- **Device Sensors**: HTML5 Geolocation API

---

## 3. Directory Layout

```text
SafeTrail/
├── .venv/                      # Python virtual environment
├── requirements.txt            # Project dependencies
├── manage.py                   # Django command-line tool
├── db.sqlite3                  # SQLite database
├── safetrail/                  # Project configuration
│   ├── settings.py
│   ├── urls.py
│   └── wsgi.py
├── beacon/                     # Core application
│   ├── models.py               # EmergencyAlert & LocationPing
│   ├── admin.py                # Django Admin with TabularInline pings
│   ├── forms.py                # AlertResolveForm ModelForm
│   ├── views.py                # Dashboard, details, CSV export & auth views
│   ├── api_views.py            # JSON endpoints for SOS ingestion & polling
│   ├── urls.py                 # App routing
│   └── tests.py                # Automated test suite (7 tests)
├── templates/
│   ├── base.html               # Shared layout & Leaflet resources
│   ├── beacon/
│   │   ├── trigger.html        # Mobile SOS trigger interface
│   │   ├── dashboard.html      # Watcher live console
│   │   └── alert_detail.html   # Breadcrumb movement trail view
│   └── registration/
│       ├── login.html          # Responder login
│       └── register.html       # Responder registration
└── static/
    ├── css/
    │   └── style.css           # Utilitarian, minimalist stylesheet
    └── js/
        ├── trigger.js          # GPS capture & continuous pinging
        └── dashboard.js        # 3s AJAX polling & live map markers
```

---

## 4. Getting Started

### Prerequisites
- Python 3.10+ installed on your system.

### Installation & Setup

1. **Clone or navigate into the repository**:
   ```bash
   cd SafeTrail
   ```

2. **Activate the virtual environment**:
   ```bash
   source .venv/bin/activate
   # On Windows: .venv\Scripts\activate
   ```

   *(If recreating the venv from scratch, run `python3 -m venv .venv && source .venv/bin/activate && pip install -r requirements.txt`)*

3. **Run database migrations**:
   ```bash
   python manage.py migrate
   ```

4. **Start the development server**:
   ```bash
   python manage.py runserver 0.0.0.0:8000
   ```

---

## 5. Default Credentials & Access Points

The local database comes pre-seeded with a superuser account for immediate testing:

- **Username**: `admin`
- **Password**: `admin123`

### URLs:
| Page | URL | Access | Description |
|---|---|---|---|
| **SOS Trigger** | `http://127.0.0.1:8000/trigger/` | Public | Mobile-friendly distress trigger for users |
| **Watcher Dashboard** | `http://127.0.0.1:8000/dashboard/` | Authenticated | Live monitor with AJAX polling & map |
| **Incident Details** | `http://127.0.0.1:8000/alerts/<id>/` | Authenticated | Full breadcrumb movement trail |
| **CSV Export** | `http://127.0.0.1:8000/alerts/export-csv/` | Authenticated | Instant download of incident history |
| **Django Admin** | `http://127.0.0.1:8000/admin/` | Staff/Superuser | Database inspection and user management |

---

## 6. How to Demonstrate in the Lab

1. **Step 1: Open the Dashboard**:
   - Log in to `http://127.0.0.1:8000/dashboard/` using `admin` / `admin123`.
   - Observe the live tactical map and the pre-seeded incidents.

2. **Step 2: Trigger an SOS from Mobile or Another Browser Tab**:
   - Open `http://127.0.0.1:8000/trigger/` (or use your laptop's local network IP `http://<laptop-ip>:8000/trigger/` on your smartphone).
   - Enter your name, click **"Use Demo Coordinates"** (or allow browser GPS), and click **"SEND EMERGENCY SOS"**.

3. **Step 3: Observe Real-Time AJAX Updates**:
   - Switch back to the dashboard tab.
   - Within 3 seconds, without refreshing, the new emergency appears at the top of the table highlighted in red, and a tactical pin drops on the map.

4. **Step 4: View Movement Trail & Resolve**:
   - Click **"Trail"** next to the incident to see the polyline connecting location updates.
   - Click **"Resolve"**, enter resolution notes, and confirm. The incident transitions to `RESOLVED`.

5. **Step 5: Export CSV**:
   - Click **"Export CSV"** in the top-right toolbar to download the incident report spreadsheet.

---

## 7. Running Automated Tests

Run the full automated test suite covering API ingestion, coordinate validation, live polling, permissions, and CSV export:

```bash
python manage.py test beacon
```

