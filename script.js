/**
 * WEATHER RADAR — script.js
 * ─────────────────────────────
 * Utiliza a Open-Meteo para exibir dados climáticos.
 *
 * PENSEI EM USAR DUAS APIs PARA SE COMPLEMENTAREM, QUERIA USAR A "OPENWEATHER"
 * MAS ELA NÃO FUNCIONOU LEGAL
 * 
 * APIs utilizadas:
 * - Open-Meteo Geocoding API: converte o nome da cidade em latitude e longitude.
 * - Open-Meteo Forecast API: busca os dados climáticos atuais com base nas coordenadas.
 *
 * Funcionalidades: busca por cidade, geolocalização, histórico (localStorage),
 * medidor de tempo desde a última atualização e mudança dinâmica de gradiente
 * conforme a condição climática.
 * 
 * OBS: Não tem chave de API :) 
 */

//Configuração

const API_BASE = 'https://geocoding-api.open-meteo.com/v1/search';
const WEATHER_BASE = 'https://api.open-meteo.com/v1/forecast';
const HISTORY_KEY = 'weather_history';
const MAX_HISTORY = 5;

//Referências ao DOM

const cityInput    = document.getElementById('cityInput');
const searchBtn    = document.getElementById('searchBtn');
const locationBtn  = document.getElementById('locationBtn');
const historyBar   = document.getElementById('historyBar');
const loader       = document.getElementById('loader');
const errorCard    = document.getElementById('errorCard');
const errorMessage = document.getElementById('errorMessage');
const weatherMain  = document.getElementById('weatherMain');
const emptyState   = document.getElementById('emptyState');
const bgLayer      = document.getElementById('bgLayer');

// Campos de resultado
const cityNameEl     = document.getElementById('cityName');
const countryNameEl  = document.getElementById('countryName');
const queryTimeEl    = document.getElementById('queryTime');
const conditionLabel = document.getElementById('conditionLabel');
const weatherIcon    = document.getElementById('weatherIcon');
const tempNumEl      = document.getElementById('tempNum');
const feelsLikeEl    = document.getElementById('feelsLike');
const humidityEl     = document.getElementById('humidity');
const windSpeedEl    = document.getElementById('windSpeed');
const cloudsEl       = document.getElementById('clouds');
const pressureEl     = document.getElementById('pressure');
const timeCounterEl = document.getElementById('timeCounter');

let timerInterval = null;
let secondsElapsed = 0;

//Eventos
searchBtn.addEventListener('click', handleSearch);
cityInput.addEventListener('keydown', (e) => {
  if (e.key === 'Enter') handleSearch();
});

locationBtn.addEventListener('click', handleGeolocation);

//Inicialização
renderHistory();

//Funções principais
function handleSearch() {
  const city = cityInput.value.trim();
  if (!city) return;
  fetchWeatherByCity(city);
}

function handleGeolocation() {
  if (!navigator.geolocation) {
    showError('Geolocalização não é suportada neste navegador.');
    return;
  }

  showLoader();

  navigator.geolocation.getCurrentPosition(
    (position) => {
      const { latitude, longitude } = position.coords;
      fetchWeatherByCoords(latitude, longitude);
    },
    (err) => {
      hideLoader();
      showError('Não foi possível obter sua localização. Verifique as permissões do navegador.');
    }
  );
}

/**
 * Busca dados climáticos pelo nome da cidade.
 * @param {string} city
 */
async function fetchWeatherByCity(city) {
  showLoader();

  try {
    const geoResponse = await fetch(
      `${API_BASE}?name=${encodeURIComponent(city)}&count=1&language=pt&format=json`
    );

    const geoData = await geoResponse.json();

    if (!geoData.results || geoData.results.length === 0) {
      showError('Cidade não encontrada.');
      return;
    }

    const location = geoData.results[0];

    await fetchWeatherByCoords(
      location.latitude,
      location.longitude,
      location.name,
      location.country
    );

  } catch (err) {
    showError('Erro ao localizar cidade.');
  }
}

/**
 * Busca dados climáticos por coordenadas geográficas.
 * @param {number} lat
 * @param {number} lon
 */
