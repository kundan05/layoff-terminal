import { getStats, layoffData } from '../data/layoffs.js';

export function createStats(container) {
    const stats = getStats();

    container.innerHTML = `
    <div class="stats-grid">
      <div class="stat-card highlight">
        <div class="stat-label">TOTAL AFFECTED</div>
        <div class="stat-value red">${stats.total.toLocaleString()}</div>
        <div class="stat-sub">${stats.count} events tracked</div>
      </div>
      <div class="stat-card">
        <div class="stat-label">COMPANIES</div>
        <div class="stat-value amber">${Object.keys(stats.byCompany).length}</div>
        <div class="stat-sub">across ${Object.keys(stats.byCountry).length} countries</div>
      </div>
      <div class="stat-card">
        <div class="stat-label">INDUSTRIES</div>
        <div class="stat-value cyan">${Object.keys(stats.byIndustry).length}</div>
        <div class="stat-sub">${stats.topIndustries[0][0]} hardest hit</div>
      </div>
      <div class="stat-card">
        <div class="stat-label">PEAK YEAR</div>
        <div class="stat-value green">${Object.entries(stats.byYear).sort((a, b) => b[1] - a[1])[0][0]}</div>
        <div class="stat-sub">${Object.entries(stats.byYear).sort((a, b) => b[1] - a[1])[0][1].toLocaleString()} laid off</div>
      </div>
    </div>

    <div class="stats-section">
      <div class="stats-panel">
        <div class="panel-title">YEARLY BREAKDOWN</div>
        <div class="year-bars">
          ${Object.entries(stats.byYear).sort((a, b) => a[0] - b[0]).map(([year, count]) => {
        const maxCount = Math.max(...Object.values(stats.byYear));
        const pct = (count / maxCount) * 100;
        return `
              <div class="year-bar-row">
                <span class="year-label">${year}</span>
                <div class="year-bar-container">
                  <div class="year-bar" style="width:${pct}%"></div>
                </div>
                <span class="year-count">${count.toLocaleString()}</span>
              </div>
            `;
    }).join('')}
        </div>
      </div>
      
      <div class="stats-panel">
        <div class="panel-title">TOP COMPANIES BY TOTAL LAYOFFS</div>
        <div class="company-ranks">
          ${stats.topCompanies.map(([name, count], i) => `
            <div class="rank-row">
              <span class="rank-num">${String(i + 1).padStart(2, '0')}</span>
              <span class="rank-name">${name}</span>
              <span class="rank-bar-wrap">
                <span class="rank-bar" style="width:${(count / stats.topCompanies[0][1] * 100)}%"></span>
              </span>
              <span class="rank-count">${count.toLocaleString()}</span>
            </div>
          `).join('')}
        </div>
      </div>
    </div>

    <div class="stats-section">
      <div class="stats-panel">
        <div class="panel-title">BY INDUSTRY</div>
        <div class="industry-breakdown">
          ${stats.topIndustries.map(([name, count]) => `
            <div class="industry-row">
              <span class="industry-name">${name}</span>
              <span class="industry-bar-wrap">
                <span class="industry-bar" style="width:${(count / stats.topIndustries[0][1] * 100)}%"></span>
              </span>
              <span class="industry-count">${count.toLocaleString()}</span>
            </div>
          `).join('')}
        </div>
      </div>
      
      <div class="stats-panel">
        <div class="panel-title">BY COUNTRY</div>
        <div class="country-breakdown">
          ${stats.topCountries.map(([name, count]) => `
            <div class="country-row">
              <span class="country-name">${name}</span>
              <span class="country-bar-wrap">
                <span class="country-bar" style="width:${(count / stats.topCountries[0][1] * 100)}%"></span>
              </span>
              <span class="country-count">${count.toLocaleString()}</span>
            </div>
          `).join('')}
        </div>
      </div>
    </div>

    <div class="stats-section">
      <div class="stats-panel full-width">
        <div class="panel-title">MONTHLY TREND</div>
        <canvas id="trendChart" height="180"></canvas>
      </div>
    </div>
  `;

    // Draw trend chart
    drawTrendChart();
}

function drawTrendChart() {
    const canvas = document.getElementById('trendChart');
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    const rect = canvas.parentElement.getBoundingClientRect();
    canvas.width = rect.width - 20;
    canvas.height = 180;

    // Aggregate by month
    const monthlyData = {};
    layoffData.forEach(d => {
        const month = d.date.substring(0, 7); // YYYY-MM
        monthlyData[month] = (monthlyData[month] || 0) + d.headcount;
    });

    const months = Object.keys(monthlyData).sort();
    const values = months.map(m => monthlyData[m]);
    const maxVal = Math.max(...values);

    const padding = { left: 60, right: 20, top: 20, bottom: 30 };
    const chartW = canvas.width - padding.left - padding.right;
    const chartH = canvas.height - padding.top - padding.bottom;

    // Background
    ctx.fillStyle = '#0a0e14';
    ctx.fillRect(0, 0, canvas.width, canvas.height);

    // Grid lines
    ctx.strokeStyle = '#1a2030';
    ctx.lineWidth = 1;
    for (let i = 0; i <= 4; i++) {
        const y = padding.top + (chartH / 4) * i;
        ctx.beginPath();
        ctx.moveTo(padding.left, y);
        ctx.lineTo(canvas.width - padding.right, y);
        ctx.stroke();

        // Y-axis labels
        ctx.fillStyle = '#667788';
        ctx.font = '10px "JetBrains Mono", monospace';
        ctx.textAlign = 'right';
        ctx.fillText(Math.round(maxVal * (1 - i / 4)).toLocaleString(), padding.left - 8, y + 4);
    }

    // Draw area
    const gradient = ctx.createLinearGradient(0, padding.top, 0, canvas.height - padding.bottom);
    gradient.addColorStop(0, 'rgba(255, 149, 0, 0.3)');
    gradient.addColorStop(1, 'rgba(255, 149, 0, 0.0)');

    ctx.beginPath();
    ctx.moveTo(padding.left, canvas.height - padding.bottom);
    values.forEach((val, i) => {
        const x = padding.left + (i / (values.length - 1)) * chartW;
        const y = padding.top + chartH * (1 - val / maxVal);
        ctx.lineTo(x, y);
    });
    ctx.lineTo(padding.left + chartW, canvas.height - padding.bottom);
    ctx.closePath();
    ctx.fillStyle = gradient;
    ctx.fill();

    // Draw line
    ctx.beginPath();
    values.forEach((val, i) => {
        const x = padding.left + (i / (values.length - 1)) * chartW;
        const y = padding.top + chartH * (1 - val / maxVal);
        if (i === 0) ctx.moveTo(x, y);
        else ctx.lineTo(x, y);
    });
    ctx.strokeStyle = '#ff9500';
    ctx.lineWidth = 2;
    ctx.stroke();

    // Draw dots
    values.forEach((val, i) => {
        const x = padding.left + (i / (values.length - 1)) * chartW;
        const y = padding.top + chartH * (1 - val / maxVal);
        ctx.beginPath();
        ctx.arc(x, y, 3, 0, Math.PI * 2);
        ctx.fillStyle = '#ff9500';
        ctx.fill();
    });

    // X-axis labels (show every 6 months)
    ctx.fillStyle = '#667788';
    ctx.font = '9px "JetBrains Mono", monospace';
    ctx.textAlign = 'center';
    months.forEach((month, i) => {
        if (i % 6 === 0 || i === months.length - 1) {
            const x = padding.left + (i / (values.length - 1)) * chartW;
            ctx.fillText(month, x, canvas.height - 8);
        }
    });
}
