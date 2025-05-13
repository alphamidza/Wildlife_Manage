// Main application
document.addEventListener('DOMContentLoaded', function() {
    const JSONBIN_API_KEY = 'YOUR_JSONBIN_API_KEY';
    const ISSUE_BIN_ID = 'YOUR_BIN_ID_FOR_ISSUES';
    const JSONBIN_URL = `https://api.jsonbin.io/v3/b/${ISSUE_BIN_ID}`;
    
    let locationMarker = null;
    let currentLocationHandler = null;
    let reportMarkers = [];

    // Initialize map with Mutare coordinates
    const map = L.map('map').setView([-18.9667, 32.6333], 13);

    // Add OpenStreetMap base layer
    L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
        attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
    }).addTo(map);

    // Add beeping marker CSS
    const style = document.createElement('style');
    style.textContent = `
        @keyframes beep {
            0% { transform: scale(1); opacity: 1; }
            50% { transform: scale(1.2); opacity: 0.7; }
            100% { transform: scale(1); opacity: 1; }
        }
        .beeping-marker {
            background: red;
            width: 20px;
            height: 20px;
            border-radius: 50%;
            animation: beep 1s infinite;
            box-shadow: 0 0 0 0 rgba(255, 0, 0, 1);
        }
    `;
    document.head.appendChild(style);

    // Global references to our layers
    let nodesLayer, pipesLayer;

    // Initialize the map with our data
    function initializeMap() {
        // Clear existing layers if any
        if (nodesLayer) map.removeLayer(nodesLayer);
        if (pipesLayer) map.removeLayer(pipesLayer);

        // Process and display nodes
        nodesLayer = L.geoJSON(json_harare_nodes2_2, {
            pointToLayer: function(feature, latlng) {
                return L.circleMarker(latlng, {
                    radius: 5,
                    fillColor: getNodeColor(feature.properties.node_type),
                    color: '#000',
                    weight: 1,
                    opacity: 1,
                    fillOpacity: 0.8
                });
            },
            onEachFeature: onEachFeature
        }).addTo(map);

        // Process and display pipes
        pipesLayer = L.geoJSON(json_harare_pipes_1, {
            style: function(feature) {
                return {
                    color: getPipeColor(feature.properties.diameter),
                    weight: getPipeWidth(feature.properties.diameter),
                    opacity: 1
                };
            },
            onEachFeature: onEachFeature
        }).addTo(map);

        // Update statistics
        updateNetworkStats();

        // Fit map to show all data
        const featureGroup = L.featureGroup([nodesLayer, pipesLayer]);
        map.fitBounds(featureGroup.getBounds());

        // Load existing reports
        fetchAndDisplayReports();
    }

    // Fetch and display reports from JSONBin
    async function fetchAndDisplayReports() {
        try {
            const response = await fetch(`${JSONBIN_URL}/latest`, {
                headers: {
                    'X-Master-Key': JSONBIN_API_KEY
                }
            });
            
            if (!response.ok) throw new Error('Failed to fetch reports');
            
            const data = await response.json();
            const reports = data.record?.reports || [];

            // Clear existing report markers
            reportMarkers.forEach(marker => map.removeLayer(marker));
            reportMarkers = [];

            // Add new markers
            reports.forEach(report => {
                if (report.location?.coordinates) {
                    const marker = createBeepingMarker(report);
                    marker.addTo(map);
                    reportMarkers.push(marker);
                }
            });

        } catch (error) {
            console.error('Error loading reports:', error);
        }
    }

    // Create animated beeping marker
    function createBeepingMarker(report) {
        return L.marker(
            [report.location.coordinates[1], report.location.coordinates[0]],
            {
                icon: L.divIcon({
                    className: 'beeping-marker',
                    iconSize: [20, 20],
                    iconAnchor: [10, 10]
                })
            }
        ).bindPopup(`
            <strong>${report.type.toUpperCase()} REPORT</strong><br>
            ${report.description}<br>
            <small>Reported: ${new Date(report.timestamps.reported).toLocaleString()}</small>
        `);
    }

    // ... [Keep all previous functions from previous version until showIssueReportForm]

    // Modified showIssueReportForm with success handler
    async function showIssueReportForm() {
        // ... [Keep previous form setup code]

        // Handle form submission
        document.getElementById('issue-report-form').addEventListener('submit', async function(event) {
            event.preventDefault();
            
            const submitBtn = document.getElementById('submit-issue');
            const statusEl = document.getElementById('issue-status');
            
            submitBtn.disabled = true;
            statusEl.textContent = 'Submitting report...';
            statusEl.style.color = 'blue';
            
            try {
                // ... [Keep previous validation and data preparation]

                // Submit to JSONBin.io
                const response = await fetch(JSONBIN_URL, {
                    method: 'PUT',
                    headers: {
                        'Content-Type': 'application/json',
                        'X-Master-Key': JSONBIN_API_KEY
                    },
                    body: JSON.stringify({
                        reports: [...(await getExistingReports()), newReport]
                    })
                });

                if (!response.ok) {
                    throw new Error('Failed to submit report');
                }

                statusEl.textContent = 'Report submitted successfully!';
                statusEl.style.color = 'green';
                
                // Refresh markers and reset form
                await fetchAndDisplayReports();
                setTimeout(() => {
                    panel.innerHTML = '<h4>Thank you for your report</h4><p>Our team will investigate this issue shortly.</p>';
                }, 2000);
                
            } catch (error) {
                console.error('Error reporting issue:', error);
                statusEl.textContent = error.message || 'Error submitting report. Please try again.';
                statusEl.style.color = 'red';
                submitBtn.disabled = false;
            }
        });

        // ... [Keep rest of form code]
    }

    // Helper to get existing reports
    async function getExistingReports() {
        const response = await fetch(`${JSONBIN_URL}/latest`, {
            headers: {
                'X-Master-Key': JSONBIN_API_KEY
            }
        });
        const data = await response.json();
        return data.record?.reports || [];
    }

    // ... [Keep remaining functions from previous version]

    // Initialize the application
    initializeMap();
});