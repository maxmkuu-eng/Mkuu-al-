FROM node:20-alpine AS builder

WORKDIR /app

COPY package*.json ./
RUN npm ci

COPY . .
RUN npm run build
RUN npx esbuild server.ts --bundle --platform=node --format=cjs --packages=external --outfile=dist/server.cjs

FROM node:20-alpine AS runner

WORKDIR /app

ENV NODE_ENV=production
ENV PORT=3000

COPY package*.json ./
# package.json and package-lock.json are currently out of sync; use npm install
# in the runtime image so Render can resolve the declared production deps.
RUN npm install --omit=dev --no-audit --no-fund

COPY --from=builder /app/dist ./dist

# Create storage directories for files and database
RUN mkdir -p /app/data/files

EXPOSE 3000

CMD ["node", "dist/server.cjs"]
