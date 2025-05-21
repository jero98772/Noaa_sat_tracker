// Configuration
const API_URL = 'http://localhost:8000'; // Change this to your FastAPI server URL
const REFRESH_INTERVAL = 10000; // Refresh satellite positions every 10 seconds

// Map setup
const map = new maplibregl.Map({
    container: 'map',
    style: 'https://api.maptiler.com/maps/streets/style.json?key=WTMWivnNwRvcZnodv0Bq', // Get a free key from MapTiler
    center: [0, 0],
    zoom: 1.5
});

// Add map controls
map.addControl(new maplibregl.NavigationControl());
map.addControl(new maplibregl.FullscreenControl());

// Global variables
let satellites = {};
let markers = {};
let predictionLines = {};
let showingPredictions = {};
let updateTimer;

// Initialize the application once the map has loaded
map.on('load', async () => {
    await loadSatellites();
    await updatePositions();

    // Start the update timer
    updateTimer = setInterval(updatePositions, REFRESH_INTERVAL);

    // Add event listener for refresh button
    document.getElementById('refresh-button').addEventListener('click', async () => {
        document.getElementById('loading').style.display = 'block';
        await loadSatellites();
        await updatePositions();
        document.getElementById('loading').style.display = 'none';
    });

    // Hide loading screen
    document.getElementById('loading').style.display = 'none';
});

// Load satellite information
async function loadSatellites() {
    try {
        const response = await fetch(`${API_URL}/satellites`);
        if (!response.ok) throw new Error('Failed to fetch satellites');

        const data = await response.json();

        // Process satellites
        data.forEach(satellite => {
            satellites[satellite.norad_id] = {
                name: satellite.name,
                norad_id: satellite.norad_id,
                tle: {
                    line1: satellite.line1,
                    line2: satellite.line2
                },
                position: null,
                predictions: []
            };

            // Initialize showing predictions flag
            showingPredictions[satellite.norad_id] = false;
        });

        // Render satellite list in control panel
        renderSatelliteList();

    } catch (error) {
        console.error('Error loading satellites:', error);
        alert('Failed to load satellite data. Please check the console for details.');
    }
}

// Update satellite positions
async function updatePositions() {
    try {
        const response = await fetch(`${API_URL}/positions`);
        if (!response.ok) {
            const errorData = await response.json();
            throw new Error(errorData.error || 'Failed to fetch positions');
        }

        const positions = await response.json();

        // Update each satellite's position
        positions.forEach(position => {
            if (satellites[position.norad_id]) {
                satellites[position.norad_id].position = position;
            }
        });

        // Update markers on the map
        updateMarkers();

        // Update satellite information in the control panel
        updateSatelliteInfo();

        // Update last update time
        document.getElementById('last-update').textContent = moment().format('YYYY-MM-DD HH:mm:ss');
    } catch (error) {
        console.error('Error updating positions:', error);
        // Update the last update time to show error
        document.getElementById('last-update').textContent = `Error: ${error.message}`;
        // Show error in the loading message
        const loadingElement = document.getElementById('loading');
        if (loadingElement) {
            loadingElement.innerHTML = `
                <h3>Error updating satellite data</h3>
                <p>${error.message}</p>
                <p>Please try refreshing the page.</p>
            `;
        }
    }
}

// Update markers on the map
function updateMarkers() {
    Object.values(satellites).forEach(satellite => {
        if (satellite.position) {
            const { longitude, latitude } = satellite.position;

            // Create or update marker
            if (!markers[satellite.norad_id]) {
                // Create satellite icon element
                const el = document.createElement('div');
                el.className = 'marker';
                el.style.background = satellite.position.visible ?
                    'url(https://img.icons8.com/color/48/000000/satellite.png)' :
                    'url(https://img.icons8.com/color/48/000000/satellite-signal-loss.png)';
                el.style.backgroundSize = 'cover';

                // Create marker
                markers[satellite.norad_id] = new maplibregl.Marker(el)
                    .setLngLat([longitude, latitude])
                    .addTo(map);

                // Add popup
                const popup = new maplibregl.Popup({ offset: 25 })
                    .setHTML(createPopupContent(satellite));

                markers[satellite.norad_id].setPopup(popup);
            } else {
                // Update existing marker
                markers[satellite.norad_id].setLngLat([longitude, latitude]);

                // Update popup content
                const popup = markers[satellite.norad_id].getPopup();
                if (popup) {
                    popup.setHTML(createPopupContent(satellite));
                }

                // Update marker icon based on visibility
                const el = markers[satellite.norad_id].getElement().querySelector('.marker');
                if (el) {
                    el.style.background = satellite.position.visible ?
                        'url(https://img.icons8.com/color/48/000000/satellite.png)' :
                        'url(https://img.icons8.com/color/48/000000/satellite-signal-loss.png)';
                }
            }

            // Update footprint circle
            updateFootprint(satellite);
        }
    });
}

