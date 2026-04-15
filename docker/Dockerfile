# Multi-stage Dockerfile for AI Video Writer
# - Builds the React frontend with Vite
# - Runs the Express backend (server.js)
# - Includes ffmpeg and yt-dlp for video processing
#
# Security features:
# - Multi-stage build (smaller final image)
# - Non-root user
# - Minimal dependencies
# - No secrets in image layers

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

# Install video processing dependencies
# - ffmpeg: video processing and screenshot generation
# - yt-dlp: YouTube video download (latest version via pip)
# - python3-pip: required for yt-dlp
# - ca-certificates: SSL/TLS certificates for HTTPS
# Note: --break-system-packages is safe in Docker containers (isolated environment)
RUN apt-get update \
    && apt-get install -y --no-install-recommends \
       ffmpeg \
       python3 \
       python3-pip \
       ca-certificates \
       curl \
    && rm -rf /var/lib/apt/lists/* \
    && pip3 install --break-system-packages --no-cache-dir -U yt-dlp

# Create non-root user for security
RUN useradd -m -u 1001 -s /bin/bash appuser

# Install production node deps
COPY --chown=appuser:appuser package*.json ./
RUN npm ci --omit=dev && npm cache clean --force

# Copy server code and built assets
COPY --chown=appuser:appuser --from=builder /app/server.js ./server.js
COPY --chown=appuser:appuser --from=builder /app/services ./services
COPY --chown=appuser:appuser --from=builder /app/dist ./dist

# Create runtime folders with correct permissions
RUN mkdir -p public/images temp_videos temp_files \
    && chown -R appuser:appuser public/images temp_videos temp_files

# Switch to non-root user
USER appuser

# Expose port (server.js uses 3001 by default)
EXPOSE 3001

# Health check
HEALTHCHECK --interval=30s --timeout=10s --start-period=40s --retries=3 \
  CMD node -e "require('http').get('http://localhost:3001/app-config.js', (r) => process.exit(r.statusCode === 200 ? 0 : 1))"

# Start the server
# Environment variables must be provided at runtime:
# - GEMINI_API_KEY (required)
# - YOUTUBE_CLIENT_ID (required)
# - FRONTEND_URL (optional, defaults to http://localhost:3000)
# - NOTION_* (optional, for Notion integration)
CMD ["node", "server.js"]
