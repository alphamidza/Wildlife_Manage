// Main application
document.addEventListener('DOMContentLoaded', function() {
    const JSONBIN_API_KEY = '$2a$10$fxIetOcntbvXWyyeS60RT.lBPh5OCBlpkUbN8Oe.YoQ3loR/0amjm';
    const ISSUE_BIN_ID = '6822d8768561e97a5012d3b5';
    let locationMarker = null;
    let currentLocationHandler = null;
    let dashboardChart = null;

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


    // Add this code inside the DOMContentLoaded event listener, after the existing code

// Function to calculate shortest path by car using OSRM (Open Source Routing Machine)
async function calculateShortestPath(startPoint, endPoint) {
    try {
        // Construct the OSRM API URL
        const osrmUrl = `https://router.project-osrm.org/route/v1/driving/${startPoint.lng},${startPoint.lat};${endPoint.lng},${endPoint.lat}?overview=full`;
        
        const response = await fetch(osrmUrl);
        if (!response.ok) {
            throw new Error('Failed to calculate route');
        }
        
        const data = await response.json();
        
        if (data.code !== 'Ok' || !data.routes || data.routes.length === 0) {
            throw new Error('No route found');
        }
        
        return {
            distance: data.routes[0].distance / 1000, // Convert meters to km
            geometry: data.routes[0].geometry,
            duration: data.routes[0].duration / 60 // Convert seconds to minutes
        };
    } catch (error) {
        console.error('Error calculating route:', error);
        throw error;
    }
}

// Function to decode polyline geometry
function decodePolyline(encoded) {
    const points = [];
    let index = 0, len = encoded.length;
    let lat = 0, lng = 0;
    
    while (index < len) {
        let b, shift = 0, result = 0;
        do {
            b = encoded.charCodeAt(index++) - 63;
            result |= (b & 0x1f) << shift;
            shift += 5;
        } while (b >= 0x20);
        
        const dlat = ((result & 1) ? ~(result >> 1) : (result >> 1));
        lat += dlat;
        
        shift = 0;
        result = 0;
        do {
            b = encoded.charCodeAt(index++) - 63;
            result |= (b & 0x1f) << shift;
            shift += 5;
        } while (b >= 0x20);
        
        const dlng = ((result & 1) ? ~(result >> 1) : (result >> 1));
        lng += dlng;
        
        points.push([lat * 1e-5, lng * 1e-5]);
    }
    
    return points;
}

// Variables to store route state
let startPoint = null;
let endPoint = null;
let routeLayer = null;

// Function to handle shortest path button click
function setupShortestPathCalculation() {
    const panel = document.getElementById('analysis-results');
    panel.innerHTML = `
        <h4>Shortest Path Calculator</h4>
        <div class="path-instructions">
            <p>1. Click on the map to set starting point</p>
            <p>2. Click on another location to set destination</p>
        </div>
        <div class="path-info" id="path-info" style="display: none;">
            <div>Distance: <span id="path-distance">0</span> km</div>
            <div>Estimated Time: <span id="path-duration">0</span> min</div>
        </div>
        <button id="clear-path" class="btn-secondary">Clear Path</button>
        <div id="path-status"></div>
    `;

    const pathInfo = document.getElementById('path-info');
    const pathStatus = document.getElementById('path-status');
    
    // Clear any existing layers and points
    if (routeLayer) {
        map.removeLayer(routeLayer);
        routeLayer = null;
    }
    if (startPoint) {
        map.removeLayer(startPoint);
        startPoint = null;
    }
    if (endPoint) {
        map.removeLayer(endPoint);
        endPoint = null;
    }
    
    let clickCount = 0;
    
    // Handle map clicks for selecting points
    const pathClickHandler = async function(e) {
        if (clickCount === 0) {
            // First click - set start point
            if (startPoint) map.removeLayer(startPoint);
            
            startPoint = L.marker(e.latlng, {
                icon: L.divIcon({
                    className: 'start-marker',
                    html: '<div class="marker-pin start"></div>',
                    iconSize: [30, 42],
                    iconAnchor: [15, 42]
                })
            }).addTo(map);
            
            document.querySelector('.path-instructions p:first-child').textContent = 'Start point set. Click to set destination.';
            clickCount = 1;
        } else {
            // Second click - set end point and calculate route
            if (endPoint) map.removeLayer(endPoint);
            
            endPoint = L.marker(e.latlng, {
                icon: L.divIcon({
                    className: 'end-marker',
                    html: '<div class="marker-pin end"></div>',
                    iconSize: [30, 42],
                    iconAnchor: [15, 42]
                })
            }).addTo(map);
            
            pathStatus.textContent = 'Calculating route...';
            pathStatus.style.color = 'blue';
            
            try {
                // Calculate route
                const route = await calculateShortestPath(
                    startPoint.getLatLng(),
                    endPoint.getLatLng()
                );
                
                // Remove previous route if exists
                if (routeLayer) {
                    map.removeLayer(routeLayer);
                }
                
                // Decode polyline and draw route
                const routeCoordinates = decodePolyline(route.geometry);
                routeLayer = L.polyline(routeCoordinates, {
                    color: '#F44336',
                    weight: 5,
                    opacity: 0.7,
                    dashArray: '10, 10'
                }).addTo(map);
                
                // Fit map to show the route
                map.fitBounds(routeLayer.getBounds());
                
                // Update UI with route info
                document.getElementById('path-distance').textContent = route.distance.toFixed(2);
                document.getElementById('path-duration').textContent = Math.round(route.duration);
                pathInfo.style.display = 'block';
                
                pathStatus.textContent = 'Route calculated successfully';
                pathStatus.style.color = 'green';
                
                // Reset for new route calculation
                clickCount = 0;
                document.querySelector('.path-instructions p:first-child').textContent = '1. Click on the map to set starting point';
                document.querySelector('.path-instructions p:last-child').textContent = '2. Click on another location to set destination';
                
            } catch (error) {
                console.error('Route calculation error:', error);
                pathStatus.textContent = 'Error calculating route: ' + error.message;
                pathStatus.style.color = 'red';
                clickCount = 0;
            }
        }
    };
    
    // Add click handler
    map.on('click', pathClickHandler);
    
    // Handle clear path button
    document.getElementById('clear-path').addEventListener('click', function() {
        if (routeLayer) {
            map.removeLayer(routeLayer);
            routeLayer = null;
        }
        if (startPoint) {
            map.removeLayer(startPoint);
            startPoint = null;
        }
        if (endPoint) {
            map.removeLayer(endPoint);
            endPoint = null;
        }
        
        pathInfo.style.display = 'none';
        pathStatus.textContent = '';
        clickCount = 0;
        
        document.querySelector('.path-instructions p:first-child').textContent = '1. Click on the map to set starting point';
        document.querySelector('.path-instructions p:last-child').textContent = '2. Click on another location to set destination';
    });
    
    // Clean up when panel is closed
    panel.addEventListener('panel-close', function() {
        map.off('click', pathClickHandler);
        if (routeLayer) map.removeLayer(routeLayer);
        if (startPoint) map.removeLayer(startPoint);
        if (endPoint) map.removeLayer(endPoint);
    });
}

// Add event listener for the "Shortest path" button
document.getElementById('shortest-path').addEventListener('click', setupShortestPathCalculation);





// ---- VALVE ISOLATION ANALYSIS ----
// Add this code inside your DOMContentLoaded event listener, after all your other functions

function handleValveIsolation() {
    const panel = document.getElementById('analysis-results');
    panel.innerHTML = `
        <h4>Valve Isolation Analysis</h4>
        <p><b>Step 1:</b> Click on a pipe on the map to select it for isolation analysis.</p>
        <div id="valve-iso-details"></div>
        <button id="clear-valve-iso" class="btn-secondary" style="margin-top:10px;">Clear Selection</button>
    `;

    let highlightPipe = null;
    let highlightValves = [];

    // Handler for pipe selection
    function onPipeClick(e) {
        // Remove previous highlight
        if (highlightPipe) {
            pipesLayer.resetStyle(highlightPipe);
            highlightPipe = null;
        }
        highlightValves.forEach(marker => map.removeLayer(marker));
        highlightValves = [];

        const layer = e.target;
        highlightPipe = layer;
        layer.setStyle({ color: "#FFD700", weight: 8, opacity: 1 });
        const pipe = layer.feature;
        const startId = pipe.properties.start_node;
        const endId = pipe.properties.end_node_n;

        // Confirmation logs:
console.log("Clicked pipe feature:", pipe);
console.log("Start Node ID:", startId);
console.log("End Node ID:", endId);

        // Find all valve nodes
        const valveNodes = json_harare_nodes2_2.features.filter(
            n => n.properties.node_id && n.properties.p_name.toLowerCase() === "valve"
        );
        // Find valve nodes connected to this pipe
        const connectedValves = valveNodes.filter(
            n => n.properties.node_id === startId || n.properties.node_id === endId
        );

        // Find all pipes connected to each valve node
        const connectedPipesPerValve = {};
        connectedValves.forEach(valve => {
            connectedPipesPerValve[valve.properties.node_id] = json_harare_pipes_1.features.filter(
                p => p.properties.start_node === valve.properties.node_id || p.properties.end_node === valve.properties.node_id
            );
        });

        // Mark valves on map
        connectedValves.forEach(valve => {
            const coords = valve.geometry.coordinates;
            const marker = L.circleMarker([coords[1], coords[0]], {
                radius: 10, fillColor: "#FF0000", color: "#fff", weight: 3, fillOpacity: 1
            }).addTo(map);
            marker.bindTooltip(`Valve Node: ${valve.properties.node_id}`, {permanent: false});
            highlightValves.push(marker);
        });

        // Display details in panel
        document.getElementById('valve-iso-details').innerHTML = `
            <div>
                <b>Pipe ID:</b> ${pipe.id || pipe.properties.pipe_id || pipe.properties.line_id || "Unknown"}
                <br><b>Connected Valve Nodes:</b> ${connectedValves.length ? connectedValves.map(v => v.properties.node_id).join(", ") : "None"}
            </div>
            <div style="margin-top:10px;">
                <b>Isolation Steps:</b>
                <ul>
                    <li>Close the connected valve${connectedValves.length > 1 ? "s" : ""} shown in <span style="color:#FF0000;">red</span> on the map.</li>
                    <li>This will isolate the selected pipe segment for maintenance or emergency.</li>
                    <li>Other pipes connected to these valves:<br>
                        ${
                            connectedValves.length
                                ? connectedValves.map(valve =>
                                    `<b>Valve ${valve.properties.node_id}:</b> ${
                                        connectedPipesPerValve[valve.properties.node_id]
                                            .filter(p => (p.id || p.properties.pipe_id || p.properties.line_id) !== (pipe.id || pipe.properties.pipe_id || pipe.properties.line_id))
                                            .map(p => p.id || p.properties.pipe_id || p.properties.line_id).join(", ") || "None"
                                    }`
                                ).join("<br>")
                                : "N/A"
                        }
                    </li>
                </ul>
            </div>
        `;
    }

    // Enable click on pipes for isolation analysis
    pipesLayer.eachLayer(function(layer) {
        layer.on('click', onPipeClick);
        layer.setStyle({ cursor: "pointer" });
    });

    // Clear handler
    document.getElementById('clear-valve-iso').onclick = function() {
        if (highlightPipe) {
            pipesLayer.resetStyle(highlightPipe);
            highlightPipe = null;
        }
        highlightValves.forEach(marker => map.removeLayer(marker));
        highlightValves = [];
        document.getElementById('valve-iso-details').innerHTML = '';
    };

    // Optional: remove handler when panel is replaced
    // (You can implement a more robust panel manager if you want.)
}

// Attach to the Valve Isolation button (ensure your HTML button has id="isolate-valves")
document.getElementById('isolate-valves').addEventListener('click', handleValveIsolation);






// ---- CRITICAL PIPES DASHBOARD ----
function displayCriticalPipesDashboard() {
    const panel = document.getElementById('analysis-results');
    // Map node_id => node feature for fast lookup
    const nodeMap = {};
    json_harare_nodes2_2.features.forEach(node => {
        nodeMap[node.properties.start_node_name] = node;
    });

    
    // Build dashboard stats and severity
    const pipeData = json_harare_pipes_1.features.map((pipe) => {
        const startNode = nodeMap[pipe.properties.start_node];
        const endNode = nodeMap[pipe.properties.end_node_n];
        // Calculate average pressure and head, handle missing nodes
        const pressures = [startNode?.properties.pressure, endNode?.properties.pressure].map(Number).filter(v => !isNaN(v));
        const heads = [startNode?.properties.head, endNode?.properties.head].map(Number).filter(v => !isNaN(v));
        const avgPressure = pressures.length ? (pressures.reduce((a,b) => a+b,0)/pressures.length) : 0;
        const avgHead = heads.length ? (heads.reduce((a,b) => a+b,0)/heads.length) : 0;

 // Log to confirm start/end nodes are being found
     
 console.log('  Start Node:', startNode ? startNode.properties.node_id : null, 'Pressure:', startNode ? startNode.properties.pressure : null, 'Head:', startNode ? startNode.properties.head : null);
 console.log('  End Node:', endNode ? endNode.properties.node_id : null, 'Pressure:', endNode ? endNode.properties.pressure : null, 'Head:', endNode ? endNode.properties.head : null)

        // Custom severity logic (edit as needed for your context)
        // High: pressure > 50 or head > 30
        // Medium: pressure > 30 or head > 20
        // Low: otherwise
        let severity = 'Low';
        if (avgPressure > 31 || avgHead > 142) severity = 'High';
        else if (avgPressure > 30 || avgHead > 20) severity = 'Medium';

        return {
            id: pipe.id || pipe.properties.line_id || 'Unknown',
            status: pipe.properties.Status || 'Unknown',
            flow_rate: pipe.properties.flow_rate || 0,
            roughness: pipe.properties.roughness || 0,
            avgPressure: avgPressure,
            avgHead: avgHead,
            severity
        };
    });

    // Stats
    const severityCounts = { High: 0, Medium: 0, Low: 0 };
    const statusCounts = {};
    let flowSum = 0, flowCount = 0, roughSum = 0, roughCount = 0;
    pipeData.forEach(pipe => {
        severityCounts[pipe.severity] = (severityCounts[pipe.severity] || 0) + 1;
        statusCounts[pipe.status] = (statusCounts[pipe.status] || 0) + 1;
        if (!isNaN(pipe.flow_rate)) { flowSum += Number(pipe.flow_rate); flowCount++; }
        if (!isNaN(pipe.roughness)) { roughSum += Number(pipe.roughness); roughCount++; }
    });
    const avgFlowRate = flowCount ? (flowSum/flowCount).toFixed(2) : 'N/A';
    const avgRoughness = roughCount ? (roughSum/roughCount).toFixed(2) : 'N/A';

    // Top 10 most severe pipes for table
    const severePipes = [...pipeData].sort((a, b) => {
        const sevRank = { High: 2, Medium: 1, Low: 0 };
        if (sevRank[b.severity] !== sevRank[a.severity]) return sevRank[b.severity] - sevRank[a.severity];
        return (b.avgPressure + b.avgHead) - (a.avgPressure + a.avgHead);
    }).slice(0, 10);

    // Dashboard HTML
    panel.innerHTML = `
        <h4>Critical Pipes Dashboard</h4>
        <div><strong>Total Pipes:</strong> ${pipeData.length}</div>
        <div><strong>Average Flow Rate:</strong> ${avgFlowRate} m³/h</div>
        <div><strong>Average Roughness:</strong> ${avgRoughness}</div>
        <div style="display:flex;gap:20px;flex-wrap:wrap;">
            <div style="flex:1;min-width:250px;">
                <canvas id="severityChart"></canvas>
            </div>
            <div style="flex:1;min-width:250px;">
                <canvas id="statusChart"></canvas>
            </div>
        </div>
        <div style="margin-top:1.5em;">
            <h5>Top 10 Most Severe Pipes</h5>
            <table border="1" style="width:100%;font-size:0.93em;">
                <thead>
                    <tr>
                        <th>Pipe ID</th>
                        <th>Status</th>
                        <th>Severity</th>
                        <th>Avg. Pressure</th>
                        <th>Avg. Head</th>
                        <th>Flow Rate</th>
                        <th>Roughness</th>
                    </tr>
                </thead>
                <tbody>
                    ${severePipes.map(pipe => `
                        <tr>
                            <td>${pipe.id}</td>
                            <td>${pipe.status}</td>
                            <td>${pipe.severity}</td>
                            <td>${pipe.avgPressure.toFixed(1)}</td>
                            <td>${pipe.avgHead.toFixed(1)}</td>
                            <td>${pipe.flow_rate}</td>
                            <td>${pipe.roughness}</td>
                        </tr>
                    `).join('')}
                </tbody>
            </table>
        </div>
    `;

    // CHARTS
    setTimeout(() => {
        // Severity bar
        if (dashboardChart) dashboardChart.destroy();
        const ctx1 = document.getElementById('severityChart').getContext('2d');
        dashboardChart = new Chart(ctx1, {
            type: 'bar',
            data: {
                labels: Object.keys(severityCounts),
                datasets: [{
                    label: 'Number of Pipes',
                    data: Object.values(severityCounts),
                    backgroundColor: ['#e74c3c', '#f1c40f', '#2ecc71']
                }]
            },
            options: {
                plugins: { legend: { display: false } },
                scales: {
                    y: { beginAtZero: true, title: { display: true, text: 'Number of Pipes' } },
                    x: { title: { display: true, text: 'Severity Level' } }
                }
            }
        });
        // Status pie
        const ctx2 = document.getElementById('statusChart').getContext('2d');
        new Chart(ctx2, {
            type: 'pie',
            data: {
                labels: Object.keys(statusCounts),
                datasets: [{
                    label: 'Pipe Status',
                    data: Object.values(statusCounts),
                    backgroundColor: ['#3498db', '#e67e22', '#95a5a6', '#9b59b6', '#34495e']
                }]
            }
        });
    }, 200);
}
document.getElementById('critical-pipes').addEventListener('click', displayCriticalPipesDashboard);

// ---- INIT ----
initializeMap();

// ---- OPTIONAL CSS FOR MARKERS/CHARTS ----
const style = document.createElement('style');
style.textContent = `
.start-marker .marker-pin.start { background-color: #4CAF50; }
.end-marker .marker-pin.end { background-color: #F44336; }
.path-info { margin: 15px 0; padding: 10px; background-color: #f5f5f5; border-radius: 4px; }
.path-info div { margin: 5px 0; font-weight: bold; }
.issue-marker .marker-pin { background: #e74c3c; border-radius: 50%; width: 24px; height:24px; border:2px solid #fff;}
`;
document.head.appendChild(style);
});