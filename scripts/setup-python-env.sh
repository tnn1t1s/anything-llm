#!/bin/bash

# Script to set up Python virtual environment for ChromaDB

set -e

echo "==================================="
echo "Setting up Python Environment"
echo "==================================="

# Get the root directory
ROOT_DIR="$(dirname "$0")/.."
cd "$ROOT_DIR"

# Check if Python 3 is installed
if ! command -v python3 &> /dev/null; then
    echo "Error: Python 3 is not installed. Please install Python 3.8 or later."
    exit 1
fi

# Create virtual environment if it doesn't exist
if [ ! -d "venv" ]; then
    echo "Creating Python virtual environment..."
    python3 -m venv venv
    echo "  ✓ Virtual environment created"
else
    echo "  ✓ Virtual environment already exists"
fi

# Activate virtual environment
echo "Activating virtual environment..."
source venv/bin/activate

# Upgrade pip
echo "Upgrading pip..."
pip install --upgrade pip

# Install ChromaDB
echo "Installing ChromaDB..."
pip install chromadb

echo ""
echo "==================================="
echo "✅ Python Environment Setup Complete!"
echo "==================================="
echo ""
echo "ChromaDB has been installed in the virtual environment."
echo ""
echo "To use ChromaDB, activate the virtual environment with:"
echo "  source venv/bin/activate"
echo ""
echo "Then start ChromaDB with:"
echo "  chroma run --path ./chroma_data --port 8000"
echo ""