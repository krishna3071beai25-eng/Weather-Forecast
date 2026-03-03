const API_KEY = 'ddacc8c36bb5bbee4618aca8cfd35c27'; 
const BASE_URL = 'https://api.openweathermap.org/data/2.5';

// --- State Management ---
const state = {
    unit: 'metric', 
    currentCity: null,
    history: JSON.parse(localStorage.getItem('weatherHistory') || '[]'),
    map: null, 
    chart: null 
};

// --- DOM Elements ---
const ui = {
    searchInput: document.getElementById('search-input'),
    searchBtn: document.getElementById('search-btn'),
    locateBtn: document.getElementById('locate-btn'),
    historyDropdown: document.getElementById('history-dropdown'),
    unitToggle: document.getElementById('unit-toggle'),
    dashboard: document.getElementById('weather-dashboard'),
    loader: document.getElementById('loader'),
    errorMsg: document.getElementById('error-msg'),
    bgContainer: document.getElementById('bg-container')
};

// --- Initialization ---
const init = () => {
    bindEvents();
    renderHistory();
    if (state.history.length > 0) {
        fetchWeather(state.history[0]);
    } else {
        getUserLocation();
    }
};

// --- Event Listeners ---
const bindEvents = () => {
    ui.searchBtn.addEventListener('click', () => { handleSearch(); ui.historyDropdown.classList.add('hidden'); });
    ui.searchInput.addEventListener('keypress', (e) => { if (e.key === 'Enter') { handleSearch(); ui.historyDropdown.classList.add('hidden'); } });
    ui.locateBtn.addEventListener('click', getUserLocation);
    ui.unitToggle.addEventListener('click', toggleUnit);
    
    ui.searchInput.addEventListener('focus', () => {
        if (state.history.length > 0) ui.historyDropdown.classList.remove('hidden');
    });
    document.addEventListener('click', (e) => {
        if (!ui.searchInput.contains(e.target) && !ui.historyDropdown.contains(e.target)) {
            ui.historyDropdown.classList.add('hidden');
        }
    });
    
    setInterval(() => {
        const dateTimeEl = document.getElementById('date-time');
        if (dateTimeEl) {
            dateTimeEl.innerText = new Intl.DateTimeFormat('en-US', {
                weekday: 'long', hour: 'numeric', minute: '2-digit'
            }).format(new Date());
        }
    }, 1000);
};

// --- Custom Animated Icons Mapper ---
const getAnimatedIcon = (iconCode) => {
    const iconMap = {
        '01d': 'clear-day', '01n': 'clear-night',
        '02d': 'partly-cloudy-day', '02n': 'partly-cloudy-night',
        '03d': 'cloudy', '03n': 'cloudy',
        '04d': 'overcast', '04n': 'overcast',
        '09d': 'drizzle', '09n': 'drizzle',
        '10d': 'partly-cloudy-day-rain', '10n': 'partly-cloudy-night-rain',
        '11d': 'thunderstorms', '11n': 'thunderstorms',
        '13d': 'snow', '13n': 'snow',
        '50d': 'mist', '50n': 'mist'
    };
    const fileName = iconMap[iconCode] || 'not-available';
    // Fetches free animated SVGs from the popular Basmilius repository
    return `https://basmilius.github.io/weather-icons/production/fill/all/${fileName}.svg`;
};

// --- Core Functions ---
const handleSearch = () => {
    const query = ui.searchInput.value.trim();
    if (query) { fetchWeather(query); ui.searchInput.blur(); }
};

const toggleUnit = () => {
    state.unit = state.unit === 'metric' ? 'imperial' : 'metric';
    ui.unitToggle.innerHTML = state.unit === 'metric' ? '<strong>°C</strong> | °F' : '°C | <strong>°F</strong>';
    if (state.currentCity) fetchWeather(state.currentCity, false);
};

