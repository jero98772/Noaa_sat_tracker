const API_URL = 'http://localhost:8000'; // Change this to your FastAPI server URL
const REFRESH_INTERVAL = 10000; // Refresh satellite positions every 10 seconds

// Map setup
// This will execute after the 'map' div is available because the script tag is at the end of the body.
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
    document.getElementById('loading').style.display = 'block'; // Show loading initially
    await loadSatellites();
    await updatePositions();

    // Start the update timer
    updateTimer = setInterval(updatePositions, REFRESH_INTERVAL);

    // Add event listener for refresh button
    document.getElementById('refresh-button').addEventListener('click', async () => {
        document.getElementById('loading').style.display = 'block';
        await loadSatellites(); // Consider if you need to fully reload or just update
        await updatePositions();
        document.getElementById('loading').style.display = 'none';
    });

    // Hide loading screen after initial load
    document.getElementById('loading').style.display = 'none';
});

// Load satellite information
async function loadSatellites() {
    console.log('Loading satellites...');
    try {
        const response = await fetch(`${API_URL}/satellites`);
        if (!response.ok) throw new Error(`Failed to fetch satellites: ${response.statusText}`);

        const data = await response.json();

        // Clear existing satellites before loading new ones if necessary
        // satellites = {}; // Uncomment if you want to refresh the list completely

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
                predictions: satellites[satellite.norad_id]?.predictions || [] // Preserve existing predictions
            };
            // Initialize showing predictions flag if not already set
            if (showingPredictions[satellite.norad_id] === undefined) {
                showingPredictions[satellite.norad_id] = false;
            }
        });
        renderSatelliteList();
    } catch (error) {
        console.error('Error loading satellites:', error);
        alert('Failed to load satellite data. Please check the console for details.');
    }
}

// Update satellite positions
async function updatePositions() {
    console.log('Updating positions...');
    try {
        const response = await fetch(`${API_URL}/positions`);
        if (!response.ok) throw new Error(`Failed to fetch positions: ${response.statusText}`);

        const positions = await response.json();

        positions.forEach(position => {
            if (satellites[position.norad_id]) {
                satellites[position.norad_id].position = position;
            }
        });

        updateMarkers();
        updateSatelliteInfo();
        document.getElementById('last-update').textContent = moment().format('YYYY-MM-DD HH:mm:ss');
    } catch (error) {
        console.error('Error updating positions:', error);
        // Optionally, inform the user that position update failed, but don't use alert for frequent updates.
    }
}

// Update markers on the map
function updateMarkers() {
    Object.values(satellites).forEach(satellite => {
        if (satellite.position) {
            const { longitude, latitude } = satellite.position;

            if (!markers[satellite.norad_id]) {
                const el = document.createElement('div');
                el.className = 'marker'; // Main class for potential common styling
                // el.style.backgroundImage is set below based on visibility

                markers[satellite.norad_id] = new maplibregl.Marker(el)
                    .setLngLat([longitude, latitude])
                    .addTo(map);

                const popup = new maplibregl.Popup({ offset: 25 })
                    .setHTML(createPopupContent(satellite));
                markers[satellite.norad_id].setPopup(popup);
            } else {
                markers[satellite.norad_id].setLngLat([longitude, latitude]);
                const popup = markers[satellite.norad_id].getPopup();
                if (popup) {
                    popup.setHTML(createPopupContent(satellite));
                }
            }

            // Update marker icon based on visibility (for both new and existing markers)
            const markerElement = markers[satellite.norad_id].getElement();
            markerElement.style.backgroundImage = satellite.position.visible ?
                'url(https://img.icons8.com/color/48/000000/satellite.png)' :
                'url(https://img.icons8.com/color/48/000000/satellite-signal-loss.png)';
            markerElement.style.width = '30px'; // Example size, adjust as needed
            markerElement.style.height = '30px'; // Example size
            markerElement.style.backgroundSize = 'cover';


            updateFootprint(satellite);
        }
    });
}

