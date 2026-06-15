FROM node:22-alpine

WORKDIR /app

COPY package*.json ./
RUN npm ci --omit=dev

COPY . .

RUN npm run build

EXPOSE 3000 5173

ENV PORT=3000
ENV DATA_DIR=src/data
ENV DATA_FILE=layoffs-live.json
ENV FALLBACK_FILE=base-layoffs.json
ENV CRON_SCHEDULE=0\ 2\ *\ *\ *

CMD ["sh", "-c", "node server/index.js & npm run preview -- --port 5173 --host 0.0.0.0"]
