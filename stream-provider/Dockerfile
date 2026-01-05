FROM node:20

# Install dependencies for native modules (better-sqlite3)
RUN apt-get update && apt-get install -y python3 make g++ && rm -rf /var/lib/apt/lists/*

WORKDIR /app

# Copy package.json
COPY package.json ./

# Install deps
RUN npm install --production

# Copy source
COPY . .

# Expose port (default 7000 for stream provider?)
EXPOSE 7000

# Start
CMD ["node", "index.js"]
