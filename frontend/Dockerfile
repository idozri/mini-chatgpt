FROM node:20-alpine AS builder
WORKDIR /app

# Install dependencies
COPY package.json package-lock.json* ./
RUN npm ci && npm cache clean --force

# Copy source
COPY . .

# Build with configurable API base URL
ARG VITE_API_BASE_URL=https://mini-chatgpt-backend-9tw7.onrender.com/api
ENV VITE_API_BASE_URL=${VITE_API_BASE_URL}
RUN npm run build

FROM node:20-alpine AS runner
WORKDIR /app

# Copy package files and install dependencies (vite is needed for preview)
COPY --from=builder /app/package.json ./
COPY --from=builder /app/package-lock.json* ./
RUN npm ci && npm cache clean --force

# Copy built files
COPY --from=builder /app/dist ./dist

# Use vite preview to serve static build
EXPOSE 3000
CMD ["npm", "run", "preview", "--", "--host", "0.0.0.0", "--port", "3000"]


