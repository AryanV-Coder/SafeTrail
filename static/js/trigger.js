// SafeTrail - Mobile/Client SOS Trigger Logic

(function () {
    let currentLat = null;
    let currentLng = null;
    let currentAccuracy = null;
    let activeAlertId = null;
    let pingInterval = null;

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
            // Default demo coordinate (e.g. scenic park trail)
            const demoLat = 37.774929;
            const demoLng = -122.419416;
            updateCoordinates(demoLat, demoLng, 8.0, 'Demo Lab Coordinates Active');
            if (formError) formError.style.display = 'none';
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

    // Send periodic pings while alert is active
    function startPeriodicPings() {
        if (pingInterval) clearInterval(pingInterval);

        pingInterval = setInterval(function () {
            if (!activeAlertId) return;

            // Try device GPS, or simulate small movement if in demo mode
            if (navigator.geolocation) {
                navigator.geolocation.getCurrentPosition(
                    function (pos) {
                        sendPing(pos.coords.latitude, pos.coords.longitude, pos.coords.accuracy);
                    },
                    function () {
                        // If device GPS lost or denied, slightly jitter demo position to simulate trail movement
                        simulateDriftPing();
                    },
                    { enableHighAccuracy: true, timeout: 5000, maximumAge: 3000 }
                );
            } else {
                simulateDriftPing();
            }
        }, 10000);
    }

    function simulateDriftPing() {
        if (currentLat === null || currentLng === null) return;
        // Small step ~10 meters
        currentLat += (Math.random() - 0.5) * 0.0002;
        currentLng += (Math.random() - 0.5) * 0.0002;
        sendPing(currentLat, currentLng, 10.0);
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