// Update footprint circle for a satellite
function updateFootprint(satellite) {
    const footprintId = `footprint-${satellite.norad_id}`;
    const footprintLayerId = `footprint-layer-${satellite.norad_id}`;

    if (map.getLayer(footprintLayerId)) {
        map.removeLayer(footprintLayerId);
    }
    if (map.getSource(footprintId)) {
        map.removeSource(footprintId);
    }

    if (satellite.position && satellite.position.footprint_radius > 0) {
        const { longitude, latitude, footprint_radius } = satellite.position;
        const points = createCirclePoints([longitude, latitude], footprint_radius);

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
            'id': footprintLayerId,
            'type': 'fill',
            'source': footprintId,
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
    container.innerHTML = ''; // Clear previous list

    Object.values(satellites).forEach(satellite => {
        const satelliteElement = document.createElement('div');
        satelliteElement.className = 'satellite-item';
        satelliteElement.id = `satellite-${satellite.norad_id}`;

        const nameElement = document.createElement('h3');
        const statusIndicator = document.createElement('span');
        statusIndicator.className = 'status-indicator'; // Initial class
        statusIndicator.id = `status-${satellite.norad_id}`;

        nameElement.appendChild(statusIndicator);
        nameElement.appendChild(document.createTextNode(` ${satellite.name}`)); // Added space for clarity
        satelliteElement.appendChild(nameElement);

        const infoContainer = document.createElement('div');
        infoContainer.id = `info-${satellite.norad_id}`;
        infoContainer.className = 'satellite-info';
        infoContainer.innerHTML = 'Loading position data...';
        satelliteElement.appendChild(infoContainer);

        const buttonsContainer = document.createElement('div');
        buttonsContainer.className = 'buttons-container';

        const trackButton = document.createElement('button');
        trackButton.textContent = 'Track';
        trackButton.addEventListener('click', () => trackSatellite(satellite.norad_id));
        buttonsContainer.appendChild(trackButton);

        const predictionButton = document.createElement('button');
        predictionButton.textContent = showingPredictions[satellite.norad_id] ? 'Hide Path' : 'Show Path';
        predictionButton.className = 'toggle-predictions';
        predictionButton.id = `prediction-btn-${satellite.norad_id}`;
        predictionButton.addEventListener('click', () => togglePredictions(satellite.norad_id));
        buttonsContainer.appendChild(predictionButton);

        satelliteElement.appendChild(buttonsContainer);
        container.appendChild(satelliteElement);
    });
    updateSatelliteInfo(); // Update info for newly rendered list
}

// Update satellite information in the control panel
function updateSatelliteInfo() {
    Object.values(satellites).forEach(satellite => {
        const infoContainer = document.getElementById(`info-${satellite.norad_id}`);
        const statusIndicator = document.getElementById(`status-${satellite.norad_id}`);

        if (satellite.position) {
            const position = satellite.position;
            if (statusIndicator) {
                statusIndicator.className = `status-indicator ${position.visible ? 'visible' : 'not-visible'}`;
            }
            if (infoContainer) {
                infoContainer.innerHTML = `
                    <div>Latitude: ${position.latitude.toFixed(2)}°</div>
                    <div>Longitude: ${position.longitude.toFixed(2)}°</div>
                    <div>Altitude: ${position.altitude.toFixed(1)} km</div>
                    <div>Velocity: ${(position.velocity).toFixed(1)} m/s</div> <div>Status: ${position.visible ? 'In sunlight' : 'In eclipse'}</div>
                `;
            }
        } else if (infoContainer) {
            infoContainer.innerHTML = 'Position data not yet available.';
        }
    });
}

// Track a satellite (center map on it)
function trackSatellite(norad_id) {
    const satellite = satellites[norad_id];
    if (satellite && satellite.position) {
        map.flyTo({
            center: [satellite.position.longitude, satellite.position.latitude],
            zoom: 3 // You might want a closer zoom for tracking a single satellite
        });
        if (markers[norad_id] && markers[norad_id].getPopup()) {
           if (!markers[norad_id].getPopup().isOpen()) {
                markers[norad_id].togglePopup();
           }
        }
    }
}

// Toggle satellite path predictions
async function togglePredictions(norad_id) {
    const button = document.getElementById(`prediction-btn-${norad_id}`);
    const satellite = satellites[norad_id];
    const predictionSourceId = `predictions-source-${norad_id}`;
    const predictionLayerId = `predictions-layer-${norad_id}`;

    if (showingPredictions[norad_id]) {
        if (map.getLayer(predictionLayerId)) {
            map.removeLayer(predictionLayerId);
        }
        if (map.getSource(predictionSourceId)) {
            map.removeSource(predictionSourceId);
        }
        showingPredictions[norad_id] = false;
        button.textContent = 'Show Path';
    } else {
        button.textContent = 'Loading...';
        button.disabled = true;
        try {
            if (!satellite.predictions || satellite.predictions.length === 0) {
                const response = await fetch(`${API_URL}/predict/${norad_id}?hours=24&points=200`);
                if (!response.ok) throw new Error('Failed to fetch predictions');
                const data = await response.json();
                satellite.predictions = data.points; // Assuming data has a 'points' array
            }

            if (satellite.predictions && satellite.predictions.length > 0) {
                const coordinates = satellite.predictions.map(point => [point.longitude, point.latitude]);

                map.addSource(predictionSourceId, {
                    'type': 'geojson',
                    'data': {
                        'type': 'Feature',
                        'geometry': {
                            'type': 'LineString',
                            'coordinates': coordinates
                        }
                    }
                });
                map.addLayer({
                    'id': predictionLayerId,
                    'type': 'line',
                    'source': predictionSourceId,
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
            } else {
                 button.textContent = 'No Path'; // Or 'Error'
            }
        } catch (error) {
            console.error('Error fetching predictions:', error);
            button.textContent = 'Error';
            setTimeout(() => {
                button.textContent = 'Show Path';
                button.disabled = false; // Re-enable after error display
            }, 2000);
        } finally {
            if (button.textContent !== 'Error') { // Don't re-enable immediately if it's still loading or path shown
                 button.disabled = false;
            }
        }
    }
}

// Create popup content for a satellite
function createPopupContent(satellite) {
    const position = satellite.position;
    if (!position) return '<p>No position data available</p>';

    return `
        <h3>${satellite.name}</h3>
        <p><strong>NORAD ID:</strong> ${satellite.norad_id}</p>
        <p><strong>Status:</strong> ${position.visible ? 'In sunlight' : 'In eclipse'}</p>
        <p><strong>Position:</strong> ${position.latitude.toFixed(2)}°, ${position.longitude.toFixed(2)}°</p>
        <p><strong>Altitude:</strong> ${position.altitude.toFixed(1)} km</p>
        <p><strong>Speed:</strong> ${(position.velocity).toFixed(1)} m/s</p> <p><strong>Coverage Radius:</strong> ${position.footprint_radius ? position.footprint_radius.toFixed(1) + ' km' : 'N/A'}</p>
    `;
}

// Create circle points for satellite footprint
function createCirclePoints(center, radiusKm, numPoints = 64) {
    const points = [];
    const earthRadiusKm = 6371; 

    const [centerLng, centerLat] = center;
    const centerLatRad = centerLat * Math.PI / 180;
    const centerLngRad = centerLng * Math.PI / 180;
    const angularDistance = radiusKm / earthRadiusKm;

    for (let i = 0; i <= numPoints; i++) {
        const angle = (i / numPoints) * 2 * Math.PI; // Bearing

        const latRadians = Math.asin(
            Math.sin(centerLatRad) * Math.cos(angularDistance) +
            Math.cos(centerLatRad) * Math.sin(angularDistance) * Math.cos(angle)
        );

        let lngRadians = centerLngRad + Math.atan2(
            Math.sin(angle) * Math.sin(angularDistance) * Math.cos(centerLatRad),
            Math.cos(angularDistance) - Math.sin(centerLatRad) * Math.sin(latRadians)
        );

        // Normalize lngRadians to be between -PI and PI
        lngRadians = (lngRadians + 3 * Math.PI) % (2 * Math.PI) - Math.PI;
        
        points.push([lngRadians * 180 / Math.PI, latRadians * 180 / Math.PI]);
    }
    return points;
}

// Cleanup on page unload
window.addEventListener('beforeunload', () => {
    if (updateTimer) {
        clearInterval(updateTimer);
    }
    // Consider also removing map event listeners or destroying the map instance if needed
    // if (map) {
    //     map.remove();
    // }
});