// Update footprint circle for a satellite
function updateFootprint(satellite) {
    const footprintId = `footprint-${satellite.norad_id}`;

    // Remove existing footprint if it exists
    if (map.getSource(footprintId)) {
        map.removeLayer(footprintId);
        map.removeSource(footprintId);
    }

    if (satellite.position) {
        // Create a circle representing the satellite's footprint
        const { longitude, latitude, footprint_radius } = satellite.position;

        // Calculate the circle points (simplification for demo)
        const points = createCirclePoints([longitude, latitude], footprint_radius);

        // Add the footprint to the map
        map.addSource(footprintId, {
            'type': 'geojson',
            'data': {
                'type': 'Feature',
                'geometry': {
                    'type': 'Polygon',
                    'coordinates': [points]
                }
            }
        });

        map.addLayer({
            'id': footprintId,
            'type': 'fill',
            'source': footprintId,
            'layout': {},
            'paint': {
                'fill-color': satellite.position.visible ? '#4CAF50' : '#F44336',
                'fill-opacity': 0.2
            }
        });
    }
}

// Render the satellite list in the control panel
function renderSatelliteList() {
    const container = document.getElementById('satellites-container');
    container.innerHTML = '';

    Object.values(satellites).forEach(satellite => {
        const satelliteElement = document.createElement('div');
        satelliteElement.className = 'satellite-item';
        satelliteElement.id = `satellite-${satellite.norad_id}`;

        const nameElement = document.createElement('h3');
        const statusIndicator = document.createElement('span');
        statusIndicator.className = 'status-indicator';
        statusIndicator.id = `status-${satellite.norad_id}`;

        nameElement.appendChild(statusIndicator);
        nameElement.appendChild(document.createTextNode(satellite.name));
        satelliteElement.appendChild(nameElement);

        // Add info container
        const infoContainer = document.createElement('div');
        infoContainer.id = `info-${satellite.norad_id}`;
        infoContainer.className = 'satellite-info';
        infoContainer.innerHTML = 'Loading position data...';
        satelliteElement.appendChild(infoContainer);

        // Add buttons
        const buttonsContainer = document.createElement('div');
        buttonsContainer.className = 'buttons-container';

        // Track button
        const trackButton = document.createElement('button');
        trackButton.textContent = 'Track';
        trackButton.addEventListener('click', () => trackSatellite(satellite.norad_id));
        buttonsContainer.appendChild(trackButton);

        // Toggle predictions button
        const predictionButton = document.createElement('button');
        predictionButton.textContent = 'Show Path';
        predictionButton.className = 'toggle-predictions';
        predictionButton.id = `prediction-btn-${satellite.norad_id}`;
        predictionButton.addEventListener('click', () => togglePredictions(satellite.norad_id));
        buttonsContainer.appendChild(predictionButton);

        satelliteElement.appendChild(buttonsContainer);
        container.appendChild(satelliteElement);
    });
}

// Update satellite information in the control panel
function updateSatelliteInfo() {
    Object.values(satellites).forEach(satellite => {
        if (satellite.position) {
            const position = satellite.position;
            const statusIndicator = document.getElementById(`status-${satellite.norad_id}`);
            const infoContainer = document.getElementById(`info-${satellite.norad_id}`);

            // Update status indicator
            if (statusIndicator) {
                statusIndicator.className = `status-indicator ${position.visible ? 'visible' : 'not-visible'}`;
            }

            // Update info text
            if (infoContainer) {
                infoContainer.innerHTML = `
                    <div>Latitude: ${position.latitude.toFixed(2)}°</div>
                    <div>Longitude: ${position.longitude.toFixed(2)}°</div>
                    <div>Altitude: ${position.altitude.toFixed(1)} km</div>
                    <div>Velocity: ${(position.velocity / 1000).toFixed(1)} km/s</div>
                    <div>Status: ${position.visible ? 'In sunlight' : 'In eclipse'}</div>
                `;
            }
        }
    });
}

