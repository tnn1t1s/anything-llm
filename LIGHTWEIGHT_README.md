# AnythingLLM Lightweight Version

This is a lightweight version of AnythingLLM optimized for enterprise internal search with reduced dependencies and disk footprint.

## Quick Start (Bare Metal Production)

```bash
# 1. Run the automated setup script (includes Python venv setup)
./scripts/setup-lightweight-baremetal.sh

# 2. Start the application
./start-lightweight.sh
```

The application will be available at http://localhost:3001

## Python Virtual Environment

The setup script automatically creates a Python virtual environment and installs ChromaDB.
- Virtual environment location: `./venv`
- ChromaDB data directory: `./chroma_data`

To manually activate the virtual environment:
```bash
source venv/bin/activate
```

## Features

- **Reduced Dependencies**: Removed unnecessary vector databases and external services
- **ChromaDB Only**: Uses ChromaDB as the single vector database for simplicity
- **Native Embedding**: Uses local Xenova embeddings instead of external APIs
- **Local Audio Processing**: Uses local Whisper model for audio transcription
- **Minimal Storage**: ~370MB+ disk savings from removed dependencies

## Changes from Full Version

### Server Package Changes
- Removed unused vector database dependencies (Pinecone, Weaviate, Qdrant, etc.)
- Removed ElevenLabs TTS dependency
- Kept only essential LLM and embedding providers
- Uses ChromaDB for vector storage

### Collector Package Changes
- Removed Puppeteer/Chromium (~170MB savings)
- Kept essential document processing capabilities
- Maintained support for PDFs, Office documents, text files

## Setup Instructions

1. **Build the Lightweight Version**
   ```bash
   ./scripts/build-lightweight.sh
   ```

2. **Install ChromaDB** (if not already installed)
   ```bash
   pip install chromadb
   ```

3. **Start ChromaDB Server**
   ```bash
   chroma run --path ./chroma_data --port 8000
   ```

4. **Start Development Server**
   ```bash
   yarn dev
   ```

   Or for production:
   ```bash
   yarn prod:server  # In one terminal
   yarn prod:frontend  # In another terminal
   ```

## Environment Configuration

The `.env` file has been pre-configured with:
- ChromaDB as the vector database
- Native embedding engine (Xenova/all-MiniLM-L6-v2)
- Local Whisper for audio processing
- Native TTS provider

## Disk Savings

- **Server**: ~200MB+ (removed unused vector/SQL databases)
- **Collector**: ~170MB (removed Puppeteer/Chromium)
- **Total**: ~370MB+ reduced disk footprint

## Reverting to Full Version

To revert back to the full version:
```bash
cd server && cp package.json.original package.json && yarn install
cd ../collector && cp package.json.original package.json && yarn install
```

## Notes

- This lightweight version is ideal for on-premise deployments where external services are not needed
- All core functionality for document processing and search remains intact
- The system uses only local models and ChromaDB for all operations