#!/bin/bash

# Script to set up and run AnythingLLM Lightweight Version in production mode (bare metal)
# Based on BARE_METAL.md instructions

set -e

echo "==================================="
echo "AnythingLLM Lightweight Setup"
echo "Production Mode (Bare Metal)"
echo "==================================="

# Get the root directory
ROOT_DIR="$(dirname "$0")/.."
cd "$ROOT_DIR"

# Step 1: Ensure lightweight version is built
echo -e "\n1. Ensuring lightweight version is built..."
if [ ! -f "server/package.json.original" ] || [ ! -f "collector/package.json.original" ]; then
    echo "Running lightweight build script first..."
    ./scripts/build-lightweight.sh
fi

# Step 2: Update frontend .env for production
echo -e "\n2. Configuring frontend for production..."
if [ ! -f "frontend/.env" ]; then
    cp frontend/.env.example frontend/.env
fi

# Update VITE_API_BASE for production
sed -i.bak "s|^VITE_API_BASE=.*|VITE_API_BASE='/api'|" frontend/.env
echo "  ✓ Set VITE_API_BASE='/api' for production"

# Step 3: Build the frontend
echo -e "\n3. Building frontend for production..."
cd frontend
yarn build
cd ..
echo "  ✓ Frontend built successfully"

# Step 4: Copy frontend dist to server/public
echo -e "\n4. Copying frontend to server..."
rm -rf server/public
cp -R frontend/dist server/public
echo "  ✓ Frontend copied to server/public"

# Step 5: Configure server environment
echo -e "\n5. Configuring server environment..."
if [ ! -f "server/.env" ]; then
    cp server/.env.example server/.env
fi

# Update STORAGE_DIR to absolute path
STORAGE_DIR="$PWD/server/storage"
sed -i.bak "s|^STORAGE_DIR=.*|STORAGE_DIR=\"$STORAGE_DIR\"|" server/.env
echo "  ✓ Set STORAGE_DIR to $STORAGE_DIR"

# Step 6: Run database migrations
echo -e "\n6. Setting up database..."
cd server
npx prisma generate --schema=./prisma/schema.prisma
npx prisma migrate deploy --schema=./prisma/schema.prisma
cd ..
echo "  ✓ Database migrations complete"

# Step 7: Create startup script
echo -e "\n7. Creating startup script..."
cat > start-lightweight.sh << 'EOF'
#!/bin/bash

# Kill any existing node processes for AnythingLLM
echo "Stopping any existing AnythingLLM processes..."
pkill -f "node.*server/index.js" || true
pkill -f "node.*collector/index.js" || true

# Start ChromaDB if not running
if ! pgrep -f "chroma run" > /dev/null; then
    echo "Starting ChromaDB..."
    chroma run --path ./chroma_data --port 8000 &
    sleep 5
else
    echo "ChromaDB is already running"
fi

# Start server in production mode
echo "Starting AnythingLLM server..."
cd server && NODE_ENV=production node index.js &
SERVER_PID=$!
cd ..

# Start collector in production mode
echo "Starting AnythingLLM collector..."
cd collector && NODE_ENV=production node index.js &
COLLECTOR_PID=$!
cd ..

echo ""
echo "================================="
echo "AnythingLLM Lightweight is running!"
echo "================================="
echo "Server PID: $SERVER_PID"
echo "Collector PID: $COLLECTOR_PID"
echo ""
echo "Access the application at: http://localhost:3001"
echo ""
echo "To stop all services, run: pkill node"
echo ""

# Keep script running
wait
EOF

chmod +x start-lightweight.sh
echo "  ✓ Created start-lightweight.sh"

# Step 8: Create update script
echo -e "\n8. Creating update script..."
cat > update-lightweight.sh << 'EOF'
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
EOF

chmod +x update-lightweight.sh
echo "  ✓ Created update-lightweight.sh"

# Step 9: Set up Python environment and ChromaDB
echo -e "\n9. Setting up Python environment for ChromaDB..."
./scripts/setup-python-env.sh

echo ""
echo "================================="
echo "✅ Setup Complete!"
echo "================================="
echo ""
echo "Next steps:"
echo "1. Start the application:"
echo "   ./start-lightweight.sh"
echo ""
echo "The application will be available at http://localhost:3001"
echo ""
echo "To update in the future, run:"
echo "   ./update-lightweight.sh"
echo ""