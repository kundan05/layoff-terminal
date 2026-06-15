import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

const majorLayoffs = [
  // 2026 Major Layoffs - Already have some, adding comprehensive list
  {
    company: "Volkswagen Group",
    industry: "Automotive",
    headcount: 50000,
    date: "2026-01-15",
    hq: { city: "Wolfsburg", country: "Germany", lat: 52.4220, lng: 10.7861 },
    reason: "EV transition and restructuring"
  },
  {
    company: "HSBC",
    industry: "Banking",
    headcount: 20000,
    date: "2026-02-10",
    hq: { city: "London", country: "UK", lat: 51.5074, lng: -0.1278 },
    reason: "Global reorganization"
  },
  {
    company: "Citigroup",
    industry: "Banking",
    headcount: 20000,
    date: "2026-02-05",
    hq: { city: "New York", country: "USA", lat: 40.7128, lng: -74.006 },
    reason: "Cost reduction"
  },
  {
    company: "Nestlé",
    industry: "Consumer Goods",
    headcount: 16000,
    date: "2026-01-20",
    hq: { city: "Vevey", country: "Switzerland", lat: 46.4614, lng: 6.8432 },
    reason: "Portfolio optimization"
  },
  {
    company: "Nokia",
    industry: "Telecommunications",
    headcount: 14000,
    date: "2026-02-28",
    hq: { city: "Espoo", country: "Finland", lat: 60.2054, lng: 24.6614 },
    reason: "5G market pressures"
  },
  {
    company: "Kyndryl",
    industry: "IT Services",
    headcount: 10000,
    date: "2026-03-10",
    hq: { city: "New York", country: "USA", lat: 40.7128, lng: -74.006 },
    reason: "Market restructuring"
  },
  {
    company: "Chevron",
    industry: "Energy",
    headcount: 8000,
    date: "2026-02-15",
    hq: { city: "San Ramon", country: "USA", lat: 37.7689, lng: -121.9845 },
    reason: "Oil market volatility"
  },
  {
    company: "Heineken",
    industry: "Beverages",
    headcount: 6000,
    date: "2026-03-05",
    hq: { city: "Amsterdam", country: "Netherlands", lat: 52.3676, lng: 4.9041 },
    reason: "Efficiency drive"
  },
  {
    company: "Tyson Foods",
    industry: "Food Production",
    headcount: 4900,
    date: "2026-03-15",
    hq: { city: "Springdale", country: "USA", lat: 36.3856, lng: -94.2485 },
    reason: "Automation transition"
  },
  {
    company: "Commerzbank",
    industry: "Banking",
    headcount: 3900,
    date: "2026-02-20",
    hq: { city: "Frankfurt", country: "Germany", lat: 50.1109, lng: 8.6821 },
    reason: "Digital transformation"
  },
  {
    company: "Viatris",
    industry: "Pharmaceuticals",
    headcount: 3200,
    date: "2026-03-12",
    hq: { city: "Canonsburg", country: "USA", lat: 40.2682, lng: -80.2592 },
    reason: "Portfolio consolidation"
  },
  {
    company: "TCS",
    industry: "IT Services",
    headcount: 23460,
    date: "2026-02-25",
    hq: { city: "Mumbai", country: "India", lat: 19.0760, lng: 72.8777 },
    reason: "Skill realignment"
  },
  {
    company: "Cognizant",
    industry: "IT Services",
    headcount: 15000,
    date: "2026-03-08",
    hq: { city: "Jersey City", country: "USA", lat: 40.7178, lng: -74.0431 },
    reason: "AI optimization"
  },
  {
    company: "Atlassian",
    industry: "Software",
    headcount: 1600,
    date: "2026-03-11",
    hq: { city: "Sydney", country: "Australia", lat: -33.8688, lng: 151.2093 },
    reason: "Overexpansion correction"
  },
  {
    company: "Goldman Sachs",
    industry: "Finance",
    headcount: 1500,
    date: "2026-03-20",
    hq: { city: "New York", country: "USA", lat: 40.7128, lng: -74.006 },
    reason: "Market conditions"
  },
  {
    company: "Nike",
    industry: "Apparel",
    headcount: 1400,
    date: "2026-04-05",
    hq: { city: "Beaverton", country: "USA", lat: 45.5017, lng: -122.8093 },
    reason: "Direct-to-consumer shift"
  },
  {
    company: "General Motors",
    industry: "Automotive",
    headcount: 1140,
    date: "2026-03-25",
    hq: { city: "Detroit", country: "USA", lat: 42.3314, lng: -83.0458 },
    reason: "EV transition"
  },
  {
    company: "Cloudflare",
    industry: "Cloud Infrastructure",
    headcount: 1100,
    date: "2026-04-10",
    hq: { city: "San Francisco", country: "USA", lat: 37.7749, lng: -122.4194 },
    reason: "Efficiency improvement"
  },
  {
    company: "WiseTech Global",
    industry: "Software",
    headcount: 2000,
    date: "2026-02-24",
    hq: { city: "Sydney", country: "Australia", lat: -33.8688, lng: 151.2093 },
    reason: "Strategic consolidation"
  },
  {
    company: "Ocado",
    industry: "E-commerce",
    headcount: 1000,
    date: "2026-02-26",
    hq: { city: "Hatfield", country: "UK", lat: 51.7592, lng: -0.2309 },
    reason: "Logistics efficiency"
  },
  {
    company: "Snap",
    industry: "Social Media",
    headcount: 1000,
    date: "2026-04-15",
    hq: { city: "Santa Monica", country: "USA", lat: 34.0195, lng: -118.4912 },
    reason: "User engagement focus"
  },
  {
    company: "UKG",
    industry: "Software",
    headcount: 950,
    date: "2026-04-15",
    hq: { city: "Atlanta", country: "USA", lat: 33.7490, lng: -84.3880 },
    reason: "AI integration"
  },
  {
    company: "Sapiens",
    industry: "Software",
    headcount: 700,
    date: "2026-12-28",
    hq: { city: "Holon", country: "Israel", lat: 32.0052, lng: 34.7645 },
    reason: "Market adjustment"
  },
  {
    company: "Plavtika",
    industry: "Technology",
    headcount: 500,
    date: "2026-04-14",
    hq: { city: "Toronto", country: "Canada", lat: 43.6532, lng: -79.3832 },
    reason: "Restructuring"
  }
];

