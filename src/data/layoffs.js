export let lastUpdated = null;
export let rawLayoffs = [];
export let layoffData = [];

export async function loadLayoffData() {
  try {
    const res = await fetch('/api/layoffs');
    if (res.ok) {
      const data = await res.json();
      rawLayoffs = data.events;
      lastUpdated = data.lastUpdated;
    } else {
      console.warn("Failed to fetch fresh data, falling back...");
      throw new Error("API Fetch Failed");
    }
  } catch (e) {
    console.error("Backend unreachable. Ensure server/index.js is running.");
    // Emergency static fallback if backend is down
    rawLayoffs = [
      { company: "Oracle", industry: "Technology", headcount: 30000, date: "2026-03-31", hq: { city: "Austin", country: "USA", lat: 30.2672, lng: -97.7431 }, impacts: [{ city: "Austin", country: "USA", lat: 30.2672, lng: -97.7431, count: 18000 }, { city: "Bangalore", country: "India", lat: 12.9716, lng: 77.5946, count: 12000 }], reason: "Restructuring and aggressive shift toward AI infrastructure computing" }
    ];
  }

  layoffData = rawLayoffs.map(d => {
    return {
      company: d.company,
      industry: d.industry,
      headcount: d.headcount,
      date: d.date,
      city: d.hq.city,
      country: d.hq.country,
      lat: d.hq.lat,
      lng: d.hq.lng,
      reason: d.reason,
      source_url: d.source_url
    };
  });
}

// Aggregate stats logic (same as before)
export function getStats() {
  const total = rawLayoffs.reduce((sum, d) => sum + d.headcount, 0);
  const byYear = {};
  const byIndustry = {};
  const byCompany = {};
  const byCountry = {};

  rawLayoffs.forEach(d => {
    const year = d.date?.substring(0, 4);
    byYear[year] = (byYear[year] || 0) + d.headcount;
    byIndustry[d.industry] = (byIndustry[d.industry] || 0) + d.headcount;
    byCompany[d.company] = (byCompany[d.company] || 0) + d.headcount;
    if (d.impacts) {
      d.impacts.forEach(imp => {
        byCountry[imp.country] = (byCountry[imp.country] || 0) + imp.count;
      });
    }
  });

  const topCompanies = Object.entries(byCompany).sort((a, b) => b[1] - a[1]).slice(0, 15);
  const topIndustries = Object.entries(byIndustry).sort((a, b) => b[1] - a[1]);
  const topCountries = Object.entries(byCountry).sort((a, b) => b[1] - a[1]);

  return { total, byYear, byIndustry, byCompany, byCountry, topCompanies, topIndustries, topCountries, count: rawLayoffs.length };
}
