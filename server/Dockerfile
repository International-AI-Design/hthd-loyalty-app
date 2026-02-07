# Build stage - v3 (cache bust)
FROM node:20-alpine AS builder
WORKDIR /app
# Copy all source first to ensure fresh prisma schema
COPY . .
RUN npm ci
RUN npx prisma generate
RUN npm run build

# Production stage
FROM node:20-alpine AS runner
WORKDIR /app
ENV NODE_ENV=production

COPY --from=builder /app/dist ./dist
COPY --from=builder /app/node_modules ./node_modules
COPY --from=builder /app/package*.json ./
COPY --from=builder /app/prisma ./prisma
COPY --from=builder /app/prisma.config.ts ./prisma.config.ts
COPY --from=builder /app/tsconfig.json ./tsconfig.json
COPY start.sh ./start.sh
RUN chmod +x ./start.sh

EXPOSE 3001
CMD ["./start.sh"]
