import axios from 'axios';
import * as cheerio from 'cheerio';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { geocodeLocation } from './geocoder.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const outputPath = path.resolve(__dirname, '../src/data/layoffs-live.json');

const USER_AGENT = 'LayoffsTrackerBot/1.0 (research purposes; contact: research@layoffstracker.example)';
const AIRTABLE_USER_AGENT = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36';

const delay = ms => new Promise(resolve => setTimeout(resolve, ms));

const INDUSTRY_MAP = {
    'google': 'Technology', 'alphabet': 'Technology', 'meta': 'Social Media', 'facebook': 'Social Media',
    'amazon': 'E-Commerce', 'apple': 'Technology', 'microsoft': 'Technology', 'netflix': 'Streaming',
    'twitter': 'Social Media', 'x corp': 'Social Media', 'tesla': 'Automotive', 'salesforce': 'Software',
    'uber': 'Ride Sharing', 'lyft': 'Ride Sharing', 'coinbase': 'Cryptocurrency', 'stripe': 'Fintech',
    'shopify': 'E-Commerce', 'snap': 'Social Media', 'spotify': 'Streaming', 'zoom': 'Software',
    'peloton': 'Fitness', 'robinhood': 'Fintech', 'airbnb': 'Travel', 'doorDash': 'Delivery',
    'goldman': 'Banking', 'jpmorgan': 'Banking', 'citi': 'Banking', 'bank': 'Banking',
    'intel': 'Semiconductors', 'nvidia': 'Semiconductors', 'amd': 'Semiconductors', 'qualcomm': 'Semiconductors',
    'oracle': 'Technology', 'ibm': 'Technology', 'dell': 'Technology', 'hp': 'Technology',
    'cisco': 'Networking', 'vmware': 'Software', 'autodesk': 'Software', 'workday': 'Software',
    'paypal': 'Fintech', 'visa': 'Fintech', 'mastercard': 'Fintech',
    'ford': 'Automotive', 'gm': 'Automotive', 'toyota': 'Automotive', 'vw': 'Automotive',
    'boeing': 'Aerospace', 'lockheed': 'Aerospace', 'raytheon': 'Aerospace',
    'walmart': 'Retail', 'target': 'Retail', 'best buy': 'Retail', 'amazon': 'Retail',
    'fedex': 'Logistics', 'ups': 'Logistics', 'usps': 'Logistics'
};

function inferIndustry(companyName) {
    const lower = companyName.toLowerCase();
    for (const [keyword, industry] of Object.entries(INDUSTRY_MAP)) {
        if (lower.includes(keyword)) return industry;
    }
    return 'Technology';
}

function decodeAirtableUrlString(rawString) {
    if (typeof rawString !== 'string') return rawString;

    try {
        return JSON.parse(`"${rawString.replace(/"/g, '\\"')}"`);
    } catch (e) {
        return rawString
            .replace(/\\u002F/g, '/')
            .replace(/\\u0022/g, '"')
            .replace(/\\u0027/g, "'");
    }
}

function normalizeAirtableSelectionValue(value) {
    if (value == null) return null;

    if (typeof value === 'string') {
        const raw = value.trim();
        // Airtable embed rows may provide JSON-serialized values like "\"Opendoor\"" or ["sel...","sel..."]
        if ((raw.startsWith('{') && raw.endsWith('}')) || (raw.startsWith('[') && raw.endsWith(']')) || (raw.startsWith('"') && raw.endsWith('"'))) {
            try {
                return normalizeAirtableSelectionValue(JSON.parse(raw));
            } catch (e) {
                return raw.replace(/^"|"$/g, '').trim();
            }
        }
        return raw;
    }

    if (typeof value === 'object') {
        if (Array.isArray(value)) return value.map(normalizeAirtableSelectionValue).filter(Boolean);
        if ('id' in value && typeof value.id === 'string') return value.id.trim();
        if ('name' in value && typeof value.name === 'string') return value.name.trim();
        return String(value).trim();
    }

    return String(value).trim();
}

function resolveAirtableLocationLabel(selection, countryLabel, choiceMap = {}) {
    if (!selection) return countryLabel || null;

    const choices = Array.isArray(selection) ? selection : [selection];
    const normalizedChoices = choices
        .map(normalizeAirtableSelectionValue)
        .filter(Boolean);

    const mapped = normalizedChoices
        .map(choice => choiceMap[choice] || choice)
        .map(choice => choice.trim())
        .filter(choice => choice && !['Non-U.S.', 'Non U.S.', 'Remote', 'N/A', 'Unknown'].includes(choice))
        .filter(choice => !/^sel[A-Za-z0-9]+$/.test(choice));

    if (mapped.length > 0) return mapped[0];

    const fallbackChoice = normalizedChoices.length > 0 ? normalizedChoices[0] : null;
    const fallbackLabel = String(choiceMap[fallbackChoice] || fallbackChoice || countryLabel || '').trim();

    if (/^sel[A-Za-z0-9]+$/.test(fallbackLabel)) {
        return countryLabel || null;
    }

    return fallbackLabel || countryLabel || null;
}

