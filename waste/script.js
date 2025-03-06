// Initialize variables
let map = null;
let marker = null;
let selectedLocation = null;
let currentAQI = null;

// Groq API Configuration
const GROQ_API_KEY = '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';
const GROQ_API_URL = 'https://api.groq.com/openai/v1/chat/completions';

// AQI API Configuration
const AQI_API_KEY = 'YOUR_AQI_API_KEY'; // Replace with your AQI API key
const AQI_API_URL = 'https://api.waqi.info/feed';

// Theme switching functionality
document.addEventListener('DOMContentLoaded', () => {
    const themeToggle = document.getElementById('themeToggle');
    const themeIcon = themeToggle.querySelector('i');
    const themeText = themeToggle.querySelector('span');

    // Check for saved theme preference
    const savedTheme = localStorage.getItem('theme') || 'light';
    document.documentElement.setAttribute('data-theme', savedTheme);
    updateThemeButton(savedTheme);

    themeToggle.addEventListener('click', () => {
        const currentTheme = document.documentElement.getAttribute('data-theme');
        const newTheme = currentTheme === 'light' ? 'dark' : 'light';
        
        document.documentElement.setAttribute('data-theme', newTheme);
        localStorage.setItem('theme', newTheme);
        updateThemeButton(newTheme);
    });

    function updateThemeButton(theme) {
        if (theme === 'dark') {
            themeIcon.className = 'fas fa-sun';
            themeText.textContent = 'Light Mode';
        } else {
            themeIcon.className = 'fas fa-moon';
            themeText.textContent = 'Dark Mode';
        }
    }
});

