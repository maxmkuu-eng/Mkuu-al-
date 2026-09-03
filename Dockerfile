FROM node:22-alpine

WORKDIR /app

# Copy package files
COPY package*.json ./

# Install dependencies
RUN npm install

# Copy project files
COPY . .

# Build the application, then apply the Gemini REST runtime patch as the final
# source transform before creating the production server bundle.
# The explicit build marker makes Render logs prove which build was deployed.
ARG MKUU_BUILD_MARKER=gemini-rest-2026-09-03-01
RUN echo "[MKUU-BUILD] MARKER=${MKUU_BUILD_MARKER}" \
  && node scripts/enable-puter-image-studio.cjs \
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
