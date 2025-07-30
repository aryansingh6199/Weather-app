const API_KEY = "71a9cdc68407f0284bc178e7adc6d23f";
const unitToggle = document.getElementById("unitToggle");
const unitLabel = document.getElementById("unitLabel");

let unit = localStorage.getItem("unit") || "metric"; 
unitToggle.checked = unit === "imperial";
unitLabel.textContent = unit === "imperial" ? "°F" : "°C";

unitToggle.addEventListener("change", () => {
  unit = unitToggle.checked ? "imperial" : "metric";
  localStorage.setItem("unit", unit);
  unitLabel.textContent = unitToggle.checked ? "°F" : "°C";
  getWeather(); 
});

function updateBackground(condition) {
  const body = document.getElementById("appBody");
  if (condition.includes("rain")) {
    body.style.background = "linear-gradient(to right, #3a6186, #89253e)";
  } else if (condition.includes("cloud")) {
    body.style.background = "linear-gradient(to right, #bdc3c7, #2c3e50)";
  } else if (condition.includes("clear")) {
    body.style.background = "linear-gradient(to right, #56ccf2, #2f80ed)";
  } else if (condition.includes("snow")) {
    body.style.background = "linear-gradient(to right, #e6dada, #274046)";
  } else {
    body.style.background = "#4facfe";
  }
}

function saveSearch(city) {
  let history = JSON.parse(localStorage.getItem("weatherHistory")) || [];
  if (!history.includes(city)) {
    history.unshift(city);
    if (history.length > 5) history.pop();
    localStorage.setItem("weatherHistory", JSON.stringify(history));
  }
  showHistory();
}

function showHistory() {
  const history = JSON.parse(localStorage.getItem("weatherHistory")) || [];
  const historyDiv = document.getElementById("searchHistory");
  historyDiv.innerHTML = '';
  history.forEach(city => {
    const btn = document.createElement("button");
    btn.innerText = city;
    btn.onclick = () => {
      document.getElementById("cityInput").value = city;
      getWeather();
    };
    historyDiv.appendChild(btn);
  });
}

function showMap(lat, lon) {
  const mapDiv = document.getElementById("map");
  mapDiv.style.display = "block";
  mapDiv.innerHTML = `
    <iframe 
      width="100%" 
      height="100%" 
      frameborder="0" 
      src="https://maps.google.com/maps?q=${lat},${lon}&z=10&output=embed">
    </iframe>
  `;
}

async function getAQI(lat, lon) {
  const aqiResponse = await fetch(`https://api.openweathermap.org/data/2.5/air_pollution?lat=${lat}&lon=${lon}&appid=${API_KEY}`);
  const aqiData = await aqiResponse.json();

  if (!aqiData || !aqiData.list || aqiData.list.length === 0) return '';

  const aqi = aqiData.list[0].main.aqi;
  const pm2_5 = aqiData.list[0].components.pm2_5;
  const pm10 = aqiData.list[0].components.pm10;

  const aqiLevels = ['Good 😊', 'Fair 🙂', 'Moderate 😐', 'Poor 😷', 'Very Poor ☠️'];
  const level = aqiLevels[aqi - 1];

  return `
    <p><strong>🌫️ Air Quality:</strong> ${level} (AQI: ${aqi})</p>
    <p>PM2.5: ${pm2_5} µg/m³ | PM10: ${pm10} µg/m³</p>
  `;
}

