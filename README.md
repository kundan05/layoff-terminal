# Layoff Terminal

**Global AI-Era Workforce Disruption Tracker**

A Bloomberg-style real-time terminal tracking global tech layoffs since the AI era began. This project features an interactive 3D globe, live data scraping, and comprehensive analytics, presented in a retro-futuristic terminal interface.

![Layoff Terminal](public/favicon.svg)

## Features

* **Bloomberg-Style Interface:** A high-density data terminal UI with real-time tickers, live feeds, and retro aesthetic.
* **Interactive 3D Globe:** Visualizes layoff events geographically using Three.js and TopoJSON.
* **Real-time Analytics:** Tracks total employees laid off and events over time.
* **Live News Feed:** Aggregates the latest AI and tech layoff news.
* **Search & Filtering:** Search companies, industries, and locations.
* **Boot Sequence:** An immersive boot-up animation to set the terminal mood.

## Tech Stack

* **Frontend:** Vanilla JS, HTML, CSS (Retro Terminal Theme)
* **3D Visualization:** Three.js, TopoJSON
* **Backend Data Processing:** Node.js, Express, Cheerio (for web scraping), node-cron
* **Build Tool:** Vite
* **Containerization:** Docker

## Getting Started

### Prerequisites

* Node.js (v18+)
* Docker (optional)

### Local Development

1. Clone the repository:
   ```bash
   git clone https://github.com/kundan05/layoff-terminal.git
   cd layoff-terminal
   ```

2. Install dependencies:
   ```bash
   npm install
   ```

3. Start the development server and backend:
   ```bash
   npm run dev
   ```

4. Open your browser and navigate to `http://localhost:5173`.

### Docker Deployment

1. Build the Docker image:
   ```bash
   npm run docker-build
   # or
   docker build -t layoff-terminal .
   ```

2. Run the container:
   ```bash
   npm run docker-run
   # or
   docker run -p 3000:3000 -p 5173:5173 layoff-terminal
   ```

## Backend Services

The backend server periodically scrapes data sources and caches geocoding information to ensure the terminal runs smoothly and displays up-to-date data. The data is parsed into JSON format and served to the frontend.
