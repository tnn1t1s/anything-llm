#!/bin/bash

# Script to build the lightweight version of AnythingLLM
# Optimized for enterprise internal search, removing unnecessary dependencies

set -e

echo "Building AnythingLLM Lightweight Version..."
echo "========================================="

# Get the root directory (parent of scripts)
ROOT_DIR="$(dirname "$0")/.."
cd "$ROOT_DIR"

# Function to backup and switch package.json
switch_to_lightweight() {
    local dir=$1
    echo "Processing $dir..."
    
    cd "$dir"
    
    # Check if lightweight version exists
    if [ ! -f "package.json.lightweight" ]; then
        echo "Error: package.json.lightweight not found in $dir"
        exit 1
    fi
    
    # Backup original if not already backed up
    if [ ! -f "package.json.original" ]; then
        cp package.json package.json.original
        echo "  ✓ Backed up original package.json"
    fi
    
    # Switch to lightweight version
    cp package.json.lightweight package.json
    echo "  ✓ Switched to lightweight package.json"
    
    # Clean and reinstall
    echo "  ✓ Cleaning node_modules and lock files..."
    rm -rf node_modules package-lock.json yarn.lock
    
    echo "  ✓ Installing dependencies..."
    yarn install --silent
    
    cd ..
}

# Switch server to lightweight
echo -e "\n1. Setting up server (lightweight)..."
switch_to_lightweight "server"

# Switch collector to lightweight
echo -e "\n2. Setting up collector (lightweight)..."
switch_to_lightweight "collector"

# Configure environment for ChromaDB
echo -e "\n3. Configuring environment..."
if ! grep -q "VECTOR_DB=chroma" .env 2>/dev/null; then
    echo "VECTOR_DB=chroma" >> .env
    echo "  ✓ Set VECTOR_DB=chroma in .env"
else
    echo "  ✓ VECTOR_DB=chroma already configured"
fi

# Install frontend dependencies
echo -e "\n4. Installing frontend dependencies..."
cd frontend
yarn install --silent
cd ..

echo -e "\n✅ Lightweight build complete!"
echo "========================================="
echo "Disk savings:"
echo "  - Server: ~200MB+ (removed unused vector/SQL databases)"
echo "  - Collector: ~170MB (removed heavy dependencies)"
echo ""
echo "Next steps:"
echo "  1. Run 'yarn dev' to start development"
echo "  2. Or 'yarn prod:server' and 'yarn prod:frontend' for production"