FROM node:20-alpine

WORKDIR /app

# Copy package files
COPY package*.json ./

# Install dependencies
RUN npm install

# Copy project files
COPY . .

# Build application (Vite + esbuild backend)
# Enable Puter Image Studio in the browser before Vite bundles the frontend.
# Puter handles authentication and AI access; no Pollinations image key is required.
RUN node scripts/enable-puter-image-studio.cjs && sed -i "s/gemini-2\.5-flash/gemini-3.6-flash/g" server/geminiService.ts && npm run build

# Production configuration
ENV NODE_ENV=production
ENV PORT=3000

# Create data and file storage directory
RUN mkdir -p /app/data/files

EXPOSE 3000

# Start production server
CMD ["node", "dist/server.cjs"]