const getUserLocation = () => {
    showLoader();
    if (!navigator.geolocation) {
        fetchWeather('Mandi Gobindgarh');
        return;
    }
    navigator.geolocation.getCurrentPosition(
        position => fetchWeatherByCoords(position.coords.latitude, position.coords.longitude),
        error => fetchWeather('Mandi Gobindgarh') 
    );
};

const fetchWeather = async (city, updateHistory = true) => {
    showLoader();
    try {
        const geoRes = await fetch(`https://api.openweathermap.org/geo/1.0/direct?q=${city}&limit=1&appid=${API_KEY}`);
        const geoData = await geoRes.json();
        if (!geoData.length) throw new Error("City not found");
        const { lat, lon, name } = geoData[0];
        state.currentCity = name;
        if (updateHistory) saveHistory(name);
        await fetchAllWeatherData(lat, lon, name);
    } catch (err) { showError(err.message); }
};

const fetchWeatherByCoords = async (lat, lon) => {
    try { await fetchAllWeatherData(lat, lon, "Your Location"); } 
    catch (err) { showError("Failed to fetch weather data."); }
};

const fetchAllWeatherData = async (lat, lon, locationName) => {
    try {
        const [current, forecast, aqi] = await Promise.all([
            fetch(`${BASE_URL}/weather?lat=${lat}&lon=${lon}&units=${state.unit}&appid=${API_KEY}`).then(r => r.json()),
            fetch(`${BASE_URL}/forecast?lat=${lat}&lon=${lon}&units=${state.unit}&appid=${API_KEY}`).then(r => r.json()),
            fetch(`${BASE_URL}/air_pollution?lat=${lat}&lon=${lon}&appid=${API_KEY}`).then(r => r.json())
        ]);
        updateUI(current, forecast, aqi, locationName, lat, lon);
    } catch (err) { showError("Error processing weather data."); }
};

// --- UI Updates ---
const updateUI = (current, forecast, aqiData, locationName, lat, lon) => {
    const symbol = state.unit === 'metric' ? '°C' : '°F';
    const speedUnit = state.unit === 'metric' ? 'm/s' : 'mph';

    // Reset animations by cloning the dashboard
    const oldDash = ui.dashboard;
    const newDash = oldDash.cloneNode(true);
    oldDash.parentNode.replaceChild(newDash, oldDash);
    ui.dashboard = newDash; // Update reference

    // Hero Section
    document.getElementById('city-name').innerText = locationName === "Your Location" ? current.name : locationName;
    document.getElementById('temperature').innerText = `${Math.round(current.main.temp)}${symbol}`;
    document.getElementById('description').innerText = current.weather[0].description;
    
    // Applying new Animated SVG
    document.getElementById('weather-icon').src = getAnimatedIcon(current.weather[0].icon);
    
    // Advanced Metrics
    document.getElementById('wind-speed').innerText = `${current.wind.speed} ${speedUnit}`;
    document.getElementById('humidity').innerText = `${current.main.humidity}%`;
    document.getElementById('feels-like').innerText = `${Math.round(current.main.feels_like)}${symbol}`;
    document.getElementById('pressure').innerText = `${current.main.pressure} hPa`;
    document.getElementById('visibility').innerText = `${(current.visibility / 1000).toFixed(1)} km`;
    
    const timeFormat = new Intl.DateTimeFormat('en-US', { hour: 'numeric', minute: '2-digit' });
    document.getElementById('sunrise').innerText = timeFormat.format(new Date(current.sys.sunrise * 1000));
    document.getElementById('sunset').innerText = timeFormat.format(new Date(current.sys.sunset * 1000));
    
    const aqiIndex = aqiData.list[0].main.aqi; 
    const aqiLabels = ['Good', 'Fair', 'Moderate', 'Poor', 'Very Poor'];
    document.getElementById('aqi').innerText = `${aqiLabels[aqiIndex - 1]} (${aqiIndex})`;

    updateBackground(current.weather[0].main);
    renderHourly(forecast.list, symbol);
    renderForecast(forecast.list, symbol, current.main.temp);
    renderChart(forecast.list, symbol);
    renderMap(lat, lon);

    ui.loader.classList.add('hidden');
    ui.errorMsg.classList.add('hidden');
    ui.dashboard.classList.remove('hidden');
};