async function fetchWeatherByCoords(lat, lon, cityName = '', country = '') {

  try {

    const response = await fetch(
      `${WEATHER_BASE}?latitude=${lat}&longitude=${lon}&current=temperature_2m,relative_humidity_2m,apparent_temperature,pressure_msl,cloud_cover,wind_speed_10m,weather_code&timezone=auto`
    );

    const data = await response.json();

    displayWeather({
      name: cityName,
      country: country,
      current: data.current
    });

  } catch (err) {
    showError('Erro ao obter clima.');
  } finally {
    hideLoader();
  }
}

/**
 * Realiza a requisição HTTP e exibe os dados na interface.
 * @param {string} url
 */
async function fetchAndDisplay(url) {
  showLoader();

  try {
    const response = await fetch(url);
    const data = await response.json();

    //Erro para identificar e corrigir
    if (!response.ok) {
      if (response.status === 404) {
        showError('Cidade não encontrada. Verifique o nome e tente novamente.');
      } else if (response.status === 401) {
        showError('Chave de API inválida. Substitua API_KEY no arquivo script.js.');
      } else {
        showError('Não foi possível obter os dados do clima. Tente novamente.');
      }
      return;
    }

    displayWeather(data);

  } catch (err) {
    // Erro de rede ou JSON inválido
    showError('Não foi possível obter os dados do clima. Verifique sua conexão.');
  } finally {
    hideLoader();
  }
}

/**
 * Preenche a interface com os dados retornados pela API.
 * @param {Object} data
 */
function displayWeather(data) {
  const cityName = data.name;
  const country = data.country || '–';

  const current = data.current;

  const temp = Math.round(current.temperature_2m);
  const feelsLike = Math.round(current.apparent_temperature);
  const humidity = current.relative_humidity_2m;
  const windKmh = Math.round(current.wind_speed_10m);
  const clouds = current.cloud_cover;
  const pressure = Math.round(current.pressure_msl);

  const weatherInfo = getWeatherInfo(current.weather_code || 0);
  const condition = weatherInfo.description;
  const icon = weatherInfo.icon;
  const weatherId = weatherInfo.id;
  const iconCode = weatherInfo.iconCode;

  cityNameEl.textContent = cityName;
  countryNameEl.textContent = country;
  queryTimeEl.textContent = formatDateTime(new Date());

  startTimeCounter();

  conditionLabel.textContent = condition;
  weatherIcon.src = icon;
  weatherIcon.alt = condition;

  tempNumEl.textContent = temp;
  feelsLikeEl.textContent = feelsLike;
  humidityEl.textContent = `${humidity}%`;
  windSpeedEl.textContent = `${windKmh} km/h`;
  cloudsEl.textContent = `${clouds}%`;
  pressureEl.textContent = `${pressure} hPa`;

  updateBackground(weatherId, iconCode);

  saveToHistory(cityName);

  showWeatherResult();
}

