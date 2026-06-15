import { layoffData } from '../data/layoffs.js';

export function createTicker(container) {
    const tickerInner = document.createElement('div');
    tickerInner.className = 'ticker-inner';

    // Sort by date descending
    const sorted = [...layoffData].sort((a, b) => new Date(b.date) - new Date(a.date));

    sorted.forEach(d => {
        const item = document.createElement('span');
        item.className = 'ticker-item';

        const isLarge = d.headcount >= 5000;
        const color = isLarge ? 'var(--red)' : d.headcount >= 1000 ? 'var(--amber)' : 'var(--green)';

        item.innerHTML = `
      <span class="ticker-company">${d.company}</span>
      <span class="ticker-count" style="color:${color}">▼ ${d.headcount.toLocaleString()}</span>
      <span class="ticker-date">${d.date}</span>
      <span class="ticker-sep">│</span>
    `;
        tickerInner.appendChild(item);
    });

    // Duplicate for seamless loop
    tickerInner.innerHTML += tickerInner.innerHTML;
    container.appendChild(tickerInner);

    // Calculate animation duration based on content width
    requestAnimationFrame(() => {
        const contentWidth = tickerInner.scrollWidth / 2;
        const speed = 80; // pixels per second
        const duration = contentWidth / speed;
        tickerInner.style.animationDuration = `${duration}s`;
    });
}
