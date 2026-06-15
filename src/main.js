import './styles/main.css';
import './styles/boot.css';
import { createGlobe } from './globe.js';
import { loadLayoffData, layoffData, getStats, lastUpdated } from './data/layoffs.js';
import { createTicker } from './ui/ticker.js';
import { createTable, setFilter } from './ui/table.js';
import { createStats } from './ui/stats.js';
import { createDetails, showDetails } from './ui/details.js';
import { createNewsFeed } from './ui/newsfeed.js';
import { initAudio, playTechClick, playDataPing, playAlertBass } from './audio.js';

const bootScreen = document.getElementById('bootScreen');
const bootText = document.getElementById('bootText');
const initBtn = document.getElementById('initBtn');
const appEl = document.getElementById('app');

appEl.style.opacity = '0';
appEl.style.pointerEvents = 'none';

const bootLines = [];

async function runBootSequence() {
  bootText.innerHTML = '';
  for (let i = 0; i < bootLines.length; i++) {
    const line = document.createElement('div');
    line.className = 'boot-line';
    bootText.appendChild(line);

    for (let char of bootLines[i]) {
      line.innerHTML += char;
      await new Promise(r => setTimeout(r, 20 + Math.random() * 30));
    }
    await new Promise(r => setTimeout(r, 400));
  }

  initBtn.style.display = 'block';

  initBtn.addEventListener('click', async () => {
    initAudio();
    playAlertBass();

    initBtn.textContent = '⏳ LOADING DATA...';
    initBtn.disabled = true;

    await init();

    bootScreen.style.opacity = '0';
    setTimeout(() => {
      bootScreen.style.display = 'none';
      appEl.style.opacity = '1';
      appEl.style.pointerEvents = 'auto';
    }, 500);
  });
}

async function init() {
  await loadLayoffData();

  appEl.style.opacity = '1';
  appEl.style.pointerEvents = 'auto';
  bootScreen.style.display = 'none';
  bootScreen.style.opacity = '0';

  const stats = getStats();
  document.getElementById('totalTracked').textContent = `${stats.total.toLocaleString()} AFFECTED`;
  document.getElementById('eventsTracked').textContent = `${stats.count} EVENTS`;

  updateClock();
  setInterval(updateClock, 1000);

  createTicker(document.getElementById('ticker'));

  const globeContainer = document.getElementById('globeContainer');
  const tooltip = document.getElementById('globeTooltip');

  await createGlobe(
    globeContainer,
    (data, event) => {
      if (data) {
        playTechClick();
        tooltip.classList.add('visible');
        tooltip.innerHTML = `
          <div class="tooltip-city">${data.city}, ${data.country}</div>
          <div class="tooltip-total">${data.total.toLocaleString()} laid off</div>
          <div class="tooltip-companies">${data.companies.map(c => c.company).join(', ')}</div>
        `;
        const rect = globeContainer.getBoundingClientRect();
        const x = event.clientX - rect.left + 15;
        const y = event.clientY - rect.top - 10;
        tooltip.style.left = `${Math.min(x, rect.width - 200)}px`;
        tooltip.style.top = `${Math.min(y, rect.height - 80)}px`;
      } else {
        tooltip.classList.remove('visible');
      }
    },
    (data) => {
      playDataPing();
      const company = data.companies[0].company;
      const records = layoffData.filter(d => d.company === company);
      showDetails(document.getElementById('tab-details'), records);
      switchTab('details');
    }
  );

  createTable(document.getElementById('dataTable'), (records) => {
    playDataPing();
    showDetails(document.getElementById('tab-details'), records);
    switchTab('details');
  });

  createStats(document.getElementById('tab-stats'));

  createDetails(document.getElementById('tab-details'));

  createNewsFeed(document.getElementById('newsContainer'));

  const updateTime = lastUpdated ? new Date(lastUpdated).toLocaleTimeString() : new Date().toLocaleTimeString();
  document.getElementById('newsTimestamp').textContent = `24H AUTOMATION ACTIVE | UPDATED ${updateTime}`;

  // URL state
  function updateURL(tab, query) {
    const params = new URLSearchParams();
    if (tab && tab !== 'table') params.set('tab', tab);
    if (query) params.set('q', query);
    const hash = params.toString() ? '#' + params.toString() : '';
    history.replaceState(null, '', hash);
  }

  function restoreFromURL() {
    const hash = window.location.hash.slice(1);
    if (!hash) return;
    const params = new URLSearchParams(hash);
    const tab = params.get('tab');
    const q = params.get('q');
    if (tab) switchTab(tab);
    if (q) { searchInput.value = q; setFilter(q); }
  }

  // Search
  const searchInput = document.getElementById('searchInput');
  let searchTimer;
  searchInput.addEventListener('input', () => {
    clearTimeout(searchTimer);
    searchTimer = setTimeout(() => {
      setFilter(searchInput.value);
      updateURL(document.querySelector('.tab-btn.active')?.dataset.tab, searchInput.value);
    }, 200);
  });
  searchInput.addEventListener('keydown', (e) => {
    if (e.key === 'Escape') { searchInput.value = ''; setFilter(''); searchInput.blur(); updateURL(document.querySelector('.tab-btn.active')?.dataset.tab, ''); }
  });

  // Tabs
  document.querySelectorAll('.tab-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      playTechClick();
      switchTab(btn.dataset.tab);
      updateURL(btn.dataset.tab, searchInput.value);
    });
  });

  // Keyboard shortcuts
  document.addEventListener('keydown', (e) => {
    if (e.target.tagName === 'INPUT') return;

    switch (e.key) {
      case '/':
        e.preventDefault();
        searchInput.focus();
        searchInput.select();
        break;
      case '1': switchTab('table'); break;
      case '2': switchTab('stats'); break;
      case '3': switchTab('details'); break;
      case 'Escape':
        showDetails(document.getElementById('tab-details'), null);
        switchTab('table');
        break;
    }
  });

  restoreFromURL();
}

function switchTab(tabName) {
  document.querySelectorAll('.tab-btn').forEach(btn => {
    btn.classList.toggle('active', btn.dataset.tab === tabName);
  });
  document.querySelectorAll('.tab-pane').forEach(pane => {
    pane.classList.toggle('active', pane.id === `tab-${tabName}`);
  });
}

function updateClock() {
  const now = new Date();
  const timeStr = now.toLocaleTimeString('en-US', { hour12: false });
  const dateStr = now.toLocaleDateString('en-US', { month: 'short', day: '2-digit', year: 'numeric' });
  document.getElementById('clock').textContent = `${dateStr} ${timeStr}`;
}

init();