// Wait for DOM to be fully loaded
document.addEventListener('DOMContentLoaded', function() {
    // Get DOM elements
    const mapModal = document.getElementById('mapModal');
    const openMapBtn = document.getElementById('openMapBtn');
    const closeModalBtn = document.querySelector('.close-modal');
    const confirmLocationBtn = document.getElementById('confirmLocation');
    const locationInput = document.getElementById('location');
    const locationDetails = document.getElementById('locationDetails');
    const currentLocationBtn = document.getElementById('currentLocationBtn');
    const mapSearchInput = document.getElementById('mapSearchInput');
    const mapSearchSuggestions = document.getElementById('mapSearchSuggestions');
    const wasteForm = document.getElementById('wasteForm');

    // Function to open map modal
    function openMapModal() {
        mapModal.classList.add('active');
        if (!map) {
            initializeMap();
        } else {
            setTimeout(() => {
                map.invalidateSize();
            }, 100);
        }
    }

    // Function to close map modal
    function closeMapModal() {
        mapModal.classList.remove('active');
    }

    // Add click event listeners
    openMapBtn.addEventListener('click', openMapModal);
    locationInput.addEventListener('click', openMapModal);
    closeModalBtn.addEventListener('click', closeMapModal);

    // Close modal when clicking outside
    mapModal.addEventListener('click', function(e) {
        if (e.target === mapModal) {
            closeMapModal();
        }
    });

    // Initialize map
    function initializeMap() {
        try {
            // Create map instance with better default settings
            map = L.map('locationMap', {
                center: [20.5937, 78.9629], // Default center (India)
                zoom: 5,
                minZoom: 2,
                maxZoom: 22,
                zoomControl: false,
                trackResize: true,
                wheelDebounceTime: 40,
                wheelPxPerZoomLevel: 60,
                tap: true,
                bounceAtZoomLimits: true
            });

            // Add tile layers with higher resolution options
            const streetLayer = L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
                attribution: '© OpenStreetMap contributors',
                maxZoom: 22,
                maxNativeZoom: 19,
                tileSize: 256,
                zoomOffset: 0,
                detectRetina: true
            });

            const satelliteLayer = L.tileLayer('https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}', {
                attribution: 'Tiles &copy; Esri',
                maxZoom: 22,
                maxNativeZoom: 19,
                tileSize: 256,
                zoomOffset: 0,
                detectRetina: true
            });

            // Add layers to map
            satelliteLayer.addTo(map);

            // Add layer control
            const baseMaps = {
                "Satellite": satelliteLayer,
                "Streets": streetLayer
            };

            L.control.layers(baseMaps, null, {
                position: 'topright'
            }).addTo(map);

            // Add zoom control
            L.control.zoom({
                position: 'bottomright'
            }).addTo(map);

            // Create marker with better precision
            marker = L.marker([20.5937, 78.9629], {
                draggable: true,
                autoPan: true,
                icon: L.icon({
                    iconUrl: 'https://raw.githubusercontent.com/pointhi/leaflet-color-markers/master/img/marker-icon-2x-green.png',
                    shadowUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-shadow.png',
                    iconSize: [25, 41],
                    iconAnchor: [12, 41],
                    popupAnchor: [1, -34],
                    shadowSize: [41, 41]
                })
            }).addTo(map);

            // Handle marker drag with improved precision
            marker.on('dragend', async function(event) {
                const position = marker.getLatLng();
                await updateSelectedLocation(position.lat, position.lng);
            });

            // Try to get user's location immediately when map is initialized
            if (navigator.geolocation) {
                navigator.geolocation.getCurrentPosition(
                    async function(position) {
                        const lat = position.coords.latitude;
                        const lng = position.coords.longitude;
                        const accuracy = position.coords.accuracy;

                        // Set map view with animation
                        map.flyTo([lat, lng], 18, {
                            animate: true,
                            duration: 1
                        });

                        // Update marker position
                        marker.setLatLng([lat, lng]);

                        // Show accuracy circle
                        if (window.accuracyCircle) {
                            map.removeLayer(window.accuracyCircle);
                        }

                        window.accuracyCircle = L.circle([lat, lng], {
                            radius: accuracy,
                            color: '#4ade80',
                            fillColor: '#4ade80',
                            fillOpacity: 0.1,
                            weight: 1
                        }).addTo(map);

                        await updateSelectedLocation(lat, lng, accuracy);
                    },
                    function(error) {
                        console.warn('Error getting initial location:', error);
                    },
                    {
                        enableHighAccuracy: true,
                        timeout: 10000,
                        maximumAge: 0
                    }
                );
            }

            return true;
        } catch (error) {
            console.error('Error initializing map:', error);
            document.getElementById('locationMap').innerHTML = `
                <div class="map-error">
                    <p>Error loading map. Please try again.</p>
                    <button onclick="initializeMap()" class="retry-btn">Retry</button>
                </div>
            `;
            return false;
        }
    }

    // Enhanced getCurrentPosition function with better accuracy
    function getCurrentPositionPrecise() {
        return new Promise((resolve, reject) => {
            if (!navigator.geolocation) {
                reject(new Error('Geolocation is not supported by your browser'));
                return;
            }

            // Options for high accuracy
            const options = {
                enableHighAccuracy: true,
                timeout: 10000,
                maximumAge: 0
            };

            // Try to get position multiple times to improve accuracy
            let attempts = 0;
            const maxAttempts = 3;
            let bestAccuracy = Infinity;
            let bestPosition = null;

            function tryGetPosition() {
                navigator.geolocation.getCurrentPosition(
                    function(position) {
                        attempts++;
                        
                        // Check if this position is more accurate
                        if (position.coords.accuracy < bestAccuracy) {
                            bestAccuracy = position.coords.accuracy;
                            bestPosition = position;
                        }

                        if (attempts < maxAttempts && bestAccuracy > 20) {
                            // Try again if accuracy is not good enough
                            setTimeout(tryGetPosition, 1000);
                        } else {
                            resolve(bestPosition);
                        }
                    },
                    function(error) {
                        if (attempts === 0) {
                            reject(error);
                        } else {
                            // Return best position so far if we have one
                            resolve(bestPosition);
                        }
                    },
                    options
                );
            }

            tryGetPosition();
        });
    }

    // Update current location button click handler
    currentLocationBtn.addEventListener('click', async function() {
        try {
            currentLocationBtn.classList.add('loading');
            
            const position = await getCurrentPositionPrecise();
            const lat = position.coords.latitude;
            const lng = position.coords.longitude;
            const accuracy = position.coords.accuracy;

            // Update map view with animation
            map.flyTo([lat, lng], 18, {
                animate: true,
                duration: 1
            });

            // Remove existing accuracy circle
            if (window.accuracyCircle) {
                map.removeLayer(window.accuracyCircle);
            }

            // Add new accuracy circle
            window.accuracyCircle = L.circle([lat, lng], {
                radius: accuracy,
                color: '#4ade80',
                fillColor: '#4ade80',
                fillOpacity: 0.1,
                weight: 1
            }).addTo(map);

            // Update marker
            marker.setLatLng([lat, lng]);

            // Get detailed location info
            await updateSelectedLocation(lat, lng, accuracy);

            showNotification('Location updated successfully', 'success');
        } catch (error) {
            console.error('Error getting current location:', error);
            let errorMessage = 'Unable to get your current location';
            
            if (error.code) {
                switch(error.code) {
                    case error.PERMISSION_DENIED:
                        errorMessage = 'Location access was denied. Please enable location services.';
                        break;
                    case error.POSITION_UNAVAILABLE:
                        errorMessage = 'Location information is unavailable. Please try again.';
                        break;
                    case error.TIMEOUT:
                        errorMessage = 'Location request timed out. Please try again.';
                        break;
                }
            }
            
            showNotification(errorMessage, 'error');
        } finally {
            currentLocationBtn.classList.remove('loading');
        }
    });

    // Handle location search
    mapSearchInput.addEventListener('input', function() {
        clearTimeout(window.searchDebounceTimer);
        const query = this.value.trim();
        
        if (!query) {
            mapSearchSuggestions.style.display = 'none';
            return;
        }
        
        window.searchDebounceTimer = setTimeout(async () => {
            try {
                mapSearchSuggestions.innerHTML = '<div class="loading">Searching...</div>';
                mapSearchSuggestions.style.display = 'block';
                
                const response = await fetch(`https://nominatim.openstreetmap.org/search?format=json&q=${encodeURIComponent(query)}&limit=5`);
                const data = await response.json();
                
                if (data.length > 0) {
                    mapSearchSuggestions.innerHTML = data.map(place => `
                        <div class="location-suggestion" data-lat="${place.lat}" data-lon="${place.lon}">
                            <strong>${place.display_name.split(',')[0]}</strong>
                            <small>${place.display_name}</small>
                        </div>
                    `).join('');
                    
                    // Add click handlers to suggestions
                    document.querySelectorAll('.location-suggestion').forEach(suggestion => {
                        suggestion.addEventListener('click', function() {
                            const lat = parseFloat(this.dataset.lat);
                            const lon = parseFloat(this.dataset.lon);
                            
                            map.setView([lat, lon], 15);
                            marker.setLatLng([lat, lon]);
                            updateSelectedLocation(lat, lon);
                            
                            mapSearchSuggestions.style.display = 'none';
                            mapSearchInput.value = this.querySelector('strong').textContent;
                        });
                    });
                } else {
                    mapSearchSuggestions.innerHTML = '<div class="no-results">No locations found</div>';
                }
            } catch (error) {
                console.error('Error searching location:', error);
                mapSearchSuggestions.innerHTML = '<div class="error">Error searching location</div>';
            }
        }, 300);
    });

    // Handle location confirmation
    confirmLocationBtn.addEventListener('click', function() {
        if (selectedLocation) {
            locationInput.value = selectedLocation.address;
            
            // Format location details with accuracy if available
            const details = [
                `${selectedLocation.lat.toFixed(6)}, ${selectedLocation.lng.toFixed(6)}`
            ];
            
            if (selectedLocation.accuracy) {
                details.push(`Accuracy: ±${Math.round(selectedLocation.accuracy)}m`);
            }
            
            locationDetails.textContent = details.join(' | ');
            closeMapModal();
            
            showNotification('Location confirmed successfully', 'success');
        }
    });

    // Close search suggestions when clicking outside
    document.addEventListener('click', function(e) {
        if (!mapSearchInput?.contains(e.target) && !mapSearchSuggestions?.contains(e.target)) {
            mapSearchSuggestions.style.display = 'none';
        }
    });

    // Handle form submission
    wasteForm.addEventListener('submit', async function(e) {
        e.preventDefault();
        
        const cropType = document.getElementById('cropType').value;
        const wasteQuantity = document.getElementById('wasteQuantity').value;
        
        if (!cropType || !wasteQuantity || !selectedLocation) {
            let errorMessage = 'Please provide the following:';
            if (!cropType) errorMessage += '\n- Crop type';
            if (!wasteQuantity) errorMessage += '\n- Waste quantity';
            if (!selectedLocation) errorMessage += '\n- Location';
            
            showNotification(errorMessage, 'error');
            return;
        }

        try {
            // Show loading state
            const recommendationsContainer = document.querySelector('.recommendations-container');
            recommendationsContainer.innerHTML = `
                <div class="loading-container">
                    <div class="loading-spinner"></div>
                    <p>Analyzing ${cropType} waste characteristics...</p>
                </div>
            `;

            // Fetch current AQI
            await fetchCurrentAQI(selectedLocation.lat, selectedLocation.lng);

            // Get AI recommendations
            const recommendations = await getGroqRecommendations(cropType, wasteQuantity, selectedLocation);
            
            if (!recommendations) {
                throw new Error('Failed to generate recommendations');
            }

            // Display recommendations
            displayRecommendations(recommendations, cropType, wasteQuantity);
            
            // Update impact metrics
            updateImpactMetrics(recommendations);
            
            showNotification('Recommendations generated successfully!', 'success');
        } catch (error) {
            console.error('Error generating recommendations:', error);
            recommendationsContainer.innerHTML = `
                <div class="error-container">
                    <h3>⚠️ Error Generating Recommendations</h3>
                    <p>We encountered an error while processing your request:</p>
                    <p class="error-message">${error.message}</p>
                    <button onclick="location.reload()" class="retry-btn">Retry</button>
                </div>
            `;
            showNotification('Error generating recommendations. Please try again.', 'error');
        }
    });
});

