FROM node:20-slim

WORKDIR /app

COPY package*.json ./
# Install deps for native modules (sqlite3) and Puppeteer (chromium)
RUN apt-get update && apt-get install -y \
    python3 make g++ \
    chromium \
    xvfb \
    xauth \
    fonts-ipafont-gothic fonts-wqy-zenhei fonts-thai-tlwg fonts-kacst fonts-freefont-ttf libxss1 \
    --no-install-recommends \
    && rm -rf /var/lib/apt/lists/*

ENV PUPPETEER_SKIP_CHROMIUM_DOWNLOAD=true
ENV PUPPETEER_EXECUTABLE_PATH=/usr/bin/chromium
# Display for Xvfb
ENV DISPLAY=:99

RUN npm install --production

COPY . .

EXPOSE 3000

# Start with Xvfb
CMD ["xvfb-run", "--auto-servernum", "--server-num=1", "--server-args='-screen 0 1280x800x24'", "npm", "start"]
