FROM node:22-alpine

WORKDIR /app

# Copy package files
COPY package*.json ./

# Install dependencies
RUN npm install

# Copy project files
COPY . .

# Build the application first, then force the Gemini REST patch one final time
# immediately before the production server bundle is created. This prevents any
# earlier build-time transform from leaving the old @google/genai execution path
# inside dist/server.cjs.
RUN node scripts/enable-puter-image-studio.cjs \
  && sed -i "s/gemini-2\.5-flash/gemini-3.6-flash/g" server/geminiService.ts \
  && npm run build \
  && node scripts/fix-gemini-runtime-fallback.cjs \
  && npx esbuild server.ts --bundle --platform=node --format=cjs --packages=external --sourcemap --outfile=dist/server.cjs \
  && node scripts/verify-gemini-build.cjs

# Production configuration
ENV NODE_ENV=production
ENV PORT=3000

# Create data and file storage directory
RUN mkdir -p /app/data/files

EXPOSE 3000

# Start production server
CMD ["node", "dist/server.cjs"]
