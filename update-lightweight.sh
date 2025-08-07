#!/bin/bash

# Update script for AnythingLLM Lightweight

cd "$(dirname "$0")"

echo "Updating AnythingLLM Lightweight..."

# Pull latest changes
git checkout .
git pull origin master
echo "HEAD pulled to commit $(git log -1 --pretty=format:"%h" | tail -n 1)"

# Freeze current ENVs
echo "Freezing current ENVs"
curl -I "http://localhost:3001/api/env-dump" | head -n 1|cut -d$' ' -f2

# Kill node processes
echo "Stopping services..."
pkill node

# Rebuild lightweight version
echo "Rebuilding lightweight version..."
./scripts/build-lightweight.sh

# Rebuild frontend
echo "Rebuilding Frontend"
cd frontend && yarn && yarn build && cd ..

# Copy to Server Public
echo "Copying to Server Public"
rm -rf server/public
cp -r frontend/dist server/public

# Run migrations
echo "Running database migrations..."
cd server && npx prisma migrate deploy --schema=./prisma/schema.prisma
cd server && npx prisma generate
cd ..

echo "Update complete! Run ./start-lightweight.sh to restart services."