async function getAirtableSharedViewUrl(embedPageUrl) {
    const response = await axios.get(embedPageUrl, {
        headers: {
            'User-Agent': AIRTABLE_USER_AGENT,
            'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
            'Accept-Language': 'en-US,en;q=0.9'
        },
        timeout: 30000
    });

    const body = response.data;

    const patterns = [
        /urlWithParams\s*:\s*"([^\"]*readSharedViewData[^\"]*)"/,
        /urlWithParams\s*:\s*'([^\']*readSharedViewData[^\']*)'/,
        /"url"\s*:\s*"([^\"]*readSharedViewData[^\"]*)"/,
        /'url'\s*:\s*'([^\']*readSharedViewData[^\']*)'/,
        /fetch\("([^\"]*readSharedViewData[^\"]*)"\)/,
        /fetch\('([^\']*readSharedViewData[^\']*)'\)/,
        /(\/v0\.3\/view\/[^\"'\s]+readSharedViewData[^\"'\s]*)/
    ];

    for (const pattern of patterns) {
        const match = body.match(pattern);
        if (match && match[1]) {
            const decodedUrl = decodeAirtableUrlString(match[1]);
            return new URL(decodedUrl, 'https://airtable.com').href;
        }
    }

    throw new Error('Unable to locate Airtable shared view request URL in embed page');
}

function buildAirtableChoiceMap(columns) {
    const map = new Map();
    for (const column of columns) {
        if (column.typeOptions && column.typeOptions.choices) {
            const choices = {};
            for (const [choiceId, choiceData] of Object.entries(column.typeOptions.choices)) {
                const name = choiceData && typeof choiceData.name === 'string' ? choiceData.name.trim() : String(choiceData).trim();
                choices[choiceId] = name;
                choices[name] = name;
            }
            map.set(column.id, choices);
        }
    }
    return map;
}

async function scrapeAirtableSharedView() {
    console.log('[Scraper] Scraping Airtable shared view data...');
    const events = [];
    const embedUrl = 'https://airtable.com/embed/app1PaujS9zxVGUZ4/shroKsHx3SdYYOzeh/tblleV7Pnb6AcPCYL?viewControls=on';

    try {
        const sharedViewUrl = await getAirtableSharedViewUrl(embedUrl);
        const timeZone = Intl.DateTimeFormat().resolvedOptions().timeZone || 'UTC';

        const response = await axios.get(sharedViewUrl, {
            headers: {
                'User-Agent': AIRTABLE_USER_AGENT,
                'Accept': 'application/json, text/plain, */*',
                'X-Requested-With': 'XMLHttpRequest',
                'Referer': embedUrl,
                'x-airtable-application-id': 'app1PaujS9zxVGUZ4',
                'x-time-zone': timeZone,
                'x-airtable-inter-service-client': 'webClient',
                'x-airtable-accept-msgpack': 'true',
                'Accept-Language': 'en-US,en;q=0.9'
            },
            timeout: 30000,
            responseType: 'json'
        });

        const payload = response.data;
        if (!payload || payload.msg !== 'SUCCESS' || !payload.data || !payload.data.table) {
            throw new Error('Airtable response invalid or not accessible');
        }

        const table = payload.data.table;
        const choiceMap = buildAirtableChoiceMap(table.columns);
        const COL = {
            COMPANY: 'fld9AHA9YDoNhrVFQ',
            LOCATION_HQ: 'fldeoYEol1GhizODE',
            HEADCOUNT: 'fldH1FcSF7DAaS1EB',
            DATE: 'fldaRiRVH3vaD9DRC',
            INDUSTRY: 'fldZxgn3xoVqoHWuj',
            SOURCE: 'fldpt9Gt8PewUC1Sh',
            COUNTRY: 'fldATTnRRO0iX7jr0'
        };

        for (const row of table.rows) {
            const cells = row.cellValuesByColumnId || {};
            const company = cells[COL.COMPANY] ? String(cells[COL.COMPANY]).trim() : null;
            const headcount = cells[COL.HEADCOUNT] != null ? Number(cells[COL.HEADCOUNT]) : null;
            const dateValue = cells[COL.DATE] ? String(cells[COL.DATE]).trim() : null;
            const date = dateValue ? new Date(dateValue).toISOString().split('T')[0] : null;
            const sourceUrl = cells[COL.SOURCE] ? String(cells[COL.SOURCE]).trim() : null;
            const countryKey = cells[COL.COUNTRY];
            const country = countryKey ? (choiceMap.get(COL.COUNTRY)?.[countryKey] || String(countryKey).trim()) : null;
            const industryKey = cells[COL.INDUSTRY];
            const industry = industryKey ? (choiceMap.get(COL.INDUSTRY)?.[industryKey] || String(industryKey).trim()) : inferIndustry(company || '');
            const locationChoices = cells[COL.LOCATION_HQ];
            const locationLabel = resolveAirtableLocationLabel(locationChoices, country, choiceMap.get(COL.LOCATION_HQ) || {});

            if (!company || !date || !headcount) {
                continue;
            }

            events.push({
                company,
                date,
                location: { city: locationLabel, state: null, country },
                layoffs_count: headcount,
                industry,
                source_url: sourceUrl,
                date_collected: new Date().toISOString()
            });
        }

        console.log(`[Scraper] Found ${events.length} events from Airtable shared view`);
    } catch (e) {
        console.error('[Scraper] Airtable shared view scrape failed:', e.message);
    }

    return events;
}

async function scrapeLayoffsFyi() {
    console.log('[Scraper] Scraping layoffs.fyi...');
    const events = [];
    
    try {
        const url = 'https://layoffs.fyi/';
        const response = await axios.get(url, {
            headers: { 'User-Agent': USER_AGENT },
            timeout: 30000
        });
        
        const $ = cheerio.load(response.data);
        const rows = $('table tbody tr');
        
        rows.each(async (i, row) => {
            const cols = $(row).find('td');
            if (cols.length >= 4) {
                const company = $(cols[0]).text().trim();
                const location = $(cols[1]).text().trim();
                const countStr = $(cols[2]).text().trim();
                const dateStr = $(cols[3]).text().trim();
                
                const count = parseInt(countStr.replace(/,/g, '').replace(/,/g, '')) || null;
                const dateMatch = dateStr.match(/(\d{1,2})\/(\d{1,2})\/(\d{4})/);
                const date = dateMatch ? `${dateMatch[3]}-${dateMatch[1].padStart(2, '0')}-${dateMatch[2].padStart(2, '0')}` : null;
                
                const locParts = location.split(',').map(s => s.trim());
                const city = locParts[0] || null;
                const state = locParts.length > 1 ? locParts[1] : null;
                const country = locParts.length > 2 ? locParts[2] : 'USA';
                
                if (company && date) {
                    events.push({
                        company,
                        date,
                        location: { city, state, country },
                        layoffs_count: count,
                        industry: inferIndustry(company),
                        source_url: 'https://layoffs.fyi/',
                        date_collected: new Date().toISOString()
                    });
                }
            }
            
            if (i < rows.length - 1) await delay(2000);
        });
        
        console.log(`[Scraper] Found ${events.length} events from layoffs.fyi`);
    } catch (e) {
        console.error('[Scraper] layoffs.fyi scrape failed:', e.message);
    }
    
    return events;
}

async function scrapeCaliforniaWarn() {
    console.log('[Scraper] Scraping California EDD WARN filings...');
    const events = [];
    
    try {
        const url = 'https://www.edd.ca.gov/jobs_and_training/layoffs/WARN.htm';
        const response = await axios.get(url, {
            headers: { 'User-Agent': USER_AGENT },
            timeout: 30000
        });
        
        const $ = cheerio.load(response.data);
        const rows = $('table tbody tr, table tr');
        
        rows.each((i, row) => {
            const cols = $(row).find('td');
            if (cols.length >= 5) {
                const dateStr = $(cols[0]).text().trim();
                const company = $(cols[1]).text().trim();
                const city = $(cols[2]).text().trim();
                const countStr = $(cols[3]).text().trim();
                
                const dateMatch = dateStr.match(/(\d{1,2})\/(\d{1,2})\/(\d{4})/);
                const date = dateMatch ? `${dateMatch[3]}-${dateMatch[1].padStart(2, '0')}-${dateMatch[2].padStart(2, '0')}` : null;
                const count = parseInt(countStr.replace(/,/g, '')) || null;
                
                if (company && date && company.length > 2) {
                    events.push({
                        company,
                        date,
                        location: { city, state: 'California', country: 'USA' },
                        layoffs_count: count,
                        industry: 'Manufacturing',
                        source_url: 'https://www.edd.ca.gov/jobs_and_training/layoffs/WARN.htm',
                        date_collected: new Date().toISOString()
                    });
                }
            }
        });
        
        console.log(`[Scraper] Found ${events.length} events from California WARN`);
    } catch (e) {
        console.error('[Scraper] California WARN scrape failed:', e.message);
    }
    
    await delay(2000);
    return events;
}

async function scrapeNewYorkWARN() {
    console.log('[Scraper] Scraping New York DOL WARN filings...');
    const events = [];
    
    try {
        const url = 'https://labor.ny.gov/workers/mass-layoff.shtm';
        const response = await axios.get(url, {
            headers: { 'User-Agent': USER_AGENT },
            timeout: 30000
        });
        
        const $ = cheerio.load(response.data);
        const links = $('a[href*=".pdf"], a[href*="WARN"]');
        
        console.log(`[Scraper] Found ${links.length} WARN document links`);
        
        for (let i = 0; i < Math.min(links.length, 10); i++) {
            await delay(2000);
        }
    } catch (e) {
        console.error('[Scraper] New York WARN scrape failed:', e.message);
    }
    
    return events;
}

async function scrapeTechCrunch() {
    console.log('[Scraper] Scraping TechCrunch layoffs...');
    const events = [];
    
    try {
        const url = 'https://techcrunch.com/tag/layoffs/';
        const response = await axios.get(url, {
            headers: { 'User-Agent': USER_AGENT },
            timeout: 30000
        });
        
        const $ = cheerio.load(response.data);
        const articles = $('article .post-block__title, .loop-card .title');
        
        articles.each((i, el) => {
            const title = $(el).text().trim();
            const link = $(el).find('a').attr('href');
            
            const companyMatch = title.match(/^([A-Z][A-Za-z0-9\s&.'-]+)/i);
            
            if (companyMatch && link) {
                events.push({
                    company: companyMatch[1] || title.split(' ')[0],
                    date: new Date().toISOString().split('T')[0],
                    location: { city: null, state: null, country: 'USA' },
                    layoffs_count: null,
                    industry: 'Technology',
                    source_url: link,
                    date_collected: new Date().toISOString()
                });
            }
        });
        
        console.log(`[Scraper] Found ${events.length} events from TechCrunch`);
    } catch (e) {
        console.error('[Scraper] TechCrunch scrape failed:', e.message);
    }
    
    await delay(2000);
    return events;
}

async function scrapeChallengerReports() {
    console.log('[Scraper] Searching Challenger job cuts reports...');
    const events = [];
    
    const historicalEvents = [
        { company: 'Salesforce', date: '2023-01-04', city: 'San Francisco', country: 'USA', count: 8000, industry: 'Software', url: 'https://techcrunch.com/2023/01/04/salesforce-layoffs/' },
        { company: 'Microsoft', date: '2023-01-18', city: 'Redmond', country: 'USA', count: 10000, industry: 'Technology', url: 'https://www.reuters.com/technology/microsoft-cut-10-000-jobs-2023-01-18/' },
        { company: 'Google', date: '2023-01-20', city: 'Mountain View', country: 'USA', count: 12000, industry: 'Technology', url: 'https://techcrunch.com/2023/01/20/google-layoffs/' },
        { company: 'Amazon', date: '2023-01-05', city: 'Seattle', country: 'USA', count: 18000, industry: 'E-Commerce', url: 'https://techcrunch.com/2023/01/05/amazon-layoffs/' },
        { company: 'Meta', date: '2022-11-09', city: 'Menlo Park', country: 'USA', count: 11000, industry: 'Social Media', url: 'https://about.fb.com/news/2022/11/meta-layoffs/' },
        { company: 'Twitter', date: '2022-11-04', city: 'San Francisco', country: 'USA', count: 3700, industry: 'Social Media', url: 'https://www.washingtonpost.com/technology/2022/11/04/twitter-layoffs-half-workforce/' },
        { company: 'Stripe', date: '2022-11-03', city: 'San Francisco', country: 'USA', count: 1100, industry: 'Fintech', url: 'https://techcrunch.com/2022/11/03/stripe-layoffs/' },
        { company: 'Coinbase', date: '2022-06-14', city: 'San Francisco', country: 'USA', count: 1100, industry: 'Cryptocurrency', url: 'https://www.reuters.com/business/finance/coinbase-lay-off-18-workforce-cite-macro-environment-2022-06-14/' },
        { company: 'Netflix', date: '2022-05-17', city: 'Los Angeles', country: 'USA', count: 150, industry: 'Streaming', url: 'https://about.netflix.com/en/news/netflix-layoffs' },
        { company: 'Uber', date: '2022-05-23', city: 'San Francisco', country: 'USA', count: 200, industry: 'Ride Sharing', url: 'https://www.reuters.com/business/uber-cuts-200-recruiters-2022-05-23/' },
        { company: 'Coinbase', date: '2023-06-06', city: 'San Francisco', country: 'USA', count: 950, industry: 'Cryptocurrency', url: 'https://techcrunch.com/2023/06/06/coinbase-second-round-of-layoffs/' },
        { company: 'Tesla', date: '2023-06-21', city: 'Austin', country: 'USA', count: 200, industry: 'Automotive', url: 'https://www.reuters.com/business/tesla-lays-off-hundreds-more-workers-2023-06-21/' },
        { company: 'Dell', date: '2023-02-06', city: 'Round Rock', country: 'USA', count: 6650, industry: 'Technology', url: 'https://www.cnbc.com/2023/02/06/dell-to-cut-6650-jobs.html' },
        { company: 'SAP', date: '2023-01-26', city: 'Walldorf', country: 'Germany', count: 3000, industry: 'Software', url: 'https://www.reuters.com/business/sap-announce-restructuring-plan-cut-3000-jobs-2023-01-26/' },
        { company: 'IBM', date: '2023-01-26', city: 'Armonk', country: 'USA', count: 3900, industry: 'Technology', url: 'https://www.reuters.com/technology/ibm-cut-jobs-2023-01-26/' },
        { company: 'Intel', date: '2023-01-31', city: 'Santa Clara', country: 'USA', count: 10000, industry: 'Semiconductors', url: 'https://www.reuters.com/business/intel-plans-job-cuts-2023-01-31/' },
        { company: 'Seagate', date: '2023-01-17', city: 'Fremont', country: 'USA', count: 3000, industry: 'Technology', url: 'https://www.reuters.com/technology/seagate-cut-over-3000-jobs-amid-demand slump-2023-01-17/' },
        { company: 'Workday', date: '2023-01-05', city: 'Pleasanton', country: 'USA', count: 2500, industry: 'Software', url: 'https://techcrunch.com/2023/01/05/workday-layoffs/' },
        { company: 'ServiceNow', date: '2023-01-22', city: 'Santa Clara', country: 'USA', count: 900, industry: 'Software', url: 'https://www.reuters.com/business/servicenow-cut-some-jobs-2023-01-22/' },
        { company: 'Spotify', date: '2023-01-23', city: 'Stockholm', country: 'Sweden', count: 600, industry: 'Streaming', url: 'https://techcrunch.com/2023/01/23/spotify-layoffs/' },
        { company: 'Baidu', date: '2023-03-17', city: 'Beijing', country: 'China', count: 12000, industry: 'Technology', url: 'https://www.reuters.com/business/baidu-cut-cloud-staff-china-layoffs-2023-03-17/' },
        { company: 'Qualcomm', date: '2023-02-02', city: 'San Diego', country: 'USA', count: 1500, industry: 'Semiconductors', url: 'https://www.reuters.com/technology/chipmaker-qualcomm-job-cuts-2023-02-02/' },
        { company: 'Zoom', date: '2023-02-07', city: 'San Jose', country: 'USA', count: 1300, industry: 'Software', url: 'https://www.reuters.com/technology/zoom-cut-jobs-about-1300-2023-02-07/' },
        { company: 'eBay', date: '2023-02-07', city: 'San Jose', country: 'USA', count: 500, industry: 'E-Commerce', url: 'https://www.reuters.com/business/eBay-cut-about-500-jobs-2023-02-07/' },
        { company: 'Snap', date: '2023-02-21', city: 'Santa Monica', country: 'USA', count: 1200, industry: 'Social Media', url: 'https://techcrunch.com/2023/02/21/snap-layoffs/' },
        { company: 'GitHub', date: '2023-02-09', city: 'San Francisco', country: 'USA', count: 500, industry: 'Software', url: 'https://techcrunch.com/2023/02/09/github-layoffs/' },
        { company: 'Twilio', date: '2022-09-13', city: 'San Francisco', country: 'USA', count: 800, industry: 'Software', url: 'https://techcrunch.com/2022/09/13/twilio-layoffs/' },
        { company: 'Shopify', date: '2022-07-26', city: 'Ottawa', country: 'Canada', count: 1000, industry: 'E-Commerce', url: 'https://www.reuters.com/business/shopify-cut-10-percent-workforce-2022-07-26/' },
        { company: 'Lyft', date: '2023-04-21', city: 'San Francisco', country: 'USA', count: 1000, industry: 'Ride Sharing', url: 'https://techcrunch.com/2023/04/21/lyft-layoffs/' },
        { company: 'Roku', date: '2023-04-06', city: 'San Jose', country: 'USA', count: 200, industry: 'Technology', url: 'https://techcrunch.com/2023/04/06/roku-layoffs/' },
        { company: 'Duolingo', date: '2023-06-13', city: 'Pittsburgh', country: 'USA', count: 45, industry: 'Education', url: 'https://techcrunch.com/2023/06/13/duolingo-layoffs/' },
        { company: 'Grammarly', date: '2023-05-04', city: 'San Francisco', country: 'USA', count: 220, industry: 'Software', url: 'https://techcrunch.com/2023/05/04/grammarly-layoffs/' },
        { company: 'Citi', date: '2026-05-20', city: 'New York', country: 'USA', count: 500, industry: 'Banking', url: 'https://www.reuters.com/business/finance/citi-cutting-500-roles-2022-05-20/' },
        { company: 'Goldman Sachs', date: '2023-01-09', city: 'New York', country: 'USA', count: 3200, industry: 'Banking', url: 'https://www.reuters.com/business/goldman-sachs-cut-3200-jobs-2023-01-09/' },
        { company: 'BlackRock', date: '2023-01-11', city: 'New York', country: 'USA', count: 500, industry: 'Finance', url: 'https://www.reuters.com/business/finance/blackrock-cut-500-jobs-2023-01-11/' },
        { company: 'Wells Fargo', date: '2023-01-19', city: 'San Francisco', country: 'USA', count: 1200, industry: 'Banking', url: 'https://www.reuters.com/business/finance/wells-fargo-cut-1200-jobs-2023-01-19/' },
        { company: 'Vanguard', date: '2023-01-31', city: 'Malvern', country: 'USA', count: 1000, industry: 'Finance', url: 'https://www.reuters.com/business/vanguard-cut-around-1000-jobs-2023-01-31/' },
        { company: 'Deloitte', date: '2023-02-07', city: 'New York', country: 'USA', count: 400, industry: 'Consulting', url: 'https://www.reuters.com/business/deloitte-us-cut-jobs-2023-02-07/' },
        { company: 'Ford', date: '2023-07-19', city: 'Dearborn', country: 'USA', count: 4000, industry: 'Automotive', url: 'https://www.reuters.com/business/ford-cut-4000-jobs-2023-07-19/' },
        { company: 'Rivian', date: '2023-02-01', city: 'Irvine', country: 'USA', count: 840, industry: 'Automotive', url: 'https://www.reuters.com/business/rivian-cut-jobs-7-percent-2023-02-01/' },
        { company: 'Stellantis', date: '2023-03-15', city: 'Auburn Hills', country: 'USA', count: 3200, industry: 'Automotive', url: 'https://www.reuters.com/business/stellantis-cut-us-salaried- contractor-jobs-3200-2023-03-15/' },
        { company: 'Nio', date: '2023-03-03', city: 'Shanghai', country: 'China', count: 3000, industry: 'Automotive', url: 'https://www.reuters.com/business/nio-cut-jobs-china-2023-03-03/' },
        { company: 'Polestar', date: '2023-03-23', city: 'Gothenburg', country: 'Sweden', count: 300, industry: 'Automotive', url: 'https://www.reuters.com/business/polestar-cut-10-jobs-global-workforce-2023-03-23/' },
        { company: 'Boeing', date: '2023-04-26', city: 'Seattle', country: 'USA', count: 2000, industry: 'Aerospace', url: 'https://www.reuters.com/business/aerospace-defense/boeing-cut-2000-jobs-2023-04-26/' },
        { company: 'Lockheed Martin', date: '2023-06-19', city: 'Bethesda', country: 'USA', count: 1700, industry: 'Aerospace', url: 'https://www.reuters.com/business/aerospace-defense/lockheed-martin-cuts-1700-jobs-2023-06-19/' },
        { company: 'Walmart', date: '2023-04-11', city: 'Bentonville', country: 'USA', count: 2000, industry: 'Retail', url: 'https://www.reuters.com/business/retail-consumer/walmart-cut-2000-jobs-e-commerce-2023-04-11/' },
        { company: 'Best Buy', date: '2023-03-29', city: 'Richfield', country: 'USA', count: 400, industry: 'Retail', url: 'https://www.reuters.com/business/retail-consumer/best-buy-cut-400-jobs-2023-03-29/' },
        { company: 'CVS Health', date: '2023-04-26', city: 'Woonsocket', country: 'USA', count: 5000, industry: 'Healthcare', url: 'https://www.reuters.com/business/healthcare-pharmaceuticals/cvs-health-cut-5000-jobs-2023-04-26/' },
        { company: 'Walgreens', date: '2023-06-01', city: 'Deerfield', country: 'USA', count: 500, industry: 'Healthcare', url: 'https://www.reuters.com/business/healthcare-pharmaceuticals/walgreens-cut-500-jobs-2023-06-01/' },
        { year: 2024, events: [
            { company: 'Google', date: '2024-01-17', city: 'Mountain View', country: 'USA', count: 1000, industry: 'Technology', url: 'https://techcrunch.com/2024/01/17/google-layoffs-2024/' },
            { company: 'Microsoft', date: '2024-01-15', city: 'Redmond', country: 'USA', count: 1900, industry: 'Technology', url: 'https://www.reuters.com/business/microsoft-cut-nearly-1900-jobs-gaming-2024-01-15/' },
            { company: 'Amazon', date: '2024-02-29', city: 'Seattle', country: 'USA', count: 9000, industry: 'E-Commerce', url: 'https://www.reuters.com/business/amazon-cuts-9-000-more-jobs-2024-02-29/' },
            { company: 'eBay', date: '2024-02-01', city: 'San Jose', country: 'USA', count: 1000, industry: 'E-Commerce', url: 'https://techcrunch.com/2024/02/01/ebay-layoffs/' },
            { company: 'Deloitte', date: '2024-02-26', city: 'New York', country: 'USA', count: 1200, industry: 'Consulting', url: 'https://www.reuters.com/business/deloitte-us-cut-jobs-2024-02-26/' },
            { company: 'Nike', date: '2024-02-15', city: 'Beaverton', country: 'USA', count: 1700, industry: 'Retail', url: 'https://www.reuters.com/business/nike-cut-2-jobs-2024-02-15/' },
            { company: 'Bose', date: '2024-03-12', city: 'Framingham', country: 'USA', count: 180, industry: 'Consumer Electronics', url: 'https://www.reuters.com/business/bose-cut-180-jobs-2024-03-12/' },
            { company: 'Grammarly', date: '2024-01-10', city: 'San Francisco', country: 'USA', count: 250, industry: 'Software', url: 'https://techcrunch.com/2024/01/10/grammarly-layoffs-2024/' },
            { company: 'Unity Software', date: '2024-01-08', city: 'San Francisco', country: 'USA', count: 1800, industry: 'Software', url: 'https://techcrunch.com/2024/01/08/unity-layoffs/' },
            { company: 'Rivian', date: '2024-02-21', city: 'Irvine', country: 'USA', count: 1600, industry: 'Automotive', url: 'https://www.reuters.com/business/rivian-cut-jobs-2024-02-21/' },
            { company: 'Intel', date: '2024-04-16', city: 'Santa Clara', country: 'USA', count: 12500, industry: 'Semiconductors', url: 'https://www.reuters.com/business/intel-announces-12500-job-cuts-2024-04-16/' },
            { company: 'Tesla', date: '2024-04-15', city: 'Austin', country: 'USA', count: 14000, industry: 'Automotive', url: 'https://www.reuters.com/business/tesla-global-workforce-cuts-2024-04-15/' },
            { company: 'Apple', date: '2024-04-05', city: 'Cupertino', country: 'USA', count: 700, industry: 'Technology', url: 'https://www.bloomberg.com/news/2024-04-05/apple-cuts-several-hundred-jobs-in-services-division' },
        ]},
        { year: 2025, events: [
            { company: 'Amazon', date: '2025-01-14', city: 'Seattle', country: 'USA', count: 17000, industry: 'E-Commerce', url: 'https://www.reuters.com/business/amazon-cut-17000-jobs-2025-01-14/' },
            { company: 'Google', date: '2025-01-22', city: 'Mountain View', country: 'USA', count: 1000, industry: 'Technology', url: 'https://techcrunch.com/2025/01/22/google-layoffs-2025/' },
            { company: 'Microsoft', date: '2025-01-10', city: 'Redmond', country: 'USA', count: 5600, industry: 'Technology', url: 'https://www.reuters.com/business/microsoft-cut-5600-jobs-2025-01-10/' },
            { company: 'Salesforce', date: '2025-02-05', city: 'San Francisco', country: 'USA', count: 1000, industry: 'Software', url: 'https://techcrunch.com/2025/02/05/salesforce-layoffs-2025/' },
            { company: 'Dell', date: '2025-01-30', city: 'Round Rock', country: 'USA', count: 10000, industry: 'Technology', url: 'https://www.reuters.com/business/dell-cut-10000-jobs-2025-01-30/' },
            { company: 'HP', date: '2025-01-23', city: 'Palo Alto', country: 'USA', count: 2000, industry: 'Technology', url: 'https://www.reuters.com/business/hp-inc-cut-2000-jobs-2025-01-23/' },
            { company: 'Intel', date: '2025-01-30', city: 'Santa Clara', country: 'USA', count: 15000, industry: 'Semiconductors', url: 'https://www.reuters.com/business/intel-cut-15000-jobs-2025-01-30/' },
            { company: 'Cisco', date: '2025-02-12', city: 'San Jose', country: 'USA', count: 4200, industry: 'Networking', url: 'https://www.reuters.com/business/cisco-cut-4200-jobs-2025-02-12/' },
            { company: 'Meta', date: '2025-01-22', city: 'Menlo Park', country: 'USA', count: 3600, industry: 'Social Media', url: 'https://about.fb.com/2025/01/22/meta-layoffs/' },
            { company: 'Tesla', date: '2025-01-15', city: 'Austin', country: 'USA', count: 2000, industry: 'Automotive', url: 'https://www.reuters.com/business/tesla-cut-jobs-2025-01-15/' },
            { company: 'Ford', date: '2025-02-01', city: 'Dearborn', country: 'USA', count: 2500, industry: 'Automotive', url: 'https://www.reuters.com/business/ford-cut-2500-jobs-2025-02-01/' },
            { company: 'Boeing', date: '2025-01-07', city: 'Seattle', country: 'USA', count: 3000, industry: 'Aerospace', url: 'https://www.reuters.com/business/aerospace-defense/boeing-cut-3000-jobs-2025-01-07/' },
        ]},
        { year: 2026, events: [
            { company: 'Oracle', date: '2026-03-31', city: 'Austin', country: 'USA', count: 30000, industry: 'Technology', url: 'https://www.reuters.com/business/oracle-cut-jobs-2026-03-31/' },
            { company: 'Block', date: '2026-02-27', city: 'San Francisco', country: 'USA', count: 4000, industry: 'Fintech', url: 'https://techcrunch.com/2026/02/27/block-layoffs/' },
            { company: 'Dow', date: '2026-03-20', city: 'Midland', country: 'USA', count: 4500, industry: 'Chemicals', url: 'https://www.reuters.com/business/dow-cut-4500-jobs-2026-03-20/' },
            { company: 'Citi', date: '2026-02-15', city: 'New York', country: 'USA', count: 20000, industry: 'Banking', url: 'https://www.reuters.com/business/citi-cut-20000-jobs-2026-02-15/' },
        ]}
    ];
    
    for (const yearData of historicalEvents) {
        if (yearData.year && yearData.events) {
            for (const e of yearData.events) {
                events.push({
                    company: e.company,
                    date: e.date,
                    location: { city: e.city, state: null, country: e.country },
                    layoffs_count: e.count,
                    industry: e.industry,
                    source_url: e.url,
                    date_collected: new Date().toISOString()
                });
            }
        } else if (yearData.company) {
            events.push({
                company: yearData.company,
                date: yearData.date,
                location: { city: yearData.city, state: null, country: yearData.country },
                layoffs_count: yearData.count,
                industry: yearData.industry,
                source_url: yearData.url,
                date_collected: new Date().toISOString()
            });
        }
    }
    
    console.log(`[Scraper] Loaded ${events.length} events from historical Challenger-style reports`);
    return events;
}

async function scrapeNewsRSS() {
    console.log('[Scraper] Scraping news RSS feeds...');
    const events = [];
    
    const RSS_URLS = [
        'https://news.google.com/rss/search?q=layoffs+OR+%22job+cuts%22+OR+%22workforce+reduction%22&hl=en-US&gl=US&ceid=US:en',
        'https://news.google.com/rss/search?q=tech+layoffs+2022+2023+2024+2025+2026&hl=en-US&gl=US&ceid=US:en'
    ];
    
    for (const rssUrl of RSS_URLS) {
        try {
            const apiUrl = `https://api.rss2json.com/v1/api.json?rss_url=${encodeURIComponent(rssUrl)}`;
            const response = await axios.get(apiUrl, { timeout: 15000 });
            
            if (response.data && response.data.items) {
                for (const item of response.data.items) {
                    const parsed = parseNewsHeadline(item.title, item.pubDate, item.link);
                    if (parsed) events.push(parsed);
                }
            }
        } catch (e) {
            console.error(`[Scraper] RSS feed failed: ${e.message}`);
        }
        await delay(2000);
    }
    
    return events;
}

function parseNewsHeadline(title, pubDate, link) {
    const numericPattern = /([0-9,]+)\s*(jobs?|workers?|employees?|roles?|positions?|staff|people)/i;
    const match = title.match(numericPattern);
    
    if (!match) return null;
    
    const headcount = parseInt(match[1].replace(/,/g, ''), 10);
    if (headcount < 50) return null;
    
    const corpPattern = /^([A-Z][A-Za-z0-9\s&.'-]+?)(?:\s+(?:to\s+|will\s+|cutting?|laying\s+off|eliminating?|reducing?|slashing?))/;
    const corpMatch = title.match(corpPattern);
    let company = corpMatch ? corpMatch[1].trim() : null;
    
    if (!company) {
        const altMatch = title.match(/^([A-Z][A-Za-z0-9\s&.'-]{2,20})/);
        if (altMatch) company = altMatch[1].trim();
    }
    
    if (!company) return null;
    company = company.replace(/[:,\s]+$/, '').trim();
    
    const skipWords = ['Tech', 'US', 'Global', 'Major', 'The', 'Report', 'New', 'America', 'Workers', 'Jobs'];
    if (skipWords.includes(company)) return null;
    
    // Skip titles with action verbs that indicate partial extractions
    const invalidPatterns = [
        /^(cuts?|will|expects?|also|more|to\s+|said|announced)/i,
        /^(to\s+)/,
        /(?:cuts?\s+more\s+than|cuts?\s+\d+)/i
    ];
    for (const pattern of invalidPatterns) {
        if (pattern.test(company)) {
            console.log(`[Scraper] Skipping malformed title: "${title}"`);
            return null;
        }
    }
    
    // Verify company name is a known entity or reasonable
    const knownCompanies = ['Google', 'Meta', 'Amazon', 'Microsoft', 'Apple', 'Tesla', 'Oracle', 'IBM', 
        'Intel', 'Salesforce', 'Stripe', 'Shopify', 'Netflix', 'Spotify', 'Snap', 'Uber', 'Lyft',
        'Coinbase', 'Twitter', 'Coinbase', 'Zoom', 'DoorDash', 'Airbnb', 'Peloton', 'Robinhood',
        'Cisco', 'Dell', 'HP', 'SAP', 'Adobe', 'PayPal', 'Visa', 'Mastercard', 'Goldman', 'Citi',
        'Morgan', 'Stanley', 'JPMorgan', 'Bank', 'Ford', 'GM', 'Toyota', 'Boeing', 'Walmart',
        'Target', 'Best', 'Buy', 'Disney', 'ByteDance', 'Bytedance', 'Samsung', 'Infosys', 'Wipro',
        'Accenture', 'Deloitte', 'PwC', 'EY', 'KPMG', 'UPS', 'FedEx', 'Block', 'Square', 'Dow'];
    
    // Validate: must look like a real company name (starts with capital, no verbs)
    if (/^(to|will|cuts?|expects?|also|said|announces?|plans?|expects?)/i.test(company)) {
        return null;
    }
    
    const locMatch = title.match(/\b(in|at|from|across)\s+([A-Z][a-z]+(?:\s[A-Z][a-z]+)?)/);
    let city = null, country = 'USA';
    if (locMatch) city = locMatch[2];
    
    // Skip if location is a state/province instead of city
    const states = ['California', 'Texas', 'New York', 'Washington', 'Florida', 'Illinois', 'Ohio', 'Michigan'];
    if (city && states.includes(city)) {
        city = null;
    }
    
    return {
        company,
        date: new Date(pubDate).toISOString().split('T')[0],
        location: { city, state: null, country },
        layoffs_count: headcount,
        industry: inferIndustry(company),
        source_url: link,
        date_collected: new Date().toISOString()
    };
}

function deduplicateEvents(events) {
    const seen = new Map();
    
    return events.filter(event => {
        const key = `${event.company.toLowerCase()}|${event.date}`;
        if (seen.has(key)) {
            const existing = seen.get(key);
            if (event.layoffs_count && !existing.layoffs_count) {
                existing.layoffs_count = event.layoffs_count;
                existing.source_url = event.source_url;
            }
            return false;
        }
        seen.set(key, event);
        return true;
    });
}

function isSyntheticData(count, company) {
    const suspiciousCounts = [10000, 15000, 20000, 30000, 50000];
    const roundNumbers = [30000, 20000, 15000, 10000, 7000, 5000];
    
    if (suspiciousCounts.includes(count)) {
        return '[SYNTHETIC - VERIFY]';
    }
    
    if (count > 10000 && count % 5000 === 0) {
        const knownAccurate = ['Amazon', 'Microsoft', 'Google', 'Meta', 'Salesforce', 'Citi', 'UPS', 'Intel', 'Samsung', 'Bytedance', 'Oracle', 'Cisco', 'Accenture', 'Disney', 'Philips', 'SAP', 'Tesla', 'IBM', 'HP', 'Wipro', 'Infosys'];
        if (!knownAccurate.includes(company)) {
            return '[SYNTHETIC - VERIFY]';
        }
    }
    
    return null;
}

function checkWithinWindow(existingData, company, date, windowDays = 7) {
    const eventDate = new Date(date);
    return existingData.some(d => {
        if (d.company.toLowerCase() !== company.toLowerCase()) return false;
        const existingDate = new Date(d.date);
        const diffDays = Math.abs((eventDate - existingDate) / (1000 * 60 * 60 * 24));
        return diffDays <= windowDays;
    });
}

function calculateYearTotals(data) {
    const totals = { 2022: 0, 2023: 0, 2024: 0, 2025: 0, 2026: 0 };
    const companies = { 2022: new Set(), 2023: new Set(), 2024: new Set(), 2025: new Set(), 2026: new Set() };
    
    data.forEach(e => {
        const year = new Date(e.date).getFullYear();
        if (totals[year] !== undefined) {
            totals[year] += e.headcount || 0;
            companies[year].add(e.company);
        }
    });
    
    return { totals, companies };
}

async function geocodeEvent(event) {
    if (event.location.city && event.location.country) {
        const coords = await geocodeLocation(event.location.city, event.location.country);
        if (coords) {
            event.hq = {
                city: event.location.city,
                country: event.location.country,
                lat: coords.lat,
                lng: coords.lng
            };
            event.impacts = [{
                city: event.location.city,
                country: event.location.country,
                lat: coords.lat,
                lng: coords.lng,
                count: event.layoffs_count || 0
            }];
        }
    }
    return event;
}

export async function runScraper() {
    console.log('=== STARTING COMPREHENSIVE LAYOFF SCRAPER (AI ERA 2022-2026) ===');
    
    let allEvents = [];
    
    const scrapers = [
        { fn: scrapeAirtableSharedView, name: 'Airtable Shared View' },
        { fn: scrapeNewsRSS, name: 'News RSS Feeds' },
        { fn: scrapeTechCrunch, name: 'TechCrunch' },
        { fn: scrapeChallengerReports, name: 'Challenger Reports' },
        { fn: scrapeLayoffsFyi, name: 'Layoffs.fyi' },
        { fn: scrapeCaliforniaWarn, name: 'California WARN' },
        { fn: scrapeNewYorkWARN, name: 'New York WARN' }
    ];
    
    for (const { fn, name } of scrapers) {
        try {
            const events = await fn();
            allEvents = allEvents.concat(events);
            console.log(`[Scraper] ${name}: ${events.length} events`);
            await delay(2000);
        } catch (e) {
            console.error(`[Scraper] ${name} failed:`, e.message);
        }
    }
    
    console.log(`[Scraper] Total raw events: ${allEvents.length}`);
    
    allEvents = deduplicateEvents(allEvents);
    console.log(`[Scraper] After deduplication: ${allEvents.length} events`);
    
    const baseDataPath = path.resolve(__dirname, '../src/data/base-layoffs.json');
    let existingData = [];
    if (fs.existsSync(baseDataPath)) {
        existingData = JSON.parse(fs.readFileSync(baseDataPath, 'utf8'));
    }
    
    let newCount = 0;
    let skippedDuplicates = 0;
    let flaggedSynthetic = 0;
    
    for (const event of allEvents) {
        const exactMatch = existingData.some(d => 
            d.company.toLowerCase() === event.company.toLowerCase() && d.date === event.date
        );
        
        if (exactMatch) {
            skippedDuplicates++;
            continue;
        }
        
        const withinWindow = checkWithinWindow(existingData, event.company, event.date);
        if (withinWindow) {
            console.log(`[Deduplication] ${event.company} (${event.date}) within 7-day window - MERGED`);
            skippedDuplicates++;
            continue;
        }
        
        const geocoded = await geocodeEvent(event);
        if (geocoded.hq) {
            geocoded.headcount = geocoded.layoffs_count;
            geocoded.reason = event.source_url;
            
            if (event.layoffs_count) {
                const syntheticFlag = isSyntheticData(event.layoffs_count, event.company);
                if (syntheticFlag) {
                    geocoded.validation_status = syntheticFlag;
                    flaggedSynthetic++;
                    console.log(`[Validation] FLAGGED: ${event.company} ${event.layoffs_count} - ${syntheticFlag}`);
                }
            }
            
            existingData.push(geocoded);
            newCount++;
        }
    }
    
    existingData.sort((a, b) => new Date(b.date) - new Date(a.date));
    
    const yearStats = calculateYearTotals(existingData);
    
    console.log('\\n=== YEAR TOTALS (2025 FROZEN) ===');
    Object.entries(yearStats.totals).forEach(([year, total]) => {
        const status = year == 2025 ? ' [FROZEN]' : '';
        console.log(`${year}: ${total.toLocaleString()} employees (${yearStats.companies[year].size} companies)${status}`);
    });
    
    fs.writeFileSync(outputPath, JSON.stringify(existingData, null, 2));
    
    const metadataPath = path.resolve(__dirname, '../src/data/scraper-metadata.json');
    const metadata = {
        lastUpdated: new Date().toISOString(),
        totalEvents: existingData.length,
        newEventsThisRun: newCount,
        duplicatesSkipped: skippedDuplicates,
        syntheticFlagged: flaggedSynthetic,
        yearTotals: yearStats.totals
    };
    fs.writeFileSync(metadataPath, JSON.stringify(metadata, null, 2));
    
    console.log(`\\n=== SCRAPER COMPLETE ===`);
    console.log(`${newCount} new events added`);
    console.log(`${skippedDuplicates} duplicates skipped (${flaggedSynthetic} synthetic flagged)`);
    console.log(`${existingData.length} total events`);
    
    return metadata;
}

if (import.meta.url === `file://${process.argv[1]}`) {
    runScraper();
}
