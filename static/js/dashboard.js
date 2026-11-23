// SafeTrail - Live Watcher Dashboard AJAX Polling & Leaflet Map

(function () {
    let map = null;
    let markers = {};
    let currentFilter = 'all';
    let searchQuery = '';

    const tbody = document.getElementById('incidents-tbody');
    const counterActive = document.getElementById('counter-active');
    const counterResolved = document.getElementById('counter-resolved');
    const searchInput = document.getElementById('incident-search');
    const filterBtns = document.querySelectorAll('.filter-btn');

    // Modal elements
    const resolveDialog = document.getElementById('resolve-dialog');
    const resolveTitle = document.getElementById('resolve-modal-title');
    const resolveForm = document.getElementById('resolve-modal-form');
    const btnCloseResolve = document.getElementById('btn-close-resolve');
    const btnCancelResolve = document.getElementById('btn-cancel-resolve');

    // 1. Initialize Map
    function initMap() {
        const mapContainer = document.getElementById('map');
        if (!mapContainer) return;

        // Default view: San Francisco coordinates or world view
        map = L.map('map').setView([37.774929, -122.419416], 12);

        L.tileLayer('https://server.arcgisonline.com/ArcGIS/rest/services/World_Street_Map/MapServer/tile/{z}/{y}/{x}', {
            maxZoom: 19,
            attribution: 'Tiles &copy; Esri &mdash; Source: Esri, DeLorme, NAVTEQ, USGS'
        }).addTo(map);
    }

    // 2. Fetch Live Alerts via AJAX
    function pollLiveAlerts() {
        fetch('/api/live-alerts/')
            .then(function (response) {
                if (!response.ok) throw new Error('Polling error ' + response.status);
                return response.json();
            })
            .then(function (data) {
                if (data.status === 'success') {
                    renderAlerts(data.alerts, data.active_count);
                }
            })
            .catch(function (err) {
                console.warn('Dashboard poll warning:', err);
            });
    }

    // 3. Render Alerts to Table and Map
    function renderAlerts(alerts, activeCount) {
        if (counterActive) {
            counterActive.textContent = `Active: ${activeCount}`;
        }

        const activeAlertIds = new Set();
        const markerLatLngs = [];

        alerts.forEach(function (alert) {
            if (alert.status === 'ACTIVE') {
                activeAlertIds.add(alert.id);
            }

            // A. Update or create table row
            updateTableRow(alert);

            // B. Update map marker for active alerts with coordinates
            if (alert.status === 'ACTIVE' && alert.latitude !== null && alert.longitude !== null) {
                const latLng = [alert.latitude, alert.longitude];
                markerLatLngs.push(latLng);

                const popupContent = `
                    <div style="font-family: inherit; font-size: 13px;">
                        <strong style="color: #cf222e;">[ACTIVE SOS] #${alert.id}</strong><br>
                        <strong>Sender:</strong> ${escapeHtml(alert.sender_name)}<br>
                        <strong>Note:</strong> ${escapeHtml(alert.message || 'No note')}<br>
                        <strong>Coords:</strong> ${alert.latitude.toFixed(6)}, ${alert.longitude.toFixed(6)}<br>
                        <a href="${alert.google_maps_url}" target="_blank" style="color: #0969da; text-decoration: underline; font-size: 12px;">Open in Google Maps</a>
                    </div>
                `;

                if (markers[alert.id]) {
                    markers[alert.id].setLatLng(latLng);
                    markers[alert.id].setPopupContent(popupContent);
                } else {
                    const marker = L.circleMarker(latLng, {
                        radius: 8,
                        fillColor: '#cf222e',
                        color: '#ffffff',
                        weight: 2,
                        opacity: 1,
                        fillOpacity: 0.9
                    }).addTo(map);

                    marker.bindPopup(popupContent);
                    markers[alert.id] = marker;
                }
            } else {
                // If alert is resolved or coordinate is null, remove marker
                if (markers[alert.id]) {
                    map.removeLayer(markers[alert.id]);
                    delete markers[alert.id];
                }
            }
        });

        // Clean up markers for any alerts that have disappeared
        Object.keys(markers).forEach(function (id) {
            if (!activeAlertIds.has(parseInt(id))) {
                map.removeLayer(markers[id]);
                delete markers[id];
            }
        });

        // Fit map bounds if there are active markers
        if (markerLatLngs.length > 0 && map) {
            const bounds = L.latLngBounds(markerLatLngs);
            if (markerLatLngs.length === 1) {
                map.setView(markerLatLngs[0], 14);
            } else {
                map.fitBounds(bounds, { padding: [40, 40] });
            }
        }

        applyClientFilter();
    }

    function updateTableRow(alert) {
        let row = document.getElementById(`row-${alert.id}`);
        const emptyRow = document.getElementById('empty-row');
        if (emptyRow) emptyRow.remove();

        const isActive = (alert.status === 'ACTIVE');
        const badgeClass = isActive ? 'badge-active' : 'badge-resolved';
        const rowClass = isActive ? 'row-active incident-row' : 'incident-row';
        const coordsHtml = (alert.latitude !== null && alert.longitude !== null)
            ? `${alert.latitude.toFixed(6)}, ${alert.longitude.toFixed(6)}<br><a href="${alert.google_maps_url}" target="_blank" rel="noopener" style="font-size: 11px;">[Google Maps]</a>`
            : '<span style="color: var(--text-secondary);">-</span>';

        const actionsHtml = isActive
            ? `<a href="/alerts/${alert.id}/" class="btn btn-secondary btn-sm" style="padding: 2px 6px; font-size: 11px;">Trail</a>
               <button type="button" class="btn btn-primary btn-sm btn-resolve-modal" data-id="${alert.id}" data-sender="${escapeHtml(alert.sender_name)}" style="padding: 2px 6px; font-size: 11px;">Resolve</button>`
            : `<a href="/alerts/${alert.id}/" class="btn btn-secondary btn-sm" style="padding: 2px 6px; font-size: 11px;">Details</a>`;

        const rowContent = `
            <td><strong>#${alert.id}</strong></td>
            <td><span class="badge ${badgeClass}">${alert.status}</span></td>
            <td style="font-size: 12px; color: var(--text-secondary);">${alert.created_at}</td>
            <td>
                <strong>${escapeHtml(alert.sender_name)}</strong>
                ${alert.sender_phone ? `<br><small style="color: var(--text-secondary);">${escapeHtml(alert.sender_phone)}</small>` : ''}
            </td>
            <td>${escapeHtml(alert.message || '-')}</td>
            <td style="font-family: monospace; font-size: 12px;">${coordsHtml}</td>
            <td>${alert.ping_count || 1}</td>
            <td style="text-align: right;">${actionsHtml}</td>
        `;

        if (row) {
            row.className = rowClass;
            row.dataset.status = alert.status;
            row.dataset.sender = (alert.sender_name || '').toLowerCase();
            row.dataset.msg = (alert.message || '').toLowerCase();
            row.innerHTML = rowContent;
        } else {
            // New incoming alert! Prepend to top of table
            row = document.createElement('tr');
            row.id = `row-${alert.id}`;
            row.className = rowClass;
            row.dataset.status = alert.status;
            row.dataset.sender = (alert.sender_name || '').toLowerCase();
            row.dataset.msg = (alert.message || '').toLowerCase();
            row.innerHTML = rowContent;

            if (tbody.firstChild) {
                tbody.insertBefore(row, tbody.firstChild);
            } else {
                tbody.appendChild(row);
            }
        }
    }

    // 4. Client Search & Status Filtering
    function applyClientFilter() {
        const rows = document.querySelectorAll('.incident-row');
        rows.forEach(function (row) {
            const status = row.dataset.status || '';
            const sender = row.dataset.sender || '';
            const msg = row.dataset.msg || '';

            const matchesStatus = (currentFilter === 'all' || status === currentFilter);
            const matchesSearch = !searchQuery || sender.includes(searchQuery) || msg.includes(searchQuery);

            if (matchesStatus && matchesSearch) {
                row.style.display = '';
            } else {
                row.style.display = 'none';
            }
        });
    }

    filterBtns.forEach(function (btn) {
        btn.addEventListener('click', function () {
            filterBtns.forEach(function (b) { b.classList.remove('active'); });
            btn.classList.add('active');
            currentFilter = btn.dataset.filter;
            applyClientFilter();
        });
    });

    if (searchInput) {
        searchInput.addEventListener('input', function (e) {
            searchQuery = e.target.value.toLowerCase().trim();
            applyClientFilter();
        });
    }

    // 5. Resolution Modal Handlers
    document.addEventListener('click', function (e) {
        if (e.target && e.target.classList.contains('btn-resolve-modal')) {
            const alertId = e.target.dataset.id;
            const senderName = e.target.dataset.sender;
            if (resolveTitle) resolveTitle.textContent = `Resolve Incident #${alertId} (${senderName})`;
            if (resolveForm) resolveForm.action = `/alerts/${alertId}/resolve/`;
            if (resolveDialog) resolveDialog.style.display = 'flex';
        }
    });

    function closeResolveDialog() {
        if (resolveDialog) resolveDialog.style.display = 'none';
    }

    if (btnCloseResolve) btnCloseResolve.addEventListener('click', closeResolveDialog);
    if (btnCancelResolve) btnCancelResolve.addEventListener('click', closeResolveDialog);

    function escapeHtml(text) {
        if (!text) return '';
        const div = document.createElement('div');
        div.textContent = text;
        return div.innerHTML;
    }

    // Initialize map & start polling
    initMap();
    pollLiveAlerts();
    setInterval(pollLiveAlerts, 3000);
})();

