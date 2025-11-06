# Stage 1: Build dependencies
FROM node:20-alpine AS deps
WORKDIR /app

# Copy package files
COPY package.json ./
RUN npm ci --only=production && npm cache clean --force

# Stage 2: Build TypeScript and generate Prisma client
FROM node:20-alpine AS builder
WORKDIR /app

# Install OpenSSL for Prisma (required for Prisma engine binaries)
RUN apk add --no-cache openssl openssl-dev

# Copy package files
COPY package.json tsconfig.json ./
COPY prisma ./prisma/

# Install all dependencies (including dev)
RUN npm install

# Copy source code
COPY src ./src

# Generate Prisma client (migrations will run at runtime)
RUN npx prisma generate

# Build TypeScript
RUN npm run build

# Stage 3: Production runtime
FROM node:20-alpine AS runner
WORKDIR /app

# Install OpenSSL for Prisma (required for Prisma engine binaries)
RUN apk add --no-cache openssl openssl-dev

# Create non-root user
RUN addgroup --system --gid 1001 nodejs && \
    adduser --system --uid 1001 nodejs

# Copy built files from builder
COPY --from=builder --chown=nodejs:nodejs /app/dist ./dist
COPY --from=builder --chown=nodejs:nodejs /app/node_modules/.prisma ./node_modules/.prisma
COPY --from=builder --chown=nodejs:nodejs /app/node_modules ./node_modules
COPY --from=builder --chown=nodejs:nodejs /app/package.json ./
COPY --from=builder --chown=nodejs:nodejs /app/prisma ./prisma

# Add entrypoint script to run migrations at runtime
COPY --chown=nodejs:nodejs ./docker-entrypoint.sh ./docker-entrypoint.sh
RUN chmod +x ./docker-entrypoint.sh

# Switch to non-root user
USER nodejs

# Expose port
EXPOSE 3001

# Health check
HEALTHCHECK --interval=30s --timeout=3s --start-period=5s --retries=3 \
  CMD node -e "require('http').get('http://localhost:3001/healthz', (r) => {process.exit(r.statusCode === 200 ? 0 : 1)})"

# Start server via entrypoint (runs migrations first)
ENTRYPOINT ["./docker-entrypoint.sh"]

