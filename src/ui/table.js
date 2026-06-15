import { layoffData } from '../data/layoffs.js';

const PAGE_SIZE = 50;

let currentSort = { key: 'date', asc: false };
let currentPage = 0;
let currentFilter = '';
let onRowClick = null;
let container = null;

export function createTable(el, rowClickCallback) {
  container = el;
  onRowClick = rowClickCallback;
  render();
}

export function setFilter(text) {
  currentFilter = text.toLowerCase().trim();
  currentPage = 0;
  render();
}

function getFilteredData() {
  if (!currentFilter) return layoffData;
  return layoffData.filter(d =>
    (d.company && d.company.toLowerCase().includes(currentFilter)) ||
    (d.industry && d.industry.toLowerCase().includes(currentFilter)) ||
    (d.city && d.city.toLowerCase().includes(currentFilter)) ||
    (d.country && d.country.toLowerCase().includes(currentFilter)) ||
    (d.reason && d.reason.toLowerCase().includes(currentFilter))
  );
}

function getSortedData(data) {
  return [...data].sort((a, b) => {
    let valA = a[currentSort.key];
    let valB = b[currentSort.key];
    if (typeof valA === 'string') valA = valA.toLowerCase();
    if (typeof valB === 'string') valB = valB.toLowerCase();
    if (currentSort.asc) return valA > valB ? 1 : -1;
    return valA < valB ? 1 : -1;
  });
}

function render() {
  if (!container) return;
  const filtered = getFilteredData();
  const sorted = getSortedData(filtered);
  const totalPages = Math.max(1, Math.ceil(sorted.length / PAGE_SIZE));
  if (currentPage >= totalPages) currentPage = totalPages - 1;
  const pageData = sorted.slice(currentPage * PAGE_SIZE, (currentPage + 1) * PAGE_SIZE);

  const columns = [
    { key: 'date', label: 'DATE', width: '100px' },
    { key: 'company', label: 'COMPANY', width: '140px' },
    { key: 'headcount', label: 'HEADCOUNT', width: '95px' },
    { key: 'industry', label: 'INDUSTRY', width: '130px' },
    { key: 'city', label: 'LOCATION', width: '120px' },
    { key: 'country', label: 'COUNTRY', width: '90px' },
    { key: 'source_url', label: 'SOURCE', width: '80px' },
  ];

  const rows = pageData.length
    ? pageData.map((d, i) => {
        const countColor = d.headcount >= 10000 ? 'var(--red)' : d.headcount >= 5000 ? 'var(--amber)' : 'var(--green)';
        return `
          <div class="table-row" data-company="${d.company}">
            <div class="table-cell" style="width:${columns[0].width};min-width:${columns[0].width}">${d.date}</div>
            <div class="table-cell company-cell" style="width:${columns[1].width};min-width:${columns[1].width}">${d.company}</div>
            <div class="table-cell" style="width:${columns[2].width};min-width:${columns[2].width};color:${countColor};font-weight:700">${d.headcount.toLocaleString()}</div>
            <div class="table-cell" style="width:${columns[3].width};min-width:${columns[3].width}">${d.industry}</div>
            <div class="table-cell" style="width:${columns[4].width};min-width:${columns[4].width}">${d.city}</div>
            <div class="table-cell" style="width:${columns[5].width};min-width:${columns[5].width}">${d.country}</div>
            <div class="table-cell" style="width:${columns[6].width};min-width:${columns[6].width}">
              ${d.source_url ? `<a href="${d.source_url}" target="_blank" class="source-link">LINK</a>` : '\u2014'}
            </div>
          </div>
        `;
      }).join('')
    : '<div class="table-empty">NO MATCHING EVENTS</div>';

  const startRecord = currentPage * PAGE_SIZE + 1;
  const endRecord = Math.min((currentPage + 1) * PAGE_SIZE, sorted.length);

  container.innerHTML = `
    <div class="table-header-row">
      ${columns.map(col => `
        <div class="table-header-cell ${currentSort.key === col.key ? 'sorted' : ''}"
             data-key="${col.key}" style="width:${col.width};min-width:${col.width}">
          ${col.label} ${currentSort.key === col.key ? (currentSort.asc ? '\u25B2' : '\u25BC') : ''}
        </div>
      `).join('')}
    </div>
    <div class="table-body" id="tableBody">
      ${rows}
    </div>
    <div class="table-footer">
      <span class="table-count">${sorted.length.toLocaleString()} events${currentFilter ? ` (filtered)` : ''}</span>
      <div class="table-pagination">
        <button class="page-btn" data-page="prev" ${currentPage === 0 ? 'disabled' : ''}>\u25C0</button>
        <span class="page-info">${totalPages > 0 ? `${startRecord}\u2013${endRecord} of ${sorted.length.toLocaleString()}` : '0 events'}</span>
        <button class="page-btn" data-page="next" ${currentPage >= totalPages - 1 ? 'disabled' : ''}>\u25B6</button>
      </div>
    </div>
  `;

  container.querySelectorAll('.table-header-cell').forEach(cell => {
    cell.addEventListener('click', () => {
      const key = cell.dataset.key;
      if (currentSort.key === key) {
        currentSort.asc = !currentSort.asc;
      } else {
        currentSort = { key, asc: true };
      }
      render();
    });
  });

  container.querySelectorAll('.table-row').forEach(row => {
    row.addEventListener('click', () => {
      const company = row.dataset.company;
      const records = layoffData.filter(d => d.company === company);
      if (onRowClick) onRowClick(records);
    });
  });

  const prevBtn = container.querySelector('[data-page="prev"]');
  const nextBtn = container.querySelector('[data-page="next"]');
  if (prevBtn) prevBtn.addEventListener('click', () => { currentPage = Math.max(0, currentPage - 1); render(); });
  if (nextBtn) nextBtn.addEventListener('click', () => { currentPage = Math.min(totalPages - 1, currentPage + 1); render(); });
}