async function getWeather(lat = null, lon = null) {
  const cityInput = document.getElementById("cityInput");
  const city = cityInput.value.trim();
  const currentDiv = document.getElementById("currentWeather");
  const forecastDiv = document.getElementById("forecast");
  const errorDiv = document.getElementById("error");
  const hourlyDiv = document.getElementById("hourlyForecast");
  const chartCanvas = document.getElementById("tempChart");

  currentDiv.innerHTML = '';
  forecastDiv.innerHTML = '';
  errorDiv.textContent = '';
  hourlyDiv.innerHTML = '';

  let currentResponse, forecastResponse;

  try {
    if (lat && lon) {
      currentResponse = await fetch(`https://api.openweathermap.org/data/2.5/weather?lat=${lat}&lon=${lon}&units=${unit}&appid=${API_KEY}`);
      forecastResponse = await fetch(`https://api.openweathermap.org/data/2.5/forecast?lat=${lat}&lon=${lon}&units=${unit}&appid=${API_KEY}`);
    } else {
      if (!city) {
        errorDiv.textContent = "Please enter a city name.";
        return;
      }
      currentResponse = await fetch(`https://api.openweathermap.org/data/2.5/weather?q=${city}&units=${unit}&appid=${API_KEY}`);
      forecastResponse = await fetch(`https://api.openweathermap.org/data/2.5/forecast?q=${city}&units=${unit}&appid=${API_KEY}`); 
    }

    const currentData = await currentResponse.json();
    const forecastData = await forecastResponse.json();

    if (currentData.cod !== 200 || forecastData.cod !== "200") {
      errorDiv.textContent = "City not found or API error.";
      return;
    }

    const { name, sys, main, weather, wind, coord } = currentData;
    const condition = weather[0].main.toLowerCase();

    updateBackground(condition);
    saveSearch(name);
    showMap(coord.lat, coord.lon);

    const aqiHtml = await getAQI(coord.lat, coord.lon);

    currentDiv.innerHTML = `
      <h3>${name}, ${sys.country}</h3>
      <img src="https://openweathermap.org/img/wn/${weather[0].icon}@2x.png" class="weather-icon" />
      <p><strong>${weather[0].description}</strong></p>
      <p>🌡️ Temp: ${main.temp}°${unit === "imperial" ? "F" : "C"} | Feels: ${main.feels_like}°${unit === "imperial" ? "F" : "C"}</p>
      <p>💧 Humidity: ${main.humidity}% | 🌬️ Wind: ${wind.speed} m/s</p>
      <p>🔽 Pressure: ${main.pressure} hPa</p>
      ${aqiHtml}
      <p>🌅 Sunrise: ${new Date(sys.sunrise * 1000).toLocaleTimeString()}</p>
      <p>🌇 Sunset: ${new Date(sys.sunset * 1000).toLocaleTimeString()}</p>
    `;

    const dailyForecast = {};
    forecastData.list.forEach(item => {
      const date = item.dt_txt.split(' ')[0];
      if (!dailyForecast[date] && item.dt_txt.includes("12:00:00")) {
        dailyForecast[date] = item;
      }
    });

    const labels = [];
    const temps = [];

    for (let date in dailyForecast) {
      const forecast = dailyForecast[date];
      const day = new Date(date).toLocaleDateString('en-US', { weekday: 'short' });
      const icon = forecast.weather[0].icon;
      const temp = forecast.main.temp;
      const desc = forecast.weather[0].main;

      labels.push(day);
      temps.push(temp);

      forecastDiv.innerHTML += `
        <div class="day">
          <h4>${day}</h4>
          <img src="https://openweathermap.org/img/wn/${icon}.png" alt="">
          <p>${desc}</p>
          <p>${temp}°${unit === "imperial" ? "F" : "C"}</p>
        </div>
      `;
    }

    if (window.myChart) window.myChart.destroy();
    const ctx = chartCanvas.getContext('2d');
    window.myChart = new Chart(ctx, {
      type: 'line',
      data: {
        labels,
        datasets: [{
          label: "Temperature (°C)",
          data: temps,
          borderColor: "#fff",
          backgroundColor: "transparent",
          borderWidth: 2,
          pointBackgroundColor: "#fff",
          tension: 0.3
        }]
      },
      options: {
        responsive: true,
        plugins: {
          legend: { labels: { color: "#fff" } }
        },
        scales: {
          x: { ticks: { color: "#fff" } },
          y: { ticks: { color: "#fff" } }
        }
      }
    });

    try {
      const hourlyList = forecastData.list.slice(0, 8); 

      hourlyList.forEach(hour => {
        if (!hour || !hour.main || !hour.weather) return;

        const time = new Date(hour.dt * 1000).toLocaleTimeString([], {
          hour: '2-digit', minute: '2-digit'
        });

        const icon = hour.weather[0].icon;
        const temp = hour.main.temp;
        const desc = hour.weather[0].main;

        hourlyDiv.innerHTML += `
          <div class="hour-block">
            <p>${time}</p>
            <img src="https://openweathermap.org/img/wn/${icon}.png" />
            <p>${temp}°${unit === "imperial" ? "F" : "C"}</p>
            <p>${desc}</p>
          </div>
        `;
      });
    } catch (err) {
      hourlyDiv.innerHTML = `<p style="color:red;">Some data could not be loaded. Try again.</p>`;
      console.error("Hourly forecast error:", err);
    }

  } catch (error) {
    errorDiv.textContent = "Failed to fetch data.";
    console.error(error);
  }
}

window.addEventListener("load", () => {
  showHistory();
  if (navigator.geolocation) {
    navigator.geolocation.getCurrentPosition(
      position => {
        const lat = position.coords.latitude;
        const lon = position.coords.longitude;
        getWeather(lat, lon);
      },
      () => {
        console.warn("Location access denied. Defaulting to manual input.");
      }
    );
  } else {
    console.warn("Geolocation not supported.");
  }
});
async function getWeatherByLocation() {
  if (!navigator.geolocation) {
    alert("Geolocation is not supported by your browser.");
    return;
  }

  navigator.geolocation.getCurrentPosition(async position => {
    const lat = position.coords.latitude;
    const lon = position.coords.longitude;

    const currentDiv = document.getElementById("currentWeather");
    const forecastDiv = document.getElementById("forecast");
    const errorDiv = document.getElementById("error");
    const hourlyDiv = document.getElementById("hourlyForecast");
    const chartCanvas = document.getElementById("tempChart");

    currentDiv.innerHTML = '';
    forecastDiv.innerHTML = '';
    errorDiv.textContent = '';
    hourlyDiv.innerHTML = '';

    try {
      const currentResponse = await fetch(`https://api.openweathermap.org/data/2.5/weather?lat=${lat}&lon=${lon}&units=${unit}&appid=${API_KEY}`);
      const forecastResponse = await fetch(`https://api.openweathermap.org/data/2.5/forecast?lat=${lat}&lon=${lon}&units=${unit}&appid=${API_KEY}`);
      const currentData = await currentResponse.json();
      const forecastData = await forecastResponse.json();

      document.getElementById("cityInput").value = currentData.name;
      getWeather(); // use city name logic
    } catch (error) {
      errorDiv.textContent = "Failed to fetch location weather.";
      console.error(error);
    }
  }, () => {
    alert("Unable to retrieve your location.");
  });
}
