# Lightweight AnythingLLM Setup for Enterprise Search

This lightweight configuration is optimized for enterprise internal search, removing unnecessary dependencies.

## Changes Made

### Server (package.json.lightweight)
- **Kept**: ChromaDB only vector database
- **Removed**: All other vector databases (Pinecone, Qdrant, Weaviate, LanceDB, Astra DB, Milvus)
- **Removed**: SQL databases (PostgreSQL, MySQL, SQL Server)
- **Removed**: Cloud SDKs (AWS Bedrock)
- **Disk savings**: ~200MB+ of dependencies

### Collector (package.json.lightweight)
- **Removed**: Puppeteer (browser automation)
- **Disk savings**: ~170MB (Chromium binary)

## Functionality Impact

### What Still Works
✅ Local file imports (PDF, Word, Excel, Text, etc.)
✅ API-based imports (GitHub, GitLab, Confluence)
✅ Simple HTML scraping via fetch
✅ Image processing and OCR
✅ Audio/video transcription
✅ All chat and embedding features

### What's Limited
❌ JavaScript-rendered websites
❌ Complex web scraping
❌ Website depth crawling
❌ Sites requiring browser automation

## Installation

```bash
# Server setup
cd server
mv package.json package.json.original
mv package.json.lightweight package.json
rm -rf node_modules package-lock.json yarn.lock
yarn install

# Collector setup
cd ../collector
mv package.json package.json.original
mv package.json.lightweight package.json
rm -rf node_modules package-lock.json yarn.lock
yarn install

# Set environment to use ChromaDB
echo "VECTOR_DB=chroma" >> ../.env
```

## Use Cases

Perfect for:
- Internal document repositories
- Confluence/Wiki content
- GitHub/GitLab repositories
- Curated external content via APIs
- File-based knowledge bases

Not suitable for:
- General web scraping
- Social media content
- Dynamic JavaScript sites
- E-commerce scraping