// --- Hourly Forecast Scroll ---
const renderHourly = (forecastList, symbol) => {
    const container = document.getElementById('hourly-container');
    container.innerHTML = '';
    const next24 = forecastList.slice(0, 8); 
    
    next24.forEach(entry => {
        const time = new Date(entry.dt * 1000).toLocaleTimeString([], { hour: 'numeric' });
        const temp = Math.round(entry.main.temp);
        const iconSrc = getAnimatedIcon(entry.weather[0].icon); // Using animated SVG
        
        container.insertAdjacentHTML('beforeend', `
            <div class="hourly-item">
                <span>${time}</span>
                <img src="${iconSrc}" alt="icon">
                <span>${temp}${symbol}</span>
            </div>
        `);
    });
};

// --- Data Visualization (Chart.js & Leaflet) ---
const renderChart = (forecastList, symbol) => {
    const ctx = document.getElementById('weatherChart').getContext('2d');
    if (state.chart) state.chart.destroy();

    const next24Hours = forecastList.slice(0, 8);
    const labels = next24Hours.map(e => new Date(e.dt * 1000).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }));
    const temps = next24Hours.map(e => Math.round(e.main.temp));
    const rains = next24Hours.map(e => e.rain ? e.rain['3h'] || 0 : 0);

    state.chart = new Chart(ctx, {
        type: 'line',
        data: {
            labels: labels,
            datasets: [
                { label: `Temp (${symbol})`, data: temps, borderColor: '#0a84ff', backgroundColor: 'rgba(10, 132, 255, 0.2)', borderWidth: 3, tension: 0.4, fill: true, yAxisID: 'y' },
                { label: 'Rain (mm)', data: rains, type: 'bar', backgroundColor: 'rgba(94, 92, 230, 0.6)', borderRadius: 4, yAxisID: 'y1' }
            ]
        },
        options: {
            responsive: true, maintainAspectRatio: false, color: '#e0e0e0',
            plugins: { legend: { labels: { color: '#e0e0e0' } } },
            scales: {
                x: { ticks: { color: '#8e8e93' }, grid: { color: 'rgba(255,255,255,0.05)' } },
                y: { type: 'linear', display: true, position: 'left', ticks: { color: '#0a84ff' }, grid: { color: 'rgba(255,255,255,0.05)' } },
                y1: { type: 'linear', display: true, position: 'right', ticks: { color: '#5e5ce6' }, grid: { drawOnChartArea: false }, min: 0 }
            }
        }
    });
};

const renderMap = (lat, lon) => {
    if (state.map) { state.map.flyTo([lat, lon], 10); return; }
    state.map = L.map('weather-map').setView([lat, lon], 10);
    L.tileLayer('https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png', { attribution: '&copy; CartoDB', maxZoom: 19 }).addTo(state.map);
    L.tileLayer(`https://tile.openweathermap.org/map/precipitation_new/{z}/{x}/{y}.png?appid=${API_KEY}`, { opacity: 0.8 }).addTo(state.map);
};

// --- Dark Ambient Glow Backgrounds ---
const updateBackground = (condition) => {
    if (!ui.bgContainer) return;
    let color1, color2;
    switch (condition) {
        case 'Clear': color1 = 'rgba(10, 132, 255, 0.15)'; color2 = 'rgba(48, 209, 88, 0.05)'; break;
        case 'Clouds':
        case 'Mist':
        case 'Fog': color1 = 'rgba(142, 142, 147, 0.15)'; color2 = 'rgba(99, 99, 102, 0.1)'; break;
        case 'Rain':
        case 'Drizzle':
        case 'Thunderstorm': color1 = 'rgba(94, 92, 230, 0.15)'; color2 = 'rgba(10, 132, 255, 0.1)'; break;
        case 'Snow': color1 = 'rgba(100, 210, 255, 0.15)'; color2 = 'rgba(255, 255, 255, 0.05)'; break;
        default: color1 = 'rgba(10, 132, 255, 0.15)'; color2 = 'rgba(48, 209, 88, 0.05)';
    }
    ui.bgContainer.style.backgroundImage = `radial-gradient(circle at 15% 50%, ${color1}, transparent 50%), radial-gradient(circle at 85% 30%, ${color2}, transparent 50%)`;
};

