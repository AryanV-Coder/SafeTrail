// SafeTrail - Mobile/Client SOS Trigger Logic

(function () {
    // Realistic structured Indian trail route (~500m per ping, straight -> turn right -> turn left -> straight)
    const DEMO_TRAIL_WAYPOINTS = [
        { lat: 28.613900, lng: 77.209000 }, // Waypoint 0: Trailhead Start (SOS Point)
        { lat: 28.618500, lng: 77.209000 }, // Waypoint 1: Straight North (+500m)
        { lat: 28.623100, lng: 77.209000 }, // Waypoint 2: Straight North (+500m)
        { lat: 28.623100, lng: 77.214000 }, // Waypoint 3: Turn Right -> East (+500m)
        { lat: 28.623100, lng: 77.219000 }, // Waypoint 4: Straight East (+500m)
        { lat: 28.623100, lng: 77.224000 }, // Waypoint 5: Straight East (+500m)
        { lat: 28.627700, lng: 77.224000 }, // Waypoint 6: Turn Left -> North (+500m)
        { lat: 28.632300, lng: 77.224000 }, // Waypoint 7: Straight North (+500m)
        { lat: 28.636900, lng: 77.224000 }, // Waypoint 8: Straight North (+500m)
        { lat: 28.636900, lng: 77.219000 }, // Waypoint 9: Turn Left -> West (+500m)
        { lat: 28.636900, lng: 77.214000 }, // Waypoint 10: Straight West (+500m)
        { lat: 28.641500, lng: 77.214000 }, // Waypoint 11: Turn Right -> North (+500m)
        { lat: 28.646100, lng: 77.214000 }, // Waypoint 12: Straight North (+500m)
        { lat: 28.650700, lng: 77.214000 }  // Waypoint 13: Straight North (+500m)
    ];
    let demoWaypointIndex = 0;

    let currentLat = DEMO_TRAIL_WAYPOINTS[0].lat;
    let currentLng = DEMO_TRAIL_WAYPOINTS[0].lng;
    let currentAccuracy = 10.0;
    let activeAlertId = null;
    let pingInterval = null;
    let isDemoMode = false;

    const gpsStatusText = document.getElementById('gps-status-text');
    const gpsCoordsDisplay = document.getElementById('gps-coords-display');
    const btnDemo = document.getElementById('btn-demo-coords');
    const sosForm = document.getElementById('sos-form');
    const btnSendSos = document.getElementById('btn-send-sos');
    const formError = document.getElementById('form-error');
    const triggerPanel = document.getElementById('trigger-panel');
    const activeBanner = document.getElementById('active-banner');
    const activeIncidentId = document.getElementById('active-incident-id');
    const activeLastCoords = document.getElementById('active-last-coords');
    const btnStopSos = document.getElementById('btn-stop-sos');

    function updateCoordinates(lat, lng, acc, sourceText) {
        currentLat = parseFloat(lat);
        currentLng = parseFloat(lng);
        currentAccuracy = acc ? parseFloat(acc) : null;

        document.getElementById('latitude').value = currentLat.toFixed(6);
        document.getElementById('longitude').value = currentLng.toFixed(6);
        document.getElementById('accuracy').value = currentAccuracy ? currentAccuracy.toFixed(1) : '';

        if (gpsStatusText) {
            gpsStatusText.textContent = sourceText || 'GPS Locked';
            gpsStatusText.style.color = '#1a7f37';
        }
        if (gpsCoordsDisplay) {
            const accText = currentAccuracy ? ` (±${currentAccuracy}m)` : '';
            gpsCoordsDisplay.textContent = `Lat: ${currentLat.toFixed(6)}, Lng: ${currentLng.toFixed(6)}${accText}`;
        }
    }

    function acquireDeviceLocation() {
        if (!navigator.geolocation) {
            if (gpsStatusText) {
                gpsStatusText.textContent = 'Geolocation not supported by browser. Click "Use Demo Coordinates".';
                gpsStatusText.style.color = '#cf222e';
            }
            return;
        }

        if (gpsStatusText) {
            gpsStatusText.textContent = 'Requesting browser location permission...';
            gpsStatusText.style.color = '#57606a';
        }

        navigator.geolocation.getCurrentPosition(
            function (position) {
                const lat = position.coords.latitude;
                const lng = position.coords.longitude;
                const acc = position.coords.accuracy;
                updateCoordinates(lat, lng, acc, 'Device GPS Connected');
            },
            function (error) {
                let msg = 'GPS error';
                switch (error.code) {
                    case error.PERMISSION_DENIED:
                        msg = 'Location permission denied. Click "Use Demo Coordinates" for lab demo.';
                        break;
                    case error.POSITION_UNAVAILABLE:
                        msg = 'Location information unavailable. Click "Use Demo Coordinates".';
                        break;
                    case error.TIMEOUT:
                        msg = 'Location request timed out. Click "Use Demo Coordinates".';
                        break;
                }
                if (gpsStatusText) {
                    gpsStatusText.textContent = msg;
                    gpsStatusText.style.color = '#cf222e';
                }
            },
            {
                enableHighAccuracy: true,
                timeout: 10000,
                maximumAge: 5000
            }
        );
    }

    // Demo coordinates button (useful for classroom/lab evaluation without GPS wait)
    if (btnDemo) {
        btnDemo.addEventListener('click', function () {
            isDemoMode = true;
            demoWaypointIndex = 0;
            const startPoint = DEMO_TRAIL_WAYPOINTS[0];
            updateCoordinates(startPoint.lat, startPoint.lng, 5.0, 'Indian Demo Trail Active (Starting Point)');
            if (formError) formError.style.display = 'none';

            // Auto-fill test inputs if empty so user can send immediately
            const nameField = document.getElementById('sender_name');
            const msgField = document.getElementById('sos_message');
            if (nameField && !nameField.value.trim()) {
                nameField.value = 'Demo Hiker (India)';
            }
            if (msgField && !msgField.value.trim()) {
                msgField.value = 'Test emergency broadcast from Trail A, NCR.';
            }
        });
    }

    // Submit SOS Alert
    if (sosForm) {
        sosForm.addEventListener('submit', function (e) {
            e.preventDefault();
            if (formError) formError.style.display = 'none';

            if (currentLat === null || currentLng === null) {
                if (formError) {
                    formError.textContent = 'GPS coordinates are missing. Please wait for GPS or click "Use Demo Coordinates".';
                    formError.style.display = 'block';
                }
                return;
            }

            const senderName = document.getElementById('sender_name').value.trim();
            const senderPhone = document.getElementById('sender_phone').value.trim();
            const message = document.getElementById('sos_message').value.trim();

            if (!senderName) {
                if (formError) {
                    formError.textContent = 'Please enter your name or hiker ID.';
                    formError.style.display = 'block';
                }
                return;
            }

            btnSendSos.disabled = true;
            btnSendSos.textContent = 'TRANSMITTING DISTRESS SIGNAL...';

            const payload = {
                sender_name: senderName,
                sender_phone: senderPhone,
                message: message,
                latitude: currentLat,
                longitude: currentLng,
                accuracy: currentAccuracy
            };

            fetch('/api/trigger-sos/', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify(payload)
            })
            .then(function (response) {
                return response.json().then(function (data) {
                    return { ok: response.ok, data: data };
                });
            })
            .then(function (result) {
                if (!result.ok) {
                    throw new Error(result.data.message || 'Server error while sending SOS.');
                }

                activeAlertId = result.data.alert_id;
                triggerPanel.style.display = 'none';
                activeBanner.style.display = 'block';
                activeIncidentId.textContent = `#${activeAlertId}`;
                activeLastCoords.textContent = `${currentLat.toFixed(6)}, ${currentLng.toFixed(6)}`;

                // Begin periodic location pings every 10 seconds
                startPeriodicPings();
            })
            .catch(function (err) {
                btnSendSos.disabled = false;
                btnSendSos.textContent = 'SEND EMERGENCY SOS';
                if (formError) {
                    formError.textContent = err.message || 'Failed to transmit SOS.';
                    formError.style.display = 'block';
                }
            });
        });
    }

    // Send periodic pings while alert is active (automatically every 6s in demo mode)
    function startPeriodicPings() {
        if (pingInterval) clearInterval(pingInterval);

        const intervalMs = isDemoMode ? 6000 : 10000;

        pingInterval = setInterval(function () {
            if (!activeAlertId) return;

            if (isDemoMode) {
                // If demo mode is active, strictly keep Indian coordinates and simulate movement
                simulateDriftPing();
            } else if (navigator.geolocation) {
                navigator.geolocation.getCurrentPosition(
                    function (pos) {
                        sendPing(pos.coords.latitude, pos.coords.longitude, pos.coords.accuracy);
                    },
                    function () {
                        // If device GPS lost or denied, slightly jitter position
                        simulateDriftPing();
                    },
                    { enableHighAccuracy: true, timeout: 5000, maximumAge: 3000 }
                );
            } else {
                simulateDriftPing();
            }
        }, intervalMs);
    }

    function simulateDriftPing() {
        if (currentLat === null || currentLng === null) return;

        // Follow realistic structured route: straight -> turn right -> turn left -> straight
        demoWaypointIndex++;
        if (demoWaypointIndex < DEMO_TRAIL_WAYPOINTS.length) {
            currentLat = DEMO_TRAIL_WAYPOINTS[demoWaypointIndex].lat;
            currentLng = DEMO_TRAIL_WAYPOINTS[demoWaypointIndex].lng;
        } else {
            // If pings continue past defined route, smoothly advance straight North
            currentLat += 0.0046;
        }

        sendPing(currentLat, currentLng, 5.0);
    }

    function sendPing(lat, lng, acc) {
        currentLat = lat;
        currentLng = lng;
        if (activeLastCoords) {
            activeLastCoords.textContent = `${currentLat.toFixed(6)}, ${currentLng.toFixed(6)}`;
        }

        fetch(`/api/ping-location/${activeAlertId}/`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({
                latitude: currentLat,
                longitude: currentLng,
                accuracy: acc
            })
        })
        .then(function (res) { return res.json(); })
        .then(function (data) {
            if (data.status === 'closed') {
                // Alert was marked resolved by responder on dashboard
                stopBroadcast();
                alert(`Notice: Incident #${activeAlertId} has been marked as RESOLVED by the dispatch responder.`);
            }
        })
        .catch(function (e) {
            console.warn('Ping update error:', e);
        });
    }

    function stopBroadcast() {
        if (pingInterval) {
            clearInterval(pingInterval);
            pingInterval = null;
        }
        activeAlertId = null;
        isDemoMode = false;
        demoWaypointIndex = 0;
        activeBanner.style.display = 'none';
        triggerPanel.style.display = 'block';
        btnSendSos.disabled = false;
        btnSendSos.textContent = 'SEND EMERGENCY SOS';
    }

    if (btnStopSos) {
        btnStopSos.addEventListener('click', function () {
            if (confirm('Are you sure you want to stop broadcasting your emergency location?')) {
                stopBroadcast();
            }
        });
    }

    // Try acquiring location automatically on initial page load
    acquireDeviceLocation();
})();