// Update selected location with improved reverse geocoding
async function updateSelectedLocation(lat, lng, accuracy = null) {
    try {
        // Try OpenStreetMap Nominatim first
        const nominatimResponse = await fetch(
            `https://nominatim.openstreetmap.org/reverse?` +
            `format=json&lat=${lat}&lon=${lng}&zoom=18&addressdetails=1`,
            {
                headers: {
                    'Accept-Language': 'en'
                }
            }
        );
        
        if (!nominatimResponse.ok) {
            throw new Error('Nominatim API error');
        }
        
        const data = await nominatimResponse.json();
        
        // Format address components
        const address = formatAddress(data.address);
        
        selectedLocation = {
            lat: parseFloat(lat),
            lng: parseFloat(lng),
            accuracy: accuracy,
            address: address,
            rawData: data
        };
        
        document.getElementById('confirmLocation').disabled = false;
        
        // Update marker popup with detailed information
        const popupContent = `
            <div class="location-popup">
                <b>${address}</b><br>
                <small>Latitude: ${lat.toFixed(6)}</small><br>
                <small>Longitude: ${lng.toFixed(6)}</small>
                ${accuracy ? `<br><small>Accuracy: ±${Math.round(accuracy)}m</small>` : ''}
            </div>
        `;
        
        marker.bindPopup(popupContent).openPopup();
        
        return selectedLocation;
    } catch (error) {
        console.error('Error in reverse geocoding:', error);
        
        // Fallback to coordinates if geocoding fails
        selectedLocation = {
            lat: parseFloat(lat),
            lng: parseFloat(lng),
            accuracy: accuracy,
            address: `${lat.toFixed(6)}, ${lng.toFixed(6)}`,
            rawData: null
        };
        
        document.getElementById('confirmLocation').disabled = false;
        
        marker.bindPopup(`
            <div class="location-popup">
                <b>Selected Location</b><br>
                <small>Latitude: ${lat.toFixed(6)}</small><br>
                <small>Longitude: ${lng.toFixed(6)}</small>
                ${accuracy ? `<br><small>Accuracy: ±${Math.round(accuracy)}m</small>` : ''}
            </div>
        `).openPopup();
        
        return selectedLocation;
    }
}

