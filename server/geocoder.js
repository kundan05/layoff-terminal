import axios from 'axios';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const cacheFile = path.resolve(__dirname, 'geocodeCache.json');

// Memory cache
let cache = {};

// Load cache from disk
if (fs.existsSync(cacheFile)) {
    try {
        cache = JSON.parse(fs.readFileSync(cacheFile, 'utf8'));
    } catch (e) {
        console.warn("Geocode cache corrupted, starting fresh.");
    }
}

// Helper to delay
const delay = ms => new Promise(resolve => setTimeout(resolve, ms));

const STATIC_GEO_DB = {
    "New York City": { lat: 40.7128, lng: -74.0060 },
    "New York": { lat: 40.7128, lng: -74.0060 },
    "San Francisco": { lat: 37.7749, lng: -122.4194 },
    "SF Bay Area": { lat: 37.7749, lng: -122.4194 },
    "Seattle": { lat: 47.6062, lng: -122.3321 },
    "Austin": { lat: 30.2672, lng: -97.7431 },
    "Mountain View": { lat: 37.3861, lng: -122.0839 },
    "Menlo Park": { lat: 37.4530, lng: -122.1817 },
    "Palo Alto": { lat: 37.4419, lng: -122.1430 },
    "Santa Clara": { lat: 37.3541, lng: -121.9552 },
    "San Jose": { lat: 37.3382, lng: -121.8863 },
    "Los Angeles": { lat: 34.0522, lng: -118.2437 },
    "Boston": { lat: 42.3601, lng: -71.0589 },
    "Chicago": { lat: 41.8781, lng: -87.6298 },
    "London": { lat: 51.5074, lng: -0.1278 },
    "Manchester": { lat: 53.4808, lng: -2.2426 },
    "Dublin": { lat: 53.3498, lng: -6.2603 },
    "Paris": { lat: 48.8566, lng: 2.3522 },
    "Berlin": { lat: 52.5200, lng: 13.4050 },
    "Munich": { lat: 48.1351, lng: 11.5820 },
    "Amsterdam": { lat: 52.3676, lng: 4.9041 },
    "Stockholm": { lat: 59.3293, lng: 18.0686 },
    "Tel Aviv": { lat: 32.0853, lng: 34.7818 },
    "Bengaluru": { lat: 12.9716, lng: 77.5946 },
    "Bangalore": { lat: 12.9716, lng: 77.5946 },
    "Mumbai": { lat: 19.0760, lng: 72.8777 },
    "Pune": { lat: 18.5204, lng: 73.8567 },
    "Hyderabad": { lat: 17.3850, lng: 78.4867 },
    "Chennai": { lat: 13.0827, lng: 80.2707 },
    "Singapore": { lat: 1.3521, lng: 103.8198 },
    "Sydney": { lat: -33.8688, lng: 151.2093 },
    "Melbourne": { lat: -37.8136, lng: 144.9631 },
    "Toronto": { lat: 43.6532, lng: -79.3832 },
    "Vancouver": { lat: 49.2827, lng: -123.1207 },
    "Tokyo": { lat: 35.6762, lng: 139.6503 },
    "Shanghai": { lat: 31.2304, lng: 121.4737 },
    "Beijing": { lat: 39.9042, lng: 116.4074 },
    "Hong Kong": { lat: 22.3193, lng: 114.1694 },
    "Sao Paulo": { lat: -23.5505, lng: -46.6333 },
    "Dubai": { lat: 25.2048, lng: 55.2708 },
    "Jakarta": { lat: -6.2088, lng: 106.8456 }
};

export async function geocodeLocation(city, country) {
    if (!city || !country) return null;
    const query = `${city}, ${country}`;

    if (/^sel[A-Za-z0-9]+$/.test(city)) {
        console.warn(`[Geocoder] Skipping raw Airtable selector ID for: ${query}`);
        cache[query] = null;
        fs.writeFileSync(cacheFile, JSON.stringify(cache, null, 2));
        return null;
    }

    // Priority 1: Static Hub Database (Fast, reliable)
    if (STATIC_GEO_DB[city]) return STATIC_GEO_DB[city];

    // Priority 2: Local Persistence Cache
    if (query in cache) return cache[query];

    try {
        console.log(`[Geocoder] Resolving coordinates for: ${query}`);
        const url = `https://nominatim.openstreetmap.org/search?q=${encodeURIComponent(query)}&format=json&limit=1`;

        // Using a more browser-like User-Agent to reduce 403s
        const response = await axios.get(url, {
            headers: {
                'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36'
            }
        });

        if (response.data && response.data.length > 0) {
            const result = {
                lat: parseFloat(response.data[0].lat),
                lng: parseFloat(response.data[0].lon)
            };
            cache[query] = result;
            // Save cache synchronously for simplicity right now
            fs.writeFileSync(cacheFile, JSON.stringify(cache, null, 2));

            // Respect rate limits (1 req/sec according to TOS)
            await delay(1200);
            return result;
        } else {
            console.warn(`[Geocoder] Coordinates not found for ${query}`);
            cache[query] = null; // Cache misses so we don't spam
            fs.writeFileSync(cacheFile, JSON.stringify(cache, null, 2));
            await delay(1200);
            return null;
        }
    } catch (err) {
        console.error(`[Geocoder] Request failed for ${query}:`, err.message);
        return null;
    }
}
