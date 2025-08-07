# AnythingLLM RAG MCP Server - Context Documentation

## Overview
Created a Model Context Protocol (MCP) server to expose AnythingLLM's RAG functionality without using the chatbot interface. This allows querying embeddings, retrieving citations, and accessing workspace information through MCP tools.

## Implementation Status

### Created Files
1. **`/server/mcp-server/index.js`** - Main MCP server implementation
   - Exposes 3 tools: `search_embeddings`, `list_workspaces`, `workspace_info`
   - Uses existing AnythingLLM components (Workspace model, vector DB providers)
   - Handles all error cases gracefully
   - Returns detailed metadata including citations and scores

2. **`/server/mcp-server/package.json`** - MCP server dependencies
   - Uses `@modelcontextprotocol/sdk` v1.0.4
   - Configured as CommonJS module

3. **`/server/mcp-server/README.md`** - Comprehensive documentation
   - Installation instructions for Claude Desktop and AnythingLLM
   - Detailed API documentation for each tool
   - Usage examples in multiple languages
   - Troubleshooting guide

4. **`/server/mcp-server/test.js`** - Test script for validation
   - Tests all three MCP tools
   - Connects as MCP client to verify server functionality

5. **`/server/mcp-server/example-config.json`** - Configuration examples
   - Shows config format for different MCP clients

### Configuration Added

1. **Claude Desktop Configuration**
   - Added to: `~/Library/Application Support/Claude/claude_desktop_config.json`
   - Entry name: `anythingllm-rag`
   - Command: `node /Users/davidpalaitis/Development/anything-llm-light/server/mcp-server/index.js`
   - Transport: stdio

2. **AnythingLLM Internal Config** (for reference)
   - Created: `/server/storage/plugins/anythingllm_mcp_servers.json`
   - This would allow AnythingLLM to consume its own MCP server

## Key Discoveries

1. **AnythingLLM MCP Support**: AnythingLLM supports consuming MCP servers in chat but doesn't expose its own MCP server for external use.

2. **Dynamic Module Loading**: The lightweight version uses conditional requires to load modules only when needed, avoiding startup errors for missing dependencies.

3. **Vector DB Abstraction**: AnythingLLM has a clean abstraction layer for vector databases, making it easy to expose through MCP.

## Usage in Claude Desktop

After restarting Claude with the configuration in place, you can:

```
# List all workspaces
Use the anythingllm-rag MCP server to list all workspaces

# Search for documents
Search for "machine learning" in the default workspace using anythingllm-rag

# Get workspace info
Get information about the "documentation" workspace using anythingllm-rag
```

## Next Steps

1. **Restart Claude Desktop** to load the MCP server configuration
2. **Verify MCP is loaded** with `/mcp` command - should show `anythingllm-rag`
3. **Test the tools** by asking Claude to search your AnythingLLM workspaces

## Technical Details

### Tool: search_embeddings
- Searches vector database for semantically similar documents
- Supports similarity threshold, result count, reranking
- Returns detailed metadata including scores and citations
- Can include pinned documents in results

### Tool: list_workspaces
- Lists all workspaces with embedding statistics
- Shows vector count and whether workspace has embeddings
- Useful for discovering available workspaces

### Tool: workspace_info
- Gets detailed information about a specific workspace
- Shows chat provider, model settings, vector search configuration
- Provides embedding statistics

## Known Issues

1. **Claude Code vs Claude Desktop**: The `/mcp` commands in Claude Code showed "No MCP servers configured" because Claude Code uses a different configuration location (`~/.claude-code/mcp.json`) than Claude Desktop.

2. **MCP Installation**: Most MCP tools install to Claude Desktop by default. For Claude Code, you need to manually copy the server configuration.

## File Locations

- MCP Server: `/Users/davidpalaitis/Development/anything-llm-light/server/mcp-server/`
- Claude Desktop Config: `~/Library/Application Support/Claude/claude_desktop_config.json`
- Claude Code Config: `~/.claude-code/mcp.json`
- AnythingLLM MCP Config: `/server/storage/plugins/anythingllm_mcp_servers.json`

## Environment Requirements

- AnythingLLM server must be running
- Vector database must be configured (ChromaDB in this case)
- Workspaces must have embedded documents to search
- Node.js 18+ for MCP server execution