// Track a satellite (center map on it)
function trackSatellite(norad_id) {
    const satellite = satellites[norad_id];
    if (satellite && satellite.position) {
        map.flyTo({
            center: [satellite.position.longitude, satellite.position.latitude],
            zoom: 3
        });

        // Open the popup
        if (markers[norad_id]) {
            markers[norad_id].togglePopup();
        }
    }
}

// Toggle satellite path predictions
async function togglePredictions(norad_id) {
    const button = document.getElementById(`prediction-btn-${norad_id}`);

    if (showingPredictions[norad_id]) {
        // Hide predictions
        if (map.getSource(`predictions-${norad_id}`)) {
            map.removeLayer(`predictions-${norad_id}`);
            map.removeSource(`predictions-${norad_id}`);
        }

        showingPredictions[norad_id] = false;
        button.textContent = 'Show Path';
    } else {
        // Show loading state
        button.textContent = 'Loading...';
        button.disabled = true;

        try {
            // Fetch predictions if we don't have them yet
            if (!satellites[norad_id].predictions || satellites[norad_id].predictions.length === 0) {
                const response = await fetch(`${API_URL}/predict/${norad_id}?hours=24&points=200`);
                if (!response.ok) throw new Error('Failed to fetch predictions');

                const data = await response.json();
                satellites[norad_id].predictions = data.points;
            }

            // Create path on map
            const coordinates = satellites[norad_id].predictions.map(point => [point.longitude, point.latitude]);

            if (map.getSource(`predictions-${norad_id}`)) {
                map.removeLayer(`predictions-${norad_id}`);
                map.removeSource(`predictions-${norad_id}`);
            }

            map.addSource(`predictions-${norad_id}`, {
                'type': 'geojson',
                'data': {
                    'type': 'Feature',
                    'properties': {},
                    'geometry': {
                        'type': 'LineString',
                        'coordinates': coordinates
                    }
                }
            });

            map.addLayer({
                'id': `predictions-${norad_id}`,
                'type': 'line',
                'source': `predictions-${norad_id}`,
                'layout': {
                    'line-join': 'round',
                    'line-cap': 'round'
                },
                'paint': {
                    'line-color': '#2196F3',
                    'line-width': 3,
                    'line-dasharray': [2, 1]
                }
            });

            showingPredictions[norad_id] = true;
            button.textContent = 'Hide Path';
        } catch (error) {
            console.error('Error fetching predictions:', error);
            button.textContent = 'Error';
            setTimeout(() => {
                button.textContent = 'Show Path';
            }, 2000);
        } finally {
            button.disabled = false;
        }
    }
}

// Create popup content for a satellite
function createPopupContent(satellite) {
    const position = satellite.position;
    if (!position) return '<p>No position data available</p>';

    return `
        <h3>${satellite.name}</h3>
        <p>NORAD ID: ${satellite.norad_id}</p>
        <p>Status: ${position.visible ? 'In sunlight' : 'In eclipse'}</p>
        <p>Position: ${position.latitude.toFixed(2)}°, ${position.longitude.toFixed(2)}°</p>
        <p>Altitude: ${position.altitude.toFixed(1)} km</p>
        <p>Speed: ${(position.velocity / 1000).toFixed(1)} km/s</p>
        <p>Coverage radius: ${position.footprint_radius.toFixed(1)} km</p>
    `;
}

// Create circle points for satellite footprint
function createCirclePoints(center, radiusKm, numPoints = 64) {
    const points = [];
    const earthRadiusKm = 6371; // Earth radius in km

    for (let i = 0; i <= numPoints; i++) {
        const angle = (i / numPoints) * 2 * Math.PI;

        // Calculate point on circle in radians
        const latRadians = Math.asin(Math.sin(center[1] * Math.PI / 180) * Math.cos(radiusKm / earthRadiusKm) +
                                    Math.cos(center[1] * Math.PI / 180) * Math.sin(radiusKm / earthRadiusKm) * Math.cos(angle));

        const lngRadians = center[0] * Math.PI / 180 +
                                    Math.atan2(Math.sin(angle) * Math.sin(radiusKm / earthRadiusKm) * Math.cos(center[1] * Math.PI / 180),
                                             Math.cos(radiusKm / earthRadiusKm) - Math.sin(center[1] * Math.PI / 180) * Math.sin(latRadians));

        // Convert back to degrees
        const lat = latRadians * 180 / Math.PI;
        const lng = lngRadians * 180 / Math.PI;

        points.push([lng, lat]);
    }

    return points;
}

// Cleanup on page unload
window.addEventListener('beforeunload', () => {
    if (updateTimer) {
        clearInterval(updateTimer);
    }
}); 