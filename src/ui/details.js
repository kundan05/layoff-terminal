export function createDetails(container) {
  container.innerHTML = `
    <div class="details-empty">
      <div class="details-icon">◎</div>
      <div class="details-prompt">SELECT A COMPANY</div>
      <div class="details-sub">Click a table row or globe marker to view details</div>
    </div>
  `;
}

export function showDetails(container, records) {
  if (!records || records.length === 0) {
    createDetails(container);
    return;
  }

  const company = records[0].company;
  const totalLayoffs = records.reduce((s, r) => s + r.headcount, 0);
  const latestDate = records.sort((a, b) => new Date(b.date) - new Date(a.date))[0].date;
  const industry = records[0].industry;

  container.innerHTML = `
    <div class="details-header">
      <div class="details-company">${company}</div>
      <div class="details-industry">${industry}</div>
    </div>
    <div class="details-stats-row">
      <div class="details-stat">
        <span class="details-stat-label">TOTAL AFFECTED</span>
        <span class="details-stat-value red">${totalLayoffs.toLocaleString()}</span>
      </div>
      <div class="details-stat">
        <span class="details-stat-label">EVENTS</span>
        <span class="details-stat-value amber">${records.length}</span>
      </div>
      <div class="details-stat">
        <span class="details-stat-label">LATEST</span>
        <span class="details-stat-value cyan">${latestDate}</span>
      </div>
    </div>
    <div class="details-timeline">
      <div class="panel-title" style="margin-bottom:8px">EVENT TIMELINE</div>
      ${records.map(r => `
        <div class="timeline-event">
          <div class="timeline-dot"></div>
          <div class="timeline-content">
            <div class="timeline-date">${r.date}</div>
            <div class="timeline-info">
              <span class="timeline-count">${r.headcount.toLocaleString()} employees</span>
              <span class="timeline-location">${r.city}, ${r.country}</span>
            </div>
            <div class="timeline-reason">${r.reason}</div>
            ${r.source_url ? `<a href="${r.source_url}" target="_blank" class="timeline-source">VIEW SOURCE ↗</a>` : ''}
          </div>
        </div>
      `).join('')}
    </div>
  `;
}