// --- 5-Day Forecast Range Bars ---
const renderForecast = (list, symbol, currentTemp) => {
    const container = document.getElementById('forecast-container');
    container.innerHTML = ''; 
    const dailyData = {};
    
    list.forEach(entry => {
        const date = new Date(entry.dt * 1000);
        const dayName = new Intl.DateTimeFormat('en-US', { weekday: 'short' }).format(date);
        if (!dailyData[dayName]) {
            dailyData[dayName] = { min: entry.main.temp_min, max: entry.main.temp_max, icon: entry.weather[0].icon };
        } else {
            dailyData[dayName].min = Math.min(dailyData[dayName].min, entry.main.temp_min);
            dailyData[dayName].max = Math.max(dailyData[dayName].max, entry.main.temp_max);
        }
    });

    const forecastArray = Object.keys(dailyData).slice(0, 5).map((day, index) => ({
        day: index === 0 ? 'Today' : day, min: Math.round(dailyData[day].min), max: Math.round(dailyData[day].max),
        icon: dailyData[day].icon, current: index === 0 ? Math.round(currentTemp) : undefined 
    }));

    const weekMin = Math.min(...forecastArray.map(d => d.min));
    const weekMax = Math.max(...forecastArray.map(d => d.max));
    const weekRange = weekMax - weekMin || 1; 

    forecastArray.forEach(data => {
        const leftPercent = ((data.min - weekMin) / weekRange) * 100;
        const widthPercent = ((data.max - data.min) / weekRange) * 100;
        const iconSrc = getAnimatedIcon(data.icon); // Using Animated SVG
        let markerHtml = '';
        if (data.current !== undefined) {
            let markerPercent = ((data.current - weekMin) / weekRange) * 100;
            markerPercent = Math.max(0, Math.min(100, markerPercent)); 
            markerHtml = `<div class="current-temp-marker" style="left: ${markerPercent}%;"></div>`;
        }
        container.insertAdjacentHTML('beforeend', `
            <div class="forecast-row">
                <div class="day-name">${data.day}</div>
                <div class="forecast-icon"><img src="${iconSrc}" alt="weather icon"></div>
                <div class="temp-min">${data.min}${symbol}</div>
                <div class="bar-track"><div class="bar-range" style="left: ${leftPercent}%; width: ${widthPercent}%;"></div>${markerHtml}</div>
                <div class="temp-max">${data.max}${symbol}</div>
            </div>
        `);
    });
};

// --- Utilities & Search History ---
const showLoader = () => { ui.dashboard.classList.add('hidden'); ui.errorMsg.classList.add('hidden'); ui.loader.classList.remove('hidden'); };
const showError = (msg) => { ui.loader.classList.add('hidden'); ui.dashboard.classList.add('hidden'); ui.errorMsg.innerText = msg; ui.errorMsg.classList.remove('hidden'); };

const saveHistory = (city) => {
    const updated = [city, ...state.history.filter(c => c.toLowerCase() !== city.toLowerCase())].slice(0, 5);
    state.history = updated; 
    localStorage.setItem('weatherHistory', JSON.stringify(updated));
    renderHistory();
};

const renderHistory = () => {
    ui.historyDropdown.innerHTML = '';
    state.history.forEach(city => {
        const li = document.createElement('li');
        li.innerHTML = `<i class="fas fa-history" style="margin-right: 10px; color: var(--accent);"></i> ${city}`;
        li.addEventListener('click', () => {
            ui.searchInput.value = city;
            ui.historyDropdown.classList.add('hidden');
            fetchWeather(city);
        });
        ui.historyDropdown.appendChild(li);
    });
};

init();