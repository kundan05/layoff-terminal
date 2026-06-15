import { fetchNews, startNewsUpdates } from '../data/news.js';

export async function createNewsFeed(container) {
    container.innerHTML = `
    <div class="news-loading">
      <span class="loading-dot"></span> LOADING LATEST NEWS...
    </div>
  `;

    const news = await fetchNews();
    renderNews(container, news);

    // Start auto-refresh
    startNewsUpdates((updatedNews) => {
        renderNews(container, updatedNews);
    });
}

function renderNews(container, news) {
    container.innerHTML = `
    <div class="news-scroll">
      ${news.map((item, i) => `
        <div class="news-item" style="animation-delay:${i * 0.05}s">
          <div class="news-indicator ${i < 3 ? 'hot' : ''}"></div>
          <div class="news-content">
            <a href="${item.url}" target="_blank" class="news-title">${item.title}</a>
            <div class="news-meta">
              <span class="news-source">${item.source}</span>
              <span class="news-time">${item.time}</span>
            </div>
          </div>
        </div>
      `).join('')}
    </div>
  `;
}
