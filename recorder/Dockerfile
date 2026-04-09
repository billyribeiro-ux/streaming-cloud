# ---- Build stage ----
FROM node:22-alpine AS builder

# Install build dependencies for native modules (if any)
RUN apk add --no-cache python3 make g++

WORKDIR /app

# Install dependencies first (layer caching)
COPY package.json package-lock.json* ./
RUN npm ci --ignore-scripts

# Copy source and build
COPY tsconfig.json ./
COPY src/ ./src/
RUN npm run build

# ---- Runtime stage ----
FROM node:22-alpine

# Install ffmpeg (required for recording pipeline)
RUN apk add --no-cache ffmpeg

WORKDIR /app

# Copy only production dependencies
COPY package.json package-lock.json* ./
RUN npm ci --omit=dev --ignore-scripts

# Copy compiled output from builder
COPY --from=builder /app/dist ./dist

# Create recordings output directory
RUN mkdir -p /recordings && chown -R node:node /recordings

USER node

ENV NODE_ENV=production
ENV RECORDER_PORT=5000

EXPOSE 5000

CMD ["node", "dist/index.js"]
