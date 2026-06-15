// News feed module using RSS-to-JSON proxy for free live news
const NEWS_CACHE_KEY = 'layoff_news_cache_rss';
const NEWS_CACHE_DURATION = 10 * 60 * 1000; // 10 minutes

// Fallback headlines if fetch fails
const fallbackNews = [
    { title: "Oracle Layoffs Over 30,000 Employees in AI Restructuring", source: "Tech News", time: "Just now", url: "https://news.google.com/search?q=oracle+layoffs" },
    { title: "Accenture Announces Largest Consulting Layoff in History", source: "Financial Times", time: "6h ago", url: "https://news.google.com/search?q=accenture+layoffs" },
    { title: "Google Cuts 5,000 Jobs as AI Agents Take Over Tasks", source: "Bloomberg", time: "8h ago", url: "https://news.google.com/search?q=google+layoffs" },
    { title: "Microsoft Copilot Replaces Entire Support Teams, 4,500 Let Go", source: "The Verge", time: "12h ago", url: "https://news.google.com/search?q=microsoft+layoffs" },
    { title: "Intel Foundry Losses Mount, Another 10,000 Jobs Eliminated", source: "CNBC", time: "1d ago", url: "https://news.google.com/search?q=intel+layoffs" },
];

export async function fetchNews() {
    const cached = localStorage.getItem(NEWS_CACHE_KEY);
    if (cached) {
        const { data, timestamp } = JSON.parse(cached);
        if (Date.now() - timestamp < NEWS_CACHE_DURATION) {
            return data;
        }
    }

    try {
        // Top tech news RSS feeds passed through rss2json
        const rssUrls = [
            'https://techcrunch.com/category/layoffs/feed/',
            'https://news.google.com/rss/search?q=tech+layoffs+AI&hl=en-US&gl=US&ceid=US:en'
        ];

        // Use the Google News RSS for best results
        const apiUrl = `https://api.rss2json.com/v1/api.json?rss_url=${encodeURIComponent(rssUrls[1])}`;
        const response = await fetch(apiUrl);

        if (response.ok) {
            const json = await response.json();
            if (json.items && json.items.length > 0) {
                const news = json.items.slice(0, 15).map(item => ({
                    title: item.title,
                    source: extractSource(item.title) || json.feed.title || "News",
                    time: getRelativeTime(new Date(item.pubDate)),
                    url: item.link
                }));

                localStorage.setItem(NEWS_CACHE_KEY, JSON.stringify({ data: news, timestamp: Date.now() }));
                return news;
            }
        }
    } catch (e) {
        console.error('RSS fetch failed, using fallback data', e);
    }

    return fallbackNews;
}

function extractSource(title) {
    const parts = title.split(' - ');
    if (parts.length > 1) {
        return parts[parts.length - 1]; // Google News RSS appends "- Publisher" to titles
    }
    return null;
}

function getRelativeTime(date) {
    const now = new Date();
    const diff = now - date;
    const hours = Math.floor(diff / (1000 * 60 * 60));
    const days = Math.floor(hours / 24);
    const minutes = Math.floor(diff / (1000 * 60));

    if (days > 0) return `${days}d ago`;
    if (hours > 0) return `${hours}h ago`;
    if (minutes > 0) return `${minutes}m ago`;
    return 'Just now';
}

let newsUpdateCallback = null;
let newsInterval = null;

export function startNewsUpdates(callback) {
    newsUpdateCallback = callback;
    newsInterval = setInterval(async () => {
        localStorage.removeItem(NEWS_CACHE_KEY);
        const news = await fetchNews();
        if (newsUpdateCallback) newsUpdateCallback(news);
    }, NEWS_CACHE_DURATION);
}

export function stopNewsUpdates() {
    if (newsInterval) clearInterval(newsInterval);
}