function getWeatherInfo(code) {
  const map = {
    0: {
      description: 'céu limpo',
      icon: 'https://cdn-icons-png.flaticon.com/512/869/869869.png',
      id: 800,
      iconCode: '01d'
    },
    1: {
      description: 'principalmente limpo',
      icon: 'https://cdn-icons-png.flaticon.com/512/1163/1163661.png',
      id: 801,
      iconCode: '02d'
    },
    2: {
      description: 'parcialmente nublado',
      icon: 'https://cdn-icons-png.flaticon.com/512/1163/1163661.png',
      id: 802,
      iconCode: '03d'
    },
    3: {
      description: 'nublado',
      icon: 'https://cdn-icons-png.flaticon.com/512/414/414927.png',
      id: 804,
      iconCode: '04d'
    },
    45: {
      description: 'neblina',
      icon: 'https://cdn-icons-png.flaticon.com/512/4005/4005901.png',
      id: 701,
      iconCode: '50d'
    },
    48: {
      description: 'neblina com geada',
      icon: 'https://cdn-icons-png.flaticon.com/512/4005/4005901.png',
      id: 741,
      iconCode: '50d'
    },
    51: {
      description: 'garoa leve',
      icon: 'https://cdn-icons-png.flaticon.com/512/3076/3076129.png',
      id: 300,
      iconCode: '09d'
    },
    53: {
      description: 'garoa moderada',
      icon: 'https://cdn-icons-png.flaticon.com/512/3076/3076129.png',
      id: 300,
      iconCode: '09d'
    },
    55: {
      description: 'garoa intensa',
      icon: 'https://cdn-icons-png.flaticon.com/512/3076/3076129.png',
      id: 300,
      iconCode: '09d'
    },
    61: {
      description: 'chuva leve',
      icon: 'https://cdn-icons-png.flaticon.com/512/3351/3351979.png',
      id: 500,
      iconCode: '10d'
    },
    63: {
      description: 'chuva moderada',
      icon: 'https://cdn-icons-png.flaticon.com/512/3351/3351979.png',
      id: 501,
      iconCode: '10d'
    },
    65: {
      description: 'chuva forte',
      icon: 'https://cdn-icons-png.flaticon.com/512/3351/3351979.png',
      id: 502,
      iconCode: '10d'
    },
    71: {
      description: 'neve leve',
      icon: 'https://cdn-icons-png.flaticon.com/512/642/642102.png',
      id: 600,
      iconCode: '13d'
    },
    73: {
      description: 'neve moderada',
      icon: 'https://cdn-icons-png.flaticon.com/512/642/642102.png',
      id: 601,
      iconCode: '13d'
    },
    75: {
      description: 'neve forte',
      icon: 'https://cdn-icons-png.flaticon.com/512/642/642102.png',
      id: 602,
      iconCode: '13d'
    },
    80: {
      description: 'pancadas de chuva leves',
      icon: 'https://cdn-icons-png.flaticon.com/512/3351/3351979.png',
      id: 520,
      iconCode: '09d'
    },
    81: {
      description: 'pancadas de chuva',
      icon: 'https://cdn-icons-png.flaticon.com/512/3351/3351979.png',
      id: 521,
      iconCode: '09d'
    },
    82: {
      description: 'pancadas de chuva fortes',
      icon: 'https://cdn-icons-png.flaticon.com/512/3351/3351979.png',
      id: 522,
      iconCode: '09d'
    },
    95: {
      description: 'tempestade',
      icon: 'https://cdn-icons-png.flaticon.com/512/1146/1146860.png',
      id: 200,
      iconCode: '11d'
    }
  };

  return map[code] || {
    description: 'clima desconhecido',
    icon: 'https://cdn-icons-png.flaticon.com/512/1163/1163661.png',
    id: 800,
    iconCode: '01d'
  };
}

// mostrar/esconder seções

function showLoader() {
  loader.hidden       = false;
  weatherMain.hidden  = true;
  errorCard.hidden    = true;
  emptyState.hidden   = true;
}

function hideLoader() {
  loader.hidden = true;
}

function showError(message) {
  hideLoader();
  errorMessage.textContent = message;
  errorCard.hidden = false;
  weatherMain.hidden = true;
  emptyState.hidden = true;
}

function showWeatherResult() {
  hideLoader();
  weatherMain.hidden = false;
  errorCard.hidden = true;
  emptyState.hidden = true;
}

//Gradiente dinâmico por condição climática

/**
 * @param {number} id       
 * @param {string} iconCode
 */
function updateBackground(id, iconCode) {
  const isNight = iconCode.endsWith('n');

  let gradient;

  if (id >= 200 && id < 300) {
    // Tempestade / Raios
    gradient = 'linear-gradient(135deg, #0a0a18 0%, #1c1240 50%, #2a0a3a 100%)';

  } else if (id >= 300 && id < 400) {
    // Garoa leve
    gradient = 'linear-gradient(135deg, #0f1e34 0%, #1a3052 50%, #253d5e 100%)';

  } else if (id >= 500 && id < 600) {
    // Chuva
    gradient = 'linear-gradient(135deg, #0a1628 0%, #1a2e52 50%, #0e2240 100%)';

  } else if (id >= 600 && id < 700) {
    // Neve
    gradient = 'linear-gradient(135deg, #1a2a4a 0%, #2e4472 50%, #b8cce8 100%)';

  } else if (id >= 700 && id < 800) {
    // Névoa / Neblina / Fumaça
    gradient = 'linear-gradient(135deg, #1a2030 0%, #303a4a 50%, #3a4454 100%)';

  } else if (id === 800) {
    // Céu limpo
    if (isNight) {
      gradient = 'linear-gradient(135deg, #020818 0%, #0d1b40 50%, #1a2a5a 100%)';
    } else {
      gradient = 'linear-gradient(160deg, #1a3a6e 0%, #e8a020 70%, #f06020 100%)';
    }

  } else if (id >= 801 && id < 900) {
    // Parcialmente nublado / nublado
    if (id === 801 || id === 802) {
      // Poucas nuvens — ainda tem sol/lua visível
      gradient = isNight
        ? 'linear-gradient(135deg, #06101e 0%, #162440 50%, #1e3054 100%)'
        : 'linear-gradient(150deg, #1c3258 0%, #3a5e8a 50%, #7cb0d0 100%)';
    } else {
      // Muito nublado
      gradient = 'linear-gradient(135deg, #1c2636 0%, #3a4a5e 50%, #2e3f54 100%)';
    }

  } else {
    gradient = isNight
      ? 'linear-gradient(135deg, #06091a 0%, #0d1b40 100%)'
      : 'linear-gradient(135deg, #1a3a6e 0%, #4a7aae 100%)';
  }

  // Aplica via CSS custom property (a transição está no CSS)
  bgLayer.style.background = gradient;
}