// Helper function to format address
function formatAddress(addressData) {
    if (!addressData) return '';
    
    const components = [];
    
    // Add building/house number if available
    if (addressData.house_number) {
        components.push(addressData.house_number);
    }
    
    // Add road/street
    if (addressData.road) {
        components.push(addressData.road);
    }
    
    // Add suburb/neighborhood
    if (addressData.suburb) {
        components.push(addressData.suburb);
    }
    
    // Add city/town
    if (addressData.city || addressData.town || addressData.village) {
        components.push(addressData.city || addressData.town || addressData.village);
    }
    
    // Add state
    if (addressData.state) {
        components.push(addressData.state);
    }
    
    // Add country
    if (addressData.country) {
        components.push(addressData.country);
    }
    
    return components.join(', ');
}

// Helper function to show notifications
function showNotification(message, type = 'info') {
    const notification = document.createElement('div');
    notification.className = `notification ${type}`;
    notification.textContent = message;
    
    document.body.appendChild(notification);
    
    setTimeout(() => {
        notification.classList.add('show');
        setTimeout(() => {
            notification.classList.remove('show');
            setTimeout(() => {
                notification.remove();
            }, 300);
        }, 3000);
    }, 100);
}

// Function to get AI recommendations using Groq
async function getGroqRecommendations(cropType, quantity, location) {
    try {
        const response = await fetch(GROQ_API_URL, {
            method: 'POST',
            headers: {
                'Authorization': `Bearer ${GROQ_API_KEY}`,
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({
                model: 'mixtral-8x7b-32768',
                messages: [
                    {
                        role: 'system',
                        content: `You are an expert agricultural waste management AI system specializing in sustainable alternatives to crop burning. 
Your goal is to provide detailed, crop-specific recommendations for agricultural waste management.

For each crop type, provide recommendations in the following structured format:
{
    "biofuel": {
        "title": "Specific title for biofuel method",
        "description": "Detailed description of the process",
        "processingSteps": [
            "Step 1",
            "Step 2",
            "Step 3",
            "Step 4",
            "Step 5"
        ],
        "equipment": [
            "Equipment 1",
            "Equipment 2",
            "Equipment 3",
            "Equipment 4"
        ],
        "impact": {
            "aqi": number (positive percentage between 0-100),
            "carbon": number (positive tons of CO2 reduction),
            "economic": number (positive USD value)
        }
    },
    "composting": {
        // Same structure as biofuel
    },
    "recycling": {
        // Same structure as biofuel
    }
}

Important: All impact values must be positive numbers:
- AQI improvement: Positive percentage showing air quality improvement
- Carbon reduction: Positive tons of CO2 emissions prevented
- Economic benefit: Positive USD value of savings/earnings

Consider the specific characteristics of each crop type:
- Cotton: High fiber content, suitable for textiles and paper
- Rice: High silica content, requires special processing
- Wheat: High cellulose content, good for paper making
- Sugarcane: High sugar content, good for biofuel
- Corn: High starch content, suitable for bioethanol
- Pulses: High protein content, good for animal feed
- Oilseeds: High oil content, suitable for biodiesel

Provide realistic and practical recommendations based on:
1. Crop-specific waste characteristics
2. Local climate and conditions
3. Available technology and infrastructure
4. Economic feasibility
5. Environmental impact`
                    },
                    {
                        role: 'user',
                        content: `Please provide detailed recommendations for managing ${quantity}kg of ${cropType} waste at location ${location.address} (${location.lat}, ${location.lng}).

Consider the specific characteristics of ${cropType} and provide recommendations in the exact JSON format specified above. Include:
1. Crop-specific processing steps
2. Required equipment
3. Realistic impact metrics (all positive values)
4. Economic benefits
5. Implementation considerations`
                    }
                ],
                temperature: 0.7,
                max_tokens: 2000
            })
        });

        if (!response.ok) {
            throw new Error(`Groq API error: ${response.status}`);
        }

        const data = await response.json();
        const content = data.choices[0].message.content;
        
        // Try to parse the JSON response
        try {
            const jsonMatch = content.match(/\{[\s\S]*\}/);
            if (jsonMatch) {
                const recommendations = JSON.parse(jsonMatch[0]);
                // Validate and ensure positive impact values
                Object.values(recommendations).forEach(method => {
                    method.impact.aqi = Math.max(0, method.impact.aqi);
                    method.impact.carbon = Math.max(0, method.impact.carbon);
                    method.impact.economic = Math.max(0, method.impact.economic);
                });
                return recommendations;
            }
        } catch (error) {
            console.warn('Failed to parse JSON response:', error);
        }

        // Fallback to text parsing if JSON parsing fails
        return parseAIRecommendations(content);
    } catch (error) {
        console.error('Error getting Groq recommendations:', error);
        return null;
    }
}

// Helper function to parse AI response into structured recommendations
function parseAIRecommendations(content) {
    try {
        // Default structure for recommendations
        const recommendations = {
            biofuel: { 
                title: '', 
                description: '', 
                processingSteps: [],
                equipment: [],
                impact: {
                    aqi: 0,
                    carbon: 0,
                    economic: 0
                }
            },
            composting: { 
                title: '', 
                description: '', 
                processingSteps: [],
                equipment: [],
                impact: {
                    aqi: 0,
                    carbon: 0,
                    economic: 0
                }
            },
            recycling: { 
                title: '', 
                description: '', 
                processingSteps: [],
                equipment: [],
                impact: {
                    aqi: 0,
                    carbon: 0,
                    economic: 0
                }
            }
        };

        // Split content into sections and parse
        const sections = content.split('\n\n');
        let currentMethod = null;

        for (const section of sections) {
            if (section.toLowerCase().includes('biofuel')) {
                currentMethod = 'biofuel';
            } else if (section.toLowerCase().includes('compost')) {
                currentMethod = 'composting';
            } else if (section.toLowerCase().includes('recycl')) {
                currentMethod = 'recycling';
            }

            if (currentMethod) {
                const lines = section.split('\n');
                recommendations[currentMethod].title = lines[0].replace(/^[#\-*]\s*/, '');
                
                // Extract description
                const descIndex = lines.findIndex(line => line.toLowerCase().includes('description'));
                if (descIndex !== -1) {
                    recommendations[currentMethod].description = lines[descIndex + 1].trim();
                }

                // Extract processing steps
                const stepsIndex = lines.findIndex(line => line.toLowerCase().includes('processing steps'));
                if (stepsIndex !== -1) {
                    recommendations[currentMethod].processingSteps = lines
                        .slice(stepsIndex + 1)
                        .filter(line => line.trim().match(/^[-*•]\s/))
                        .map(line => line.replace(/^[-*•]\s*/, '').trim());
                }

                // Extract equipment
                const equipIndex = lines.findIndex(line => line.toLowerCase().includes('equipment'));
                if (equipIndex !== -1) {
                    recommendations[currentMethod].equipment = lines
                        .slice(equipIndex + 1)
                        .filter(line => line.trim().match(/^[-*•]\s/))
                        .map(line => line.replace(/^[-*•]\s*/, '').trim());
                }

                // Extract impact metrics with validation
                const impactIndex = lines.findIndex(line => line.toLowerCase().includes('impact'));
                if (impactIndex !== -1) {
                    const impactLines = lines.slice(impactIndex + 1);
                    
                    // Extract AQI improvement with validation
                    const aqiMatch = impactLines.join(' ').match(/aqi[^\d]*(\d+(?:\.\d+)?)/i);
                    recommendations[currentMethod].impact.aqi = aqiMatch ? 
                        Math.max(0, parseFloat(aqiMatch[1])) : 
                        Math.max(0, 20 + Math.random() * 10);

                    // Extract carbon reduction with validation
                    const carbonMatch = impactLines.join(' ').match(/carbon[^\d]*(\d+(?:\.\d+)?)/i);
                    recommendations[currentMethod].impact.carbon = carbonMatch ? 
                        Math.max(0, parseFloat(carbonMatch[1])) : 
                        Math.max(0, 1.5 + Math.random() * 1);

                    // Extract economic benefit with validation
                    const economicMatch = impactLines.join(' ').match(/economic[^\d]*(\d+(?:\.\d+)?)/i);
                    recommendations[currentMethod].impact.economic = economicMatch ? 
                        Math.max(0, parseFloat(economicMatch[1])) : 
                        Math.max(0, 200 + Math.random() * 100);
                }
            }
        }

        return recommendations;
    } catch (error) {
        console.error('Error parsing AI recommendations:', error);
        return null;
    }
}

// Function to display recommendations
function displayRecommendations(recommendations, cropType, quantity) {
    const container = document.querySelector('.recommendations-container');
    
    if (!container) {
        console.error('Recommendations container not found');
        return;
    }

    // Store recommendations data for PDF generation
    container.setAttribute('data-recommendations', JSON.stringify(recommendations));

    container.innerHTML = ''; // Clear previous content

    // Add header section
    const header = document.createElement('div');
    header.className = 'recommendations-header';
    header.innerHTML = `
        <div class="header-content">
            <h2>🌿 Sustainable Waste Management Solutions</h2>
            <div class="waste-summary">
                <p>Analysis for: <strong>${quantity}kg of ${cropType}</strong></p>
                <p class="subtitle">AI-powered recommendations for eco-friendly waste management</p>
            </div>
        </div>
    `;
    container.appendChild(header);

    // Sort recommendations by confidence
    const sortedMethods = Object.entries(recommendations)
        .sort(([, a], [, b]) => (b.impact.economic || 0) - (a.impact.economic || 0));

    // Create recommendations grid
    const recommendationsGrid = document.createElement('div');
    recommendationsGrid.className = 'recommendations-grid';

    // Display each recommendation
    sortedMethods.forEach(([method, data], index) => {
        const card = document.createElement('div');
        card.className = 'recommendation-card';
        
        // Get method-specific icon
        const methodIcon = method === 'biofuel' ? '⚡' : 
                          method === 'composting' ? '🌱' : '♻️';

        card.innerHTML = `
            <div class="recommendation-header">
                <div class="method-icon">${methodIcon}</div>
                <h3>${data.title || `${cropType.charAt(0).toUpperCase() + cropType.slice(1)} ${method.charAt(0).toUpperCase() + method.slice(1)}`}</h3>
            </div>
            
            <div class="recommendation-content">
                <div class="description">
                    <p>${data.description || `Standard ${method} process for ${cropType} waste`}</p>
                </div>

                <div class="processing-section">
                    <h4>🔄 Processing Steps</h4>
                    <ul class="steps-list">
                        ${data.processingSteps.map(step => `<li>${step}</li>`).join('')}
                    </ul>
                </div>

                <div class="equipment-section">
                    <h4>🔧 Required Equipment</h4>
                    <ul class="equipment-list">
                        ${data.equipment.map(item => `<li>${item}</li>`).join('')}
                    </ul>
                </div>

                <div class="impact-section">
                    <h4>💫 Environmental Impact</h4>
                    <div class="impact-metrics">
                        <div class="metric">
                            <span class="metric-label">AQI Improvement</span>
                            <span class="metric-value">${data.impact.aqi.toFixed(1)}%</span>
                        </div>
                        <div class="metric">
                            <span class="metric-label">Carbon Reduction</span>
                            <span class="metric-value">${data.impact.carbon.toFixed(1)} tons</span>
                        </div>
                        <div class="metric">
                            <span class="metric-label">Economic Benefit</span>
                            <span class="metric-value">₹${(data.impact.economic * 83).toLocaleString('en-IN')}</span>
                        </div>
                    </div>
                </div>
            </div>
        `;
        
        recommendationsGrid.appendChild(card);
    });

    container.appendChild(recommendationsGrid);

    // Add summary section
    const summarySection = document.createElement('div');
    summarySection.className = 'recommendations-summary';
    const totalImpact = sortedMethods.reduce((sum, [, data]) => ({
        aqi: sum.aqi + (data.impact?.aqi || 0),
        carbon: sum.carbon + (data.impact?.carbon || 0),
        economic: sum.economic + (data.impact?.economic || 0)
    }), { aqi: 0, carbon: 0, economic: 0 });

    summarySection.innerHTML = `
        <h3>📊 Total Environmental Impact</h3>
        <div class="summary-metrics">
            <div class="summary-metric">
                <span class="metric-icon">🌬️</span>
                <span class="metric-label">AQI Improvement</span>
                <span class="metric-value">${totalImpact.aqi.toFixed(1)}%</span>
            </div>
            <div class="summary-metric">
                <span class="metric-icon">🌍</span>
                <span class="metric-label">Carbon Reduction</span>
                <span class="metric-value">${totalImpact.carbon.toFixed(1)} tons</span>
            </div>
            <div class="summary-metric">
                <span class="metric-icon">💰</span>
                <span class="metric-label">Economic Benefit</span>
                <span class="metric-value">₹${(totalImpact.economic * 83).toLocaleString('en-IN')}</span>
            </div>
        </div>
        <div class="environmental-note">
            <p>✨ By implementing these recommendations, you're contributing to cleaner air and sustainable agriculture.</p>
        </div>
    `;
    container.appendChild(summarySection);
}

// Function to fetch current AQI
async function fetchCurrentAQI(lat, lng) {
    try {
        const response = await fetch(`${AQI_API_URL}/${lat};${lng}/?token=${AQI_API_KEY}`);
        const data = await response.json();
        
        if (data.status === 'ok') {
            // Enhance the AQI data with additional information
            const enhancedData = {
                aqi: data.data.aqi,
                time: new Date(data.data.time.iso),
                station: data.data.city.name,
                isReal: true,
                pollutants: {
                    pm25: data.data.iaqi.pm25?.v,
                    pm10: data.data.iaqi.pm10?.v,
                    o3: data.data.iaqi.o3?.v,
                    no2: data.data.iaqi.no2?.v,
                    so2: data.data.iaqi.so2?.v,
                    co: data.data.iaqi.co?.v
                }
            };
            currentAQI = enhancedData;
            updateAQIDisplay(enhancedData);
            return enhancedData;
        } else {
            throw new Error('Failed to fetch AQI data');
        }
    } catch (error) {
        console.error('Error fetching AQI:', error);
        // Provide fallback data if API fails
        const fallbackData = {
            aqi: 100,
            time: new Date(),
            station: 'Estimated',
            isReal: false,
            pollutants: null
        };
        currentAQI = fallbackData;
        updateAQIDisplay(fallbackData);
        return fallbackData;
    }
}

// Function to update AQI display with enhanced information
function updateAQIDisplay(aqiData) {
    const aqiElement = document.getElementById('currentAqi');
    if (!aqiElement) return;

    const value = Math.round(aqiData.aqi);
    let description = '';
    let color = '';

    // Remove existing color classes
    aqiElement.classList.remove('aqi-good', 'aqi-moderate', 'aqi-unhealthy', 'aqi-very-unhealthy', 'aqi-hazardous');

    // Add appropriate color class and description based on AQI value
    if (value <= 50) {
        aqiElement.classList.add('aqi-good');
        description = 'Good';
        color = '#00e400';
    } else if (value <= 100) {
        aqiElement.classList.add('aqi-moderate');
        description = 'Moderate';
        color = '#ffff00';
    } else if (value <= 150) {
        aqiElement.classList.add('aqi-unhealthy');
        description = 'Unhealthy for Sensitive Groups';
        color = '#ff7e00';
    } else if (value <= 200) {
        aqiElement.classList.add('aqi-very-unhealthy');
        description = 'Unhealthy';
        color = '#ff0000';
    } else {
        aqiElement.classList.add('aqi-hazardous');
        description = 'Hazardous';
        color = '#7e0023';
    }

    const timeString = new Date(aqiData.time).toLocaleString();
    
    aqiElement.innerHTML = `
        <div class="aqi-value" style="color: ${color}">${value}</div>
        <div class="aqi-description">${description}</div>
        <div class="aqi-details">
            <div class="aqi-source">${aqiData.isReal ? 'Real-time data' : 'Estimated data'}</div>
            <div class="aqi-station">Source: ${aqiData.station}</div>
            <div class="aqi-time">Last updated: ${timeString}</div>
        </div>
        ${aqiData.isReal && aqiData.pollutants ? `
        <div class="pollutants-grid">
            ${Object.entries(aqiData.pollutants)
                .filter(([_, value]) => value !== null)
                .map(([key, value]) => `
                    <div class="pollutant-item">
                        <div class="pollutant-name">${key.toUpperCase()}</div>
                        <div class="pollutant-value">${value}</div>
                    </div>
                `).join('')}
        </div>
        ` : ''}
        <div class="aqi-health-tips">
            <h4>Health Recommendations:</h4>
            <ul>
                ${getHealthRecommendations(value).map(tip => `<li>${tip}</li>`).join('')}
            </ul>
        </div>
    `;
}

// Get health recommendations based on AQI value
function getHealthRecommendations(aqi) {
    if (aqi <= 50) {
        return [
            'Air quality is satisfactory',
            'Ideal for outdoor activities'
        ];
    } else if (aqi <= 100) {
        return [
            'Acceptable air quality',
            'Sensitive individuals should limit prolonged outdoor exposure'
        ];
    } else if (aqi <= 150) {
        return [
            'Members of sensitive groups may experience health effects',
            'General public is less likely to be affected',
            'Consider reducing outdoor activities'
        ];
    } else if (aqi <= 200) {
        return [
            'Everyone may begin to experience health effects',
            'Avoid prolonged outdoor exposure',
            'Wear mask when outdoors'
        ];
    } else {
        return [
            'Health alert: everyone may experience serious health effects',
            'Avoid all outdoor activities',
            'Wear N95 mask if outdoors is necessary',
            'Keep windows closed'
        ];
    }
}

// Function to update impact metrics
function updateImpactMetrics(recommendations) {
    const aqiMetric = document.getElementById('aqiMetric');
    const carbonMetric = document.getElementById('carbonMetric');
    const economicMetric = document.getElementById('economicMetric');

    if (!aqiMetric || !carbonMetric || !economicMetric) return;

    // Calculate total impact with validation
    const totalImpact = Object.values(recommendations).reduce((sum, method) => ({
        aqi: sum.aqi + Math.max(0, method.impact?.aqi || 0),
        carbon: sum.carbon + Math.max(0, method.impact?.carbon || 0),
        economic: sum.economic + Math.max(0, method.impact?.economic || 0)
    }), { aqi: 0, carbon: 0, economic: 0 });

    // Update metrics display with positive values
    aqiMetric.textContent = `${totalImpact.aqi.toFixed(1)}%`;
    carbonMetric.textContent = `${totalImpact.carbon.toFixed(1)} tons`;
    economicMetric.textContent = `₹${(totalImpact.economic * 83).toLocaleString('en-IN')}`;

    // Update AQI improvement if we have current AQI
    if (currentAQI !== null) {
        const projectedAQI = currentAQI.aqi * (1 - totalImpact.aqi / 100);
        const improvement = Math.max(0, ((currentAQI.aqi - projectedAQI) / currentAQI.aqi * 100)).toFixed(1);
        aqiMetric.textContent = `${improvement}%`;
    }
}

// Function to generate and download PDF report
async function generatePDFReport() {
    try {
        // Show loading state
        const downloadBtn = document.querySelector('.download-pdf-btn');
        downloadBtn.classList.add('loading');
        downloadBtn.disabled = true;

        // Get the recommendations from the container
        const recommendationsContainer = document.querySelector('.recommendations-container');
        if (!recommendationsContainer.hasChildNodes()) {
            throw new Error('No recommendations available. Please generate recommendations first.');
        }

        // Extract data from the DOM
        const cropType = document.getElementById('cropType').value;
        const quantity = document.getElementById('wasteQuantity').value;
        
        // Get recommendations from the data attribute
        const recommendations = JSON.parse(recommendationsContainer.getAttribute('data-recommendations'));

        const { jsPDF } = window.jspdf;
        const doc = new jsPDF();
        
        // Set document properties
        doc.setProperties({
            title: `Waste Management Report - ${cropType}`,
            subject: 'Agricultural Waste Management Recommendations',
            author: 'EcoFarm Solutions',
            keywords: 'waste management, agriculture, sustainability',
            creator: 'EcoFarm Solutions AI'
        });

        // Add header
        doc.setFontSize(24);
        doc.setTextColor(34, 197, 94); // Green color
        doc.text('EcoFarm Solutions', 105, 20, { align: 'center' });
        
        doc.setFontSize(16);
        doc.setTextColor(31, 41, 55);
        doc.text('Agricultural Waste Management Report', 105, 30, { align: 'center' });

        // Add report details
        doc.setFontSize(12);
        doc.setTextColor(55, 65, 81);
        
        const today = new Date().toLocaleDateString('en-US', { 
            year: 'numeric', 
            month: 'long', 
            day: 'numeric' 
        });
        
        doc.text([
            `Date: ${today}`,
            `Crop Type: ${cropType}`,
            `Waste Quantity: ${quantity} kg`
        ], 20, 45);

        // Add recommendations section
        doc.setFontSize(14);
        doc.setTextColor(31, 41, 55);
        doc.text('AI-Generated Recommendations', 20, 70);

        // Create recommendations table
        const recommendationRows = [];
        Object.entries(recommendations).forEach(([method, data]) => {
            recommendationRows.push([
                data.title,
                data.description,
                `${data.impact.economic.toFixed(1)}%`
            ]);
        });

        doc.autoTable({
            startY: 75,
            head: [['Method', 'Description', 'Economic Impact']],
            body: recommendationRows,
            theme: 'grid',
            headStyles: {
                fillColor: [34, 197, 94],
                textColor: 255,
                fontSize: 12
            },
            styles: {
                fontSize: 10,
                cellPadding: 5
            },
            columnStyles: {
                0: { cellWidth: 50 },
                1: { cellWidth: 100 },
                2: { cellWidth: 30 }
            }
        });

        // Add processing steps
        let currentY = doc.lastAutoTable.finalY + 15;
        
        Object.entries(recommendations).forEach(([method, data]) => {
            if (currentY > 250) {
                doc.addPage();
                currentY = 20;
            }

            doc.setFontSize(12);
            doc.setTextColor(34, 197, 94);
            doc.text(data.title + ' - Processing Steps', 20, currentY);
            
            currentY += 10;
            doc.setFontSize(10);
            doc.setTextColor(55, 65, 81);
            
            data.processingSteps.forEach((step, index) => {
                doc.text(`${index + 1}. ${step}`, 25, currentY);
                currentY += 7;
            });

            currentY += 10;

            // Add equipment list if available
            if (data.equipment && data.equipment.length > 0) {
                doc.setFontSize(12);
                doc.setTextColor(34, 197, 94);
                doc.text('Required Equipment:', 20, currentY);
                
                currentY += 10;
                doc.setFontSize(10);
                doc.setTextColor(55, 65, 81);
                
                data.equipment.forEach((item, index) => {
                    doc.text(`• ${item}`, 25, currentY);
                    currentY += 7;
                });

                currentY += 10;
            }
        });

        // Add environmental impact
        if (currentY > 250) {
            doc.addPage();
            currentY = 20;
        }

        doc.setFontSize(14);
        doc.setTextColor(31, 41, 55);
        doc.text('Environmental Impact Analysis', 20, currentY);
        currentY += 10;

        const impactData = [];
        Object.entries(recommendations).forEach(([method, data]) => {
            impactData.push([
                data.title,
                `${data.impact.aqi}%`,
                `${data.impact.carbon} tons`,
                `₹${(data.impact.economic * 83).toLocaleString('en-IN')}`
            ]);
        });

        doc.autoTable({
            startY: currentY,
            head: [['Method', 'AQI Improvement', 'Carbon Reduction', 'Economic Benefit']],
            body: impactData,
            theme: 'grid',
            headStyles: {
                fillColor: [34, 197, 94],
                textColor: 255,
                fontSize: 12
            },
            styles: {
                fontSize: 10,
                cellPadding: 5
            }
        });

        // Add footer
        const pageCount = doc.internal.getNumberOfPages();
        for (let i = 1; i <= pageCount; i++) {
            doc.setPage(i);
            doc.setFontSize(10);
            doc.setTextColor(156, 163, 175);
            doc.text(
                'Generated by EcoFarm Solutions AI - www.ecofarmsolutions.com',
                105,
                290,
                { align: 'center' }
            );
            doc.text(
                `Page ${i} of ${pageCount}`,
                105,
                285,
                { align: 'center' }
            );
        }

        // Save the PDF
        const fileName = `EcoFarm_Report_${cropType}_${today.replace(/[\s,]+/g, '_')}.pdf`;
        doc.save(fileName);
        
        // Show success message
        showNotification('PDF report generated successfully!', 'success');
        
    } catch (error) {
        console.error('Error generating PDF:', error);
        showNotification('Error generating PDF report. Please try again.', 'error');
    } finally {
        // Reset button state
        const downloadBtn = document.querySelector('.download-pdf-btn');
        downloadBtn.classList.remove('loading');
        downloadBtn.disabled = false;
    }
}

// Add notification styles
const style = document.createElement('style');
style.textContent = `
    .notification {
        position: fixed;
        bottom: 2rem;
        right: 2rem;
        padding: 1rem 2rem;
        border-radius: 8px;
        background: white;
        color: var(--text-color);
        box-shadow: 0 4px 6px rgba(0, 0, 0, 0.1);
        transform: translateY(100%);
        opacity: 0;
        transition: all 0.3s ease;
        z-index: 1000;
        font-weight: 500;
    }

    .notification.show {
        transform: translateY(0);
        opacity: 1;
    }

    .notification.success {
        background: #4ade80;
        color: white;
    }

    .notification.error {
        background: #ef4444;
        color: white;
    }

    .notification.info {
        background: #3b82f6;
        color: white;
    }

    .download-pdf-btn.loading {
        opacity: 0.7;
        cursor: not-allowed;
    }
`;
document.head.appendChild(style); 