import fs from 'fs/promises';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const outputPath = path.resolve(__dirname, '../src/data/base-layoffs.json');

// Historical verified global events
const historicalData = [
    // 2026 Mega Events
    { c: "Oracle", ind: "Technology", num: 30000, d: "2026-03-31", lat: 30.2672, lng: -97.7431, loc: "Austin, USA", r: "AI Infrastructure shift" },
    { c: "TCS", ind: "IT Services", num: 10000, d: "2026-03-10", lat: 19.0760, lng: 72.8777, loc: "Mumbai, India" },
    { c: "Infosys", ind: "IT Services", num: 8000, d: "2026-03-20", lat: 12.9716, lng: 77.5946, loc: "Bangalore, India" },
    { c: "Cisco", ind: "Networking", num: 5500, d: "2026-03-15", lat: 37.3382, lng: -121.8863, loc: "San Jose, USA" },
    { c: "Samsung", ind: "Electronics", num: 6000, d: "2026-01-25", lat: 37.5665, lng: 126.9780, loc: "Seoul, South Korea" },
    { c: "Bayer", ind: "Healthcare", num: 1500, d: "2026-03-05", lat: 51.0459, lng: 6.9829, loc: "Leverkusen, Germany" },
    { c: "Stellantis", ind: "Manufacturing", num: 3500, d: "2026-02-10", lat: 52.3676, lng: 4.9041, loc: "Amsterdam, Netherlands" },
    { c: "Macy's", ind: "Retail", num: 2300, d: "2026-01-20", lat: 40.7128, lng: -74.0060, loc: "New York, USA" },
    { c: "Atlassian", ind: "Enterprise Software", num: 500, d: "2026-04-01", lat: -33.8688, lng: 151.2093, loc: "Sydney, Australia" },

    // 2024 Mass Events
    { c: "Intel", ind: "Semiconductors", num: 15000, d: "2024-08-01", lat: 37.3541, lng: -121.9552, loc: "Santa Clara, USA" },
    { c: "Tesla", ind: "Automotive", num: 14000, d: "2024-04-15", lat: 30.2672, lng: -97.7431, loc: "Austin, USA" },
    { c: "Cisco", ind: "Networking", num: 4000, d: "2024-02-14", lat: 37.3382, lng: -121.8863, loc: "San Jose, USA" },
    { c: "PayPal", ind: "Finance", num: 2500, d: "2024-01-30", lat: 37.3382, lng: -121.8863, loc: "San Jose, USA" },
    { c: "Microsoft", ind: "Technology", num: 1900, d: "2024-01-25", lat: 47.6740, lng: -122.1215, loc: "Redmond, USA" },
    { c: "Google", ind: "Technology", num: 1000, d: "2024-01-10", lat: 37.3861, lng: -122.0839, loc: "Mountain View, USA" },
    { c: "Twitch", ind: "Consumer", num: 500, d: "2024-01-09", lat: 37.7749, lng: -122.4194, loc: "San Francisco, USA" },
    { c: "Unity", ind: "Gaming", num: 1800, d: "2024-01-08", lat: 37.7749, lng: -122.4194, loc: "San Francisco, USA" },

    // 2023 Mass Events
    { c: "Amazon", ind: "E-Commerce", num: 9000, d: "2023-03-20", lat: 47.6062, lng: -122.3321, loc: "Seattle, USA" },
    { c: "Accenture", ind: "Consulting", num: 19000, d: "2023-03-23", lat: 53.3498, lng: -6.2603, loc: "Dublin, Ireland" },
    { c: "Ericsson", ind: "Telecom", num: 8500, d: "2023-02-24", lat: 59.3293, lng: 18.0686, loc: "Stockholm, Sweden" },
    { c: "Dell", ind: "Technology", num: 6650, d: "2023-02-06", lat: 30.5083, lng: -97.6789, loc: "Round Rock, USA" },
    { c: "IBM", ind: "Enterprise Software", num: 3900, d: "2023-01-25", lat: 41.1062, lng: -73.7087, loc: "Armonk, USA" },
    { c: "SAP", ind: "Enterprise Software", num: 3000, d: "2023-01-26", lat: 49.3000, lng: 8.6333, loc: "Walldorf, Germany" },
    { c: "Google", ind: "Technology", num: 12000, d: "2023-01-20", lat: 37.3861, lng: -122.0839, loc: "Mountain View, USA" },
    { c: "Microsoft", ind: "Technology", num: 10000, d: "2023-01-18", lat: 47.6740, lng: -122.1215, loc: "Redmond, USA" },
    { c: "Amazon", ind: "E-Commerce", num: 18000, d: "2023-01-04", lat: 47.6062, lng: -122.3321, loc: "Seattle, USA" },
    { c: "Salesforce", ind: "Enterprise Software", num: 8000, d: "2023-01-04", lat: 37.7749, lng: -122.4194, loc: "San Francisco, USA" },
    { c: "Philips", ind: "Healthcare", num: 6000, d: "2023-01-30", lat: 52.3676, lng: 4.9041, loc: "Amsterdam, Netherlands" },

    // 2022 Mass Events
    { c: "Meta", ind: "Social Media", num: 11000, d: "2022-11-09", lat: 37.4530, lng: -122.1817, loc: "Menlo Park, USA" },
    { c: "Twitter", ind: "Social Media", num: 3700, d: "2022-11-04", lat: 37.7749, lng: -122.4194, loc: "San Francisco, USA" },
    { c: "Stripe", ind: "Finance", num: 1000, d: "2022-11-03", lat: 37.7749, lng: -122.4194, loc: "San Francisco, USA" },
    { c: "Snap", ind: "Social Media", num: 1200, d: "2022-08-31", lat: 34.0522, lng: -118.2437, loc: "Santa Monica, USA" },
    { c: "Shopify", ind: "E-Commerce", num: 1000, d: "2022-07-26", lat: 45.4215, lng: -75.6972, loc: "Ottawa, Canada" },
    { c: "Coinbase", ind: "Crypto", num: 1100, d: "2022-06-14", lat: 37.7749, lng: -122.4194, loc: "San Francisco, USA" },
    { c: "Better.com", ind: "Real Estate", num: 3000, d: "2022-03-08", lat: 40.7128, lng: -74.0060, loc: "New York, USA" },
    { c: "Peloton", ind: "Fitness", num: 2800, d: "2022-02-08", lat: 40.7128, lng: -74.0060, loc: "New York, USA" }
];

// Transform into the relational schema (HQ + Impacts) expected by the Globe Visualizer
const masterDataset = historicalData.map(d => {
    const [cityName, countryName] = d.loc.split(', ');
    return {
        company: d.c,
        industry: d.ind,
        headcount: d.num,
        date: d.d,
        hq: {
            city: cityName,
            country: countryName,
            lat: d.lat,
            lng: d.lng
        },
        // We assume mostly local impact for small companies, but for large ones we could add simulated arcs
        impacts: [{ city: cityName, country: countryName, lat: d.lat, lng: d.lng, count: d.num }],
        reason: d.r || "Macroeconomic restructuring"
    };
});

// Sort by date descending
masterDataset.sort((a, b) => new Date(b.date) - new Date(a.date));

await fs.writeFile(outputPath, JSON.stringify(masterDataset, null, 2));
console.log(`Generated and wrote ${masterDataset.length} comprehensive events to base-layoffs.json.`);
