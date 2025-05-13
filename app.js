// Main application
document.addEventListener('DOMContentLoaded', function() {
    const JSONBIN_API_KEY = 'YOUR_JSONBIN_API_KEY';
    const ISSUE_BIN_ID = 'YOUR_BIN_ID_FOR_ISSUES';
    let locationMarker = null;
    let currentLocationHandler = null;

    // Initialize map with Mutare coordinates
    const map = L.map('map').setView([-18.9667, 32.6333], 13);

    // Add OpenStreetMap base layer
    L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
        attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
    }).addTo(map);

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
    }

    // Update network statistics panel
    function updateNetworkStats() {
        document.getElementById('node-count').textContent = json_harare_nodes2_2.features.length;
        document.getElementById('pipe-count').textContent = json_harare_pipes_1.features.length;

        // Calculate average pipe age
        const totalAge = json_harare_pipes_1.features.reduce((sum, feature) => {
            const installYear = feature.properties.installation_year || new Date().getFullYear();
            return sum + (new Date().getFullYear() - installYear);
        }, 0);

        const avgAge = (totalAge / json_harare_pipes_1.features.length).toFixed(1);
        document.getElementById('avg-age').textContent = avgAge;
    }

    // Get color based on node type
    function getNodeColor(nodeType) {
        const colors = {
            'valve': 'red',
            'source': 'green',
            'junction': 'blue',
            'customer': 'purple',
            'default': 'gray'
        };
        return colors[nodeType] || colors['default'];
    }

    // Get color based on pipe diameter
    function getPipeColor(diameter) {
        if (!diameter) return '#cccccc';
        if (diameter < 100) return '#1f77b4';
        if (diameter < 200) return '#ff7f0e';
        if (diameter < 300) return '#2ca02c';
        return '#d62728';
    }

    // Get width based on pipe diameter
    function getPipeWidth(diameter) {
        if (!diameter) return 2;
        return Math.max(1, Math.min(10, diameter / 50));
    }

    // Feature interaction handler
    function onEachFeature(feature, layer) {
        layer.on({
            click: function(e) {
                showFeatureDetails(feature);
            },
            mouseover: function(e) {
                layer.setStyle({
                    weight: (layer.options.weight || 3) * 1.5,
                    opacity: 1
                });
                layer.bringToFront();
            },
            mouseout: function(e) {
                if (feature.geometry.type === 'LineString') {
                    pipesLayer.resetStyle(layer);
                } else {
                    nodesLayer.resetStyle(layer);
                }
            }
        });
    }

    // Show feature details in panel
    function showFeatureDetails(feature) {
        const detailsPanel = document.getElementById('feature-details');
        detailsPanel.innerHTML = `
            <h4>${feature.properties.name || feature.id || 'Unnamed Feature'}</h4>
            <div class="feature-type">Type: ${feature.geometry.type}</div>
        `;

        // Add all properties
        for (const [key, value] of Object.entries(feature.properties)) {
            if (value !== undefined && value !== null) {
                const div = document.createElement('div');
                div.className = 'feature-property';
                div.innerHTML = `<label>${key}:</label> <span>${formatPropertyValue(key, value)}</span>`;
                detailsPanel.appendChild(div);
            }
        }
    }

    // Format property values for display
    function formatPropertyValue(key, value) {
        if (key.toLowerCase().includes('date') || key.toLowerCase().includes('year')) {
            return new Date(value).toLocaleDateString();
        }
        if (typeof value === 'object') return JSON.stringify(value);
        return value;
    }

    // Show issue report form and handle submission
    function showIssueReportForm() {
        // Remove any existing location marker and handler
        if (locationMarker) {
            map.removeLayer(locationMarker);
            locationMarker = null;
        }
        if (currentLocationHandler) {
            map.off('click', currentLocationHandler);
            currentLocationHandler = null;
        }

        const panel = document.getElementById('analysis-results');
        panel.innerHTML = `
            <h4>Report Network Issue</h4>
            <form id="issue-report-form">
                <div class="form-group">
                    <label>Issue Type:</label>
                    <select id="issue-type" required>
                        <option value="">Select issue type</option>
                        <option value="leak">Pipe Leak</option>
                        <option value="break">Pipe Break</option>
                        <option value="valve">Faulty Valve</option>
                        <option value="other">Other</option>
                    </select>
                </div>
                
                <div class="form-group">
                    <label>Location:</label>
                    <div class="location-selection">
                        <input type="text" id="issue-location" placeholder="Click map to select location" readonly required>
                        <button type="button" id="select-location">Select on Map</button>
                    </div>
                    <input type="hidden" id="issue-coordinates">
                    <small class="form-hint">Click the button then click on the map</small>
                </div>
                
                <div class="form-group">
                    <label>Description:</label>
                    <textarea id="issue-description" rows="3" required placeholder="Please describe the issue in detail"></textarea>
                </div>
                
                <div class="form-group">
                    <label>Your Name:</label>
                    <input type="text" id="reporter-name" required>
                </div>
                
                <div class="form-group">
                    <label>Contact Number:</label>
                    <input type="tel" id="reporter-phone" placeholder="+263 77 123 4567">
                </div>
                
                <div class="form-group">
                    <label>Email Address:</label>
                    <input type="email" id="reporter-email" placeholder="optional">
                </div>
                
                <div class="form-actions">
                    <button type="submit" id="submit-issue" class="btn-primary">Submit Report</button>
                    <button type="button" id="cancel-issue" class="btn-secondary">Cancel</button>
                </div>
                
                <div id="issue-status"></div>
            </form>
        `;

        // Handle location selection
        document.getElementById('select-location').addEventListener('click', function() {
            if (currentLocationHandler) {
                map.off('click', currentLocationHandler);
            }
            
            document.getElementById('issue-status').textContent = 'Please click on the map to select the issue location';
            document.getElementById('issue-status').style.color = 'blue';
            
            currentLocationHandler = function(e) {
                // Remove previous marker if exists
                if (locationMarker) {
                    map.removeLayer(locationMarker);
                }
                
                // Add new marker
                locationMarker = L.marker(e.latlng, {
                    icon: L.divIcon({
                        className: 'issue-marker',
                        html: '<div class="marker-pin"></div>',
                        iconSize: [30, 42],
                        iconAnchor: [15, 42]
                    })
                }).addTo(map);
                
                // Update form fields
                document.getElementById('issue-location').value = 
                    `Lat: ${e.latlng.lat.toFixed(6)}, Lng: ${e.latlng.lng.toFixed(6)}`;
                document.getElementById('issue-coordinates').value = 
                    JSON.stringify([e.latlng.lng, e.latlng.lat]);
                
                document.getElementById('issue-status').textContent = 'Location selected';
                document.getElementById('issue-status').style.color = 'green';
                
                // Remove the handler after selection
                map.off('click', currentLocationHandler);
                currentLocationHandler = null;
            };
            
            map.on('click', currentLocationHandler);
        });

        // Handle form submission
        document.getElementById('issue-report-form').addEventListener('submit', async function(event) {
            event.preventDefault();
            
            const submitBtn = document.getElementById('submit-issue');
            const statusEl = document.getElementById('issue-status');
            
            submitBtn.disabled = true;
            statusEl.textContent = 'Submitting report...';
            statusEl.style.color = 'blue';
            
            try {
                // Validate required fields
                if (!document.getElementById('issue-coordinates').value) {
                    throw new Error('Please select a location on the map');
                }
                
                const issueData = {
                    type: document.getElementById('issue-type').value,
                    description: document.getElementById('issue-description').value,
                    location: document.getElementById('issue-location').value,
                    coordinates: JSON.parse(document.getElementById('issue-coordinates').value),
                    reporter: {
                        name: document.getElementById('reporter-name').value,
                        phone: document.getElementById('reporter-phone').value || 'Not provided',
                        email: document.getElementById('reporter-email').value || 'Not provided'
                    },
                    timestamp: new Date().toISOString(),
                    status: 'reported'
                };

                // Submit to JSONBin.io
                const response = await fetch(`https://api.jsonbin.io/v3/b/${ISSUE_BIN_ID}`, {
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/json',
                        'X-Master-Key': JSONBIN_API_KEY,
                        'X-Bin-Name': 'Water Network Issues'
                    },
                    body: JSON.stringify(issueData)
                });

                if (!response.ok) {
                    throw new Error('Failed to submit report');
                }

                statusEl.textContent = 'Report submitted successfully!';
                statusEl.style.color = 'green';
                
                // Reset form after delay
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

        // Handle cancel button
        document.getElementById('cancel-issue').addEventListener('click', function() {
            if (locationMarker) {
                map.removeLayer(locationMarker);
                locationMarker = null;
            }
            if (currentLocationHandler) {
                map.off('click', currentLocationHandler);
                currentLocationHandler = null;
            }
            panel.innerHTML = '<h4>Issue Reporting</h4><p>Report cancelled.</p>';
        });
    }

    // Attach event listener for "Report Issue" button
    document.getElementById('report-issue').addEventListener('click', showIssueReportForm);

    // Initialize the application
    initializeMap();
});