//Histórico (localStorage)

/**
 * Retorna o array de histórico salvo, ou vazio se não existir.
 * @returns {string[]}
 */
function loadHistory() {
  try {
    return JSON.parse(localStorage.getItem(HISTORY_KEY)) || [];
  } catch {
    return [];
  }
}

/**
 * Adiciona uma cidade ao histórico, remove duplicatas e limita ao máximo.
 * @param {string} city
 */
function saveToHistory(city) {
  let history = loadHistory();

  // Remove se já existia (para mover para o início)
  history = history.filter(c => c.toLowerCase() !== city.toLowerCase());
  history.unshift(city);
  history = history.slice(0, MAX_HISTORY);
  localStorage.setItem(HISTORY_KEY, JSON.stringify(history));
  renderHistory();
}

/**
 * Renderiza os chips de histórico na interface.
 */
function renderHistory() {
  const history = loadHistory();
  historyBar.innerHTML = '';

  if (history.length === 0) return;

  // Rótulo "Recentes"
  const label = document.createElement('span');
  label.className = 'history-label';
  label.textContent = 'Recentes:';
  historyBar.appendChild(label);

  // Um chip por cidade
  history.forEach(city => {

  const tag = document.createElement('div');
  tag.className = 'history-tag';

  const cityBtn = document.createElement('span');
  cityBtn.className = 'history-city';
  cityBtn.textContent = city;

  cityBtn.addEventListener('click', () => {
    cityInput.value = city;
    fetchWeatherByCity(city);
  });

  const removeBtn = document.createElement('span');
  removeBtn.className = 'history-remove';
  removeBtn.textContent = '✕';

  removeBtn.addEventListener('click', (e) => {
    e.stopPropagation();

    let history = loadHistory();
    history = history.filter(c => c !== city);

    localStorage.setItem(HISTORY_KEY, JSON.stringify(history));

    renderHistory();
  });

    tag.appendChild(cityBtn);
    tag.appendChild(removeBtn);

    historyBar.appendChild(tag);
    });
}

//Utilitários

/**
 * Formata um objeto Date como "Seg, 08 jun · 14:32".
 * @param {Date} date
 * @returns {string}
 */
function formatDateTime(date) {
  const weekdays = ['Dom', 'Seg', 'Ter', 'Qua', 'Qui', 'Sex', 'Sáb'];
  const months   = ['jan', 'fev', 'mar', 'abr', 'mai', 'jun',
                    'jul', 'ago', 'set', 'out', 'nov', 'dez'];

  const day  = weekdays[date.getDay()];
  const d    = date.getDate();
  const mon  = months[date.getMonth()];
  const h    = String(date.getHours()).padStart(2, '0');
  const min  = String(date.getMinutes()).padStart(2, '0');

  return `${day}, ${d} ${mon} · ${h}:${min}`;
}

function startTimeCounter() {
  clearInterval(timerInterval);
  secondsElapsed = 0;

  if (!timeCounterEl) return;

  timeCounterEl.textContent = '0s';

  timerInterval = setInterval(() => {
    secondsElapsed++;

    if (secondsElapsed < 60) {
      timeCounterEl.textContent = `${secondsElapsed}s`;
    } else {
      const minutes = Math.floor(secondsElapsed / 60);
      const seconds = secondsElapsed % 60;
      timeCounterEl.textContent = `${minutes}min ${seconds}s`;
    }
  }, 1000);
}