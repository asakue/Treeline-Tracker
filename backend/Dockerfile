FROM node:20-alpine AS builder

WORKDIR /app

# Copy root monorepo/workspace package files
COPY package*.json ./
COPY backend/package*.json ./backend/
COPY packages/lora-mesh/package*.json ./packages/lora-mesh/

# Install dependencies
RUN npm ci --workspace=backend --workspace=@treeline/lora-mesh

# Copy source code
COPY packages/lora-mesh ./packages/lora-mesh
COPY backend ./backend

# Build packages and backend
RUN npm run build --workspace=@treeline/lora-mesh
RUN npm run build --workspace=backend

FROM node:20-alpine AS runner

WORKDIR /app
ENV NODE_ENV=production

COPY package*.json ./
COPY backend/package*.json ./backend/
COPY packages/lora-mesh/package*.json ./packages/lora-mesh/

RUN npm ci --workspace=backend --workspace=@treeline/lora-mesh --omit=dev

COPY --from=builder /app/packages/lora-mesh/dist ./packages/lora-mesh/dist
COPY --from=builder /app/backend/dist ./backend/dist
COPY --from=builder /app/backend/schema.sql ./backend/schema.sql

EXPOSE 4000
WORKDIR /app/backend

CMD ["node", "dist/index.js"]