const dataPath = path.resolve(__dirname, '../src/data/layoffs-live.json');
let existingData = [];

try {
  const fileContent = fs.readFileSync(dataPath, 'utf8');
  existingData = JSON.parse(fileContent);
} catch (e) {
  console.log('No existing data found, starting fresh');
}

// Create a map of existing companies by name for deduplication
const existingMap = new Map();
existingData.forEach(item => {
  const key = `${item.company}-${item.date}`;
  existingMap.set(key, item);
});

// Add new major layoffs
majorLayoffs.forEach(layoff => {
  const key = `${layoff.company}-${layoff.date}`;
  if (!existingMap.has(key)) {
    const entry = {
      company: layoff.company,
      industry: layoff.industry,
      headcount: layoff.headcount,
      date: layoff.date,
      hq: {
        city: layoff.hq.city,
        country: layoff.hq.country,
        lat: layoff.hq.lat,
        lng: layoff.hq.lng
      },
      impacts: [{
        city: layoff.hq.city,
        country: layoff.hq.country,
        lat: layoff.hq.lat,
        lng: layoff.hq.lng,
        count: layoff.headcount
      }],
      reason: layoff.reason,
      source_url: "https://www.layoffs.fyi/"
    };
    existingData.push(entry);
    console.log(`Added: ${layoff.company} - ${layoff.headcount} on ${layoff.date}`);
  }
});

// Sort by date descending
existingData.sort((a, b) => new Date(b.date) - new Date(a.date));

// Write updated data
fs.writeFileSync(dataPath, JSON.stringify(existingData, null, 2));

// Calculate totals
const totalHeadcount = existingData.reduce((sum, item) => sum + (item.headcount || 0), 0);
const totalEvents = existingData.length;

console.log(`\n✓ Updated data file`);
console.log(`Total events: ${totalEvents}`);
console.log(`Total headcount affected: ${totalHeadcount.toLocaleString()}`);

