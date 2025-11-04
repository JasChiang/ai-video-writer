# Multi-stage Dockerfile for local testing
# - Builds the React frontend with Vite
# - Runs the Express backend (server.js)
# - Includes ffmpeg and yt-dlp for video processing

########################################
# Builder: install deps and build frontend
########################################
FROM node:20-bookworm-slim AS builder
WORKDIR /app

# Install dependencies first (better layer caching)
COPY package*.json ./
RUN npm ci

# Copy source and build
COPY . .
RUN npm run build

########################################
# Runner: production image
########################################
FROM node:20-bookworm-slim AS runner
WORKDIR /app

ENV NODE_ENV=production

# Install video processing deps
# - ffmpeg from Debian repo
# - yt-dlp via pip (get the latest release)
# Note: --break-system-packages is safe in Docker containers (isolated environment)
RUN apt-get update \
    && apt-get install -y --no-install-recommends \
       ffmpeg \
       python3 \
       python3-pip \
       ca-certificates \
    && rm -rf /var/lib/apt/lists/* \
    && pip3 install --break-system-packages --no-cache-dir -U yt-dlp

# Install production node deps
COPY package*.json ./
RUN npm ci --omit=dev

# Copy server code and built assets
COPY --from=builder /app/server.js ./server.js
COPY --from=builder /app/services ./services
COPY --from=builder /app/dist ./dist
# Create runtime folders if not present in source
RUN mkdir -p public/images temp_videos

# Optional: expose internal port (server.js currently uses 3001)
EXPOSE 3001

# Note: GEMINI_API_KEY must be provided at runtime (env or env-file)
CMD ["node", "server.js"]
