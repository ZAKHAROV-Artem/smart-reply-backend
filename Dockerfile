# Install deps with Bun
FROM oven/bun:1 AS deps
WORKDIR /app
COPY package.json bun.lockb* ./
RUN bun install --ci

# Build / generate Prisma client
FROM oven/bun:1 AS build
WORKDIR /app
COPY --from=deps /app/node_modules ./node_modules
COPY . .
# Generate Prisma client and build the Bun bundle
RUN bunx prisma generate && bun run build

# Runtime image
FROM oven/bun:1
WORKDIR /app
ENV NODE_ENV=production
COPY --from=build /app ./

# Install OpenSSL runtime dependency for Prisma
RUN apt-get update -y && apt-get install -y openssl && rm -rf /var/lib/apt/lists/*

# If you run migrations at startup:
# CMD ["bun", "run", "prisma", "migrate", "deploy"]  # optional pre-start
# Then start your app:
# Run database migrations, then start the application
CMD ["sh", "-c", "bunx prisma migrate deploy && bun run start"]
