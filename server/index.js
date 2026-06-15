import express from 'express';
import cors from 'cors';
import cron from 'node-cron';
import fs from 'fs/promises';
import { existsSync } from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { runScraper } from './comprehensiveScraper.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
const PORT = process.env.PORT || 3000;

app.use(cors());
app.use(express.json());

const DATA_DIR = path.resolve(__dirname, '..', process.env.DATA_DIR || 'src/data');
const DATA_FILE = process.env.DATA_FILE || 'layoffs-live.json';
const FALLBACK_FILE = process.env.FALLBACK_FILE || 'base-layoffs.json';

async function readData() {
  const dataPath = path.join(DATA_DIR, DATA_FILE);
  const fallbackPath = path.join(DATA_DIR, FALLBACK_FILE);
  const targetPath = existsSync(dataPath) ? dataPath : fallbackPath;

  if (existsSync(targetPath)) {
    const [data, stats] = await Promise.all([
      fs.readFile(targetPath, 'utf8'),
      fs.stat(targetPath),
    ]);
    return { data: JSON.parse(data), mtime: stats.mtime };
  }
  return null;
}

cron.schedule(process.env.CRON_SCHEDULE || '0 2 * * *', async () => {
    console.log('[Cron] Running daily global layoff scraper at 02:00 UTC...');
    await runScraper();
});

app.get('/api/layoffs', async (req, res) => {
    try {
      const result = await readData();
      if (result) {
        res.json({ lastUpdated: result.mtime, events: result.data });
      } else {
        res.status(404).json({ error: "Data not found." });
      }
    } catch (e) {
      console.error('Error reading layoff data:', e);
      res.status(500).json({ error: "Failed to read data." });
    }
});

app.post('/api/scrape', async (req, res) => {
    try {
      await runScraper();
      res.json({ message: "Scraper completed successfully." });
    } catch (e) {
      console.error('Scraper failed:', e);
      res.status(500).json({ error: "Scraper failed." });
    }
});

app.listen(PORT, () => {
    console.log(`Layoff Terminal Backend API listening on port ${PORT}`);
    console.log(`Cron automated scraper scheduled every 24h.`);
});
