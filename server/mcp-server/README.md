# AnythingLLM RAG MCP Server

This MCP (Model Context Protocol) server exposes AnythingLLM's powerful RAG (Retrieval-Augmented Generation) capabilities as a standalone service that can be consumed by any MCP-compatible client.

## Features

- **Search Embeddings**: Query vector databases for semantically similar documents
- **Workspace Management**: List and inspect available workspaces
- **Flexible Configuration**: Support for similarity thresholds, result limits, and reranking
- **Pinned Documents**: Include pinned documents in search results
- **Detailed Metadata**: Get comprehensive information about search results

## Installation

The MCP server uses the same dependencies as the main AnythingLLM server, so no additional installation is needed if you're running AnythingLLM.

## Configuration

### For Claude Desktop

Add the following to your Claude Desktop configuration file:

**macOS**: `~/Library/Application Support/Claude/claude_desktop_config.json`  
**Windows**: `%APPDATA%\Claude\claude_desktop_config.json`

```json
{
  "mcpServers": {
    "anythingllm-rag": {
      "command": "node",
      "args": ["/path/to/anything-llm/server/mcp-server/index.js"],
      "env": {
        "NODE_ENV": "production"
      }
    }
  }
}
```

### For AnythingLLM (Self-hosting)

Add to your `anythingllm_mcp_servers.json`:

```json
{
  "mcpServers": {
    "anythingllm-rag": {
      "command": "node",
      "args": ["./mcp-server/index.js"],
      "env": {
        "NODE_ENV": "production"
      },
      "transportType": "stdio"
    }
  }
}
```

## Available Tools

### 1. search_embeddings

Search for relevant documents in a workspace using semantic similarity.

**Parameters:**
- `query` (string, required): The search query text
- `workspace` (string, required): The workspace slug to search in
- `topN` (number, optional): Number of results to return (default: 4)
- `threshold` (number, optional): Similarity threshold 0-1 (default: 0.25)
- `includePinned` (boolean, optional): Include pinned documents in results
- `rerank` (boolean, optional): Use reranking for better results

**Example Request:**
```json
{
  "query": "What is AnythingLLM?",
  "workspace": "default",
  "topN": 5,
  "threshold": 0.3,
  "includePinned": true
}
```

**Example Response:**
```json
{
  "query": "What is AnythingLLM?",
  "workspace": "Default",
  "settings": {
    "topN": 5,
    "threshold": 0.3,
    "rerank": false,
    "includePinned": true
  },
  "stats": {
    "totalEmbeddings": 150,
    "resultsFound": 5,
    "pinnedDocs": 1,
    "vectorResults": 4
  },
  "results": [
    {
      "index": 1,
      "type": "pinned",
      "score": null,
      "title": "AnythingLLM Overview",
      "url": "file://overview.pdf",
      "text": "AnythingLLM is a full-stack application...",
      "metadata": {
        "isPinned": true,
        "wordCount": 500
      }
    },
    {
      "index": 2,
      "type": "vector",
      "score": 0.85,
      "title": "Getting Started Guide",
      "url": "https://docs.anythingllm.com/getting-started",
      "text": "To get started with AnythingLLM...",
      "metadata": {
        "wordCount": 300,
        "published": "2024-01-15"
      }
    }
  ]
}
```

### 2. list_workspaces

List all available workspaces and their embedding statistics.

**Parameters:** None

**Example Response:**
```json
{
  "totalWorkspaces": 3,
  "workspaces": [
    {
      "name": "Default",
      "slug": "default",
      "vectorCount": 150,
      "hasEmbeddings": true
    },
    {
      "name": "Documentation",
      "slug": "documentation",
      "vectorCount": 500,
      "hasEmbeddings": true
    },
    {
      "name": "Empty Workspace",
      "slug": "empty-workspace",
      "vectorCount": 0,
      "hasEmbeddings": false
    }
  ]
}
```

### 3. workspace_info

Get detailed information about a specific workspace.

**Parameters:**
- `workspace` (string, required): The workspace slug

**Example Response:**
```json
{
  "name": "Default",
  "slug": "default",
  "settings": {
    "chatProvider": "openai",
    "chatModel": "gpt-3.5-turbo",
    "topN": 4,
    "similarityThreshold": 0.25,
    "vectorSearchMode": "similarity"
  },
  "stats": {
    "hasEmbeddings": true,
    "vectorCount": 150
  }
}
```

## Usage Examples

### With Claude Desktop

Once configured, you can ask Claude to search your AnythingLLM knowledge base:

```
"Search my AnythingLLM workspace for information about vector databases"
"What documents do I have about machine learning in the 'research' workspace?"
"List all my workspaces and show which ones have embedded documents"
```

### With Python MCP Client

```python
import asyncio
from mcp import Client, StdioClientTransport

async def search_documents():
    transport = StdioClientTransport(
        command=["node", "/path/to/mcp-server/index.js"]
    )
    
    async with Client("anythingllm-rag", transport) as client:
        # Search for documents
        result = await client.call_tool(
            "search_embeddings",
            {
                "query": "machine learning algorithms",
                "workspace": "research",
                "topN": 10,
                "threshold": 0.2
            }
        )
        print(result)

asyncio.run(search_documents())
```

### With Node.js

```javascript
const { Client } = require('@modelcontextprotocol/sdk/client/index.js');
const { StdioClientTransport } = require('@modelcontextprotocol/sdk/client/stdio.js');

async function searchDocuments() {
  const transport = new StdioClientTransport({
    command: 'node',
    args: ['/path/to/mcp-server/index.js']
  });

  const client = new Client({
    name: 'my-client',
    version: '1.0.0'
  }, {
    capabilities: {}
  });

  await client.connect(transport);

  const result = await client.callTool({
    name: 'search_embeddings',
    arguments: {
      query: 'machine learning algorithms',
      workspace: 'research',
      topN: 10
    }
  });

  console.log(result);
  await client.close();
}
```

## Requirements

- Node.js 18 or higher
- Running AnythingLLM instance with:
  - Configured vector database (ChromaDB, Pinecone, etc.)
  - At least one workspace with embedded documents
  - Configured LLM provider for embeddings

## Troubleshooting

### "Workspace not found" error
- Verify the workspace slug is correct (use `list_workspaces` tool)
- Workspace slugs are case-sensitive

### "No embedded documents" message
- Ensure documents have been uploaded and embedded in the workspace
- Check the AnythingLLM interface to verify embeddings exist

### Connection errors
- Verify AnythingLLM server is running
- Check that environment variables are properly set
- Ensure the MCP server has access to AnythingLLM's storage directory

## Security Considerations

- The MCP server has the same access level as the AnythingLLM server
- It can read all workspaces and embedded documents
- Consider implementing additional authentication if exposing over network
- Use environment variables for sensitive configuration

## Contributing

This MCP server is part of the AnythingLLM project. Contributions should follow the main project's guidelines.