#!/usr/bin/env node

/**
 * AnythingLLM RAG MCP Server
 * 
 * This MCP server exposes AnythingLLM's RAG (Retrieval-Augmented Generation) capabilities
 * as an MCP-compatible service, allowing external applications to query embedded documents.
 */

const { Server } = require("@modelcontextprotocol/sdk/server/index.js");
const { StdioServerTransport } = require("@modelcontextprotocol/sdk/server/stdio.js");
const { ListToolsRequestSchema, CallToolRequestSchema } = require("@modelcontextprotocol/sdk/types.js");
const path = require("path");
require("dotenv").config({ path: path.join(__dirname, "../.env") });

// Import AnythingLLM components
const { getVectorDbClass, getLLMProvider } = require("../utils/helpers");
const { Workspace } = require("../models/workspace");
const { sourceIdentifier } = require("../utils/chats");
const { DocumentManager } = require("../utils/DocumentManager");

class AnythingLLMRAGServer {
  constructor() {
    this.server = new Server(
      {
        name: "anythingllm-rag",
        version: "1.0.0",
      },
      {
        capabilities: {
          tools: {},
        },
      }
    );

    this.setupTools();
    this.setupErrorHandling();
  }

  setupTools() {
    // Tool: search_embeddings - Query the vector database
    this.server.setRequestHandler(ListToolsRequestSchema, async () => ({
      tools: [
        {
          name: "search_embeddings",
          description: "Search for relevant documents in a workspace using semantic similarity",
          inputSchema: {
            type: "object",
            properties: {
              query: {
                type: "string",
                description: "The search query text",
              },
              workspace: {
                type: "string",
                description: "The workspace slug to search in",
              },
              topN: {
                type: "number",
                description: "Number of results to return (default: 4)",
                default: 4,
              },
              threshold: {
                type: "number",
                description: "Similarity threshold 0-1 (default: 0.25)",
                default: 0.25,
              },
              includePinned: {
                type: "boolean",
                description: "Include pinned documents in results",
                default: false,
              },
              rerank: {
                type: "boolean",
                description: "Use reranking for better results",
                default: false,
              },
            },
            required: ["query", "workspace"],
          },
        },
        {
          name: "list_workspaces",
          description: "List all available workspaces",
          inputSchema: {
            type: "object",
            properties: {},
          },
        },
        {
          name: "workspace_info",
          description: "Get information about a specific workspace",
          inputSchema: {
            type: "object",
            properties: {
              workspace: {
                type: "string",
                description: "The workspace slug",
              },
            },
            required: ["workspace"],
          },
        },
      ],
    }));

    // Handle tool calls
    this.server.setRequestHandler(CallToolRequestSchema, async (request) => {
      const { name, arguments: args } = request.params;

      try {
        switch (name) {
          case "search_embeddings":
            return await this.searchEmbeddings(args);
          case "list_workspaces":
            return await this.listWorkspaces();
          case "workspace_info":
            return await this.getWorkspaceInfo(args);
          default:
            throw new Error(`Unknown tool: ${name}`);
        }
      } catch (error) {
        return {
          content: [
            {
              type: "text",
              text: `Error: ${error.message}`,
            },
          ],
          isError: true,
        };
      }
    });
  }

  async searchEmbeddings({
    query,
    workspace: workspaceSlug,
    topN = 4,
    threshold = 0.25,
    includePinned = false,
    rerank = false,
  }) {
    // Initialize vector database
    const VectorDb = getVectorDbClass();
    
    // Find workspace
    const workspace = await Workspace.get({ slug: workspaceSlug });
    if (!workspace) {
      throw new Error(`Workspace "${workspaceSlug}" not found`);
    }

    // Check if workspace has embeddings
    const hasVectorizedSpace = await VectorDb.hasNamespace(workspace.slug);
    const embeddingsCount = await VectorDb.namespaceCount(workspace.slug);
    
    if (!hasVectorizedSpace || embeddingsCount === 0) {
      return {
        content: [
          {
            type: "text",
            text: JSON.stringify({
              query,
              workspace: workspace.name,
              message: "This workspace has no embedded documents",
              results: [],
            }, null, 2),
          },
        ],
      };
    }

    // Get LLM provider for embeddings
    const LLMConnector = getLLMProvider({
      provider: workspace?.chatProvider || process.env.LLM_PROVIDER,
      model: workspace?.chatModel || process.env.CHAT_MODEL_PREF,
    });

    // Get pinned documents if requested
    let pinnedDocIdentifiers = [];
    let pinnedSources = [];
    
    if (includePinned) {
      const docManager = new DocumentManager({
        workspace,
        maxTokens: LLMConnector.promptWindowLimit(),
      });
      
      const pinnedDocs = await docManager.pinnedDocs();
      pinnedDocs.forEach((doc) => {
        const { pageContent, ...metadata } = doc;
        pinnedDocIdentifiers.push(sourceIdentifier(doc));
        pinnedSources.push({
          text: pageContent.slice(0, 1000) + (pageContent.length > 1000 ? "..." : ""),
          metadata: {
            ...metadata,
            isPinned: true,
          },
        });
      });
    }

    // Perform vector search
    const searchResults = await VectorDb.performSimilaritySearch({
      namespace: workspace.slug,
      input: query,
      LLMConnector,
      similarityThreshold: threshold,
      topN,
      filterIdentifiers: pinnedDocIdentifiers,
      rerank: rerank || workspace?.vectorSearchMode === "rerank",
    });

    if (searchResults.message) {
      throw new Error(searchResults.message);
    }

    // Combine results
    const allSources = [...pinnedSources, ...searchResults.sources];

    // Format response
    const response = {
      query,
      workspace: workspace.name,
      settings: {
        topN,
        threshold,
        rerank,
        includePinned,
      },
      stats: {
        totalEmbeddings: embeddingsCount,
        resultsFound: allSources.length,
        pinnedDocs: pinnedSources.length,
        vectorResults: searchResults.sources.length,
      },
      results: allSources.map((source, index) => ({
        index: index + 1,
        type: source.metadata?.isPinned ? "pinned" : "vector",
        score: source.metadata?.score || null,
        title: source.metadata?.title || source.title || "Untitled",
        url: source.metadata?.url || source.url || null,
        text: source.text || source.metadata?.text,
        metadata: source.metadata || {},
      })),
    };

    return {
      content: [
        {
          type: "text",
          text: JSON.stringify(response, null, 2),
        },
      ],
    };
  }

  async listWorkspaces() {
    const workspaces = await Workspace.where();
    const VectorDb = getVectorDbClass();

    const workspaceInfo = await Promise.all(
      workspaces.map(async (ws) => {
        const hasVectors = await VectorDb.hasNamespace(ws.slug);
        const vectorCount = hasVectors
          ? await VectorDb.namespaceCount(ws.slug)
          : 0;

        return {
          name: ws.name,
          slug: ws.slug,
          vectorCount,
          hasEmbeddings: hasVectors && vectorCount > 0,
        };
      })
    );

    return {
      content: [
        {
          type: "text",
          text: JSON.stringify(
            {
              totalWorkspaces: workspaces.length,
              workspaces: workspaceInfo,
            },
            null,
            2
          ),
        },
      ],
    };
  }

  async getWorkspaceInfo({ workspace: workspaceSlug }) {
    const workspace = await Workspace.get({ slug: workspaceSlug });
    if (!workspace) {
      throw new Error(`Workspace "${workspaceSlug}" not found`);
    }

    const VectorDb = getVectorDbClass();
    const hasVectors = await VectorDb.hasNamespace(workspace.slug);
    const vectorCount = hasVectors
      ? await VectorDb.namespaceCount(workspace.slug)
      : 0;

    const info = {
      name: workspace.name,
      slug: workspace.slug,
      settings: {
        chatProvider: workspace.chatProvider,
        chatModel: workspace.chatModel,
        topN: workspace.topN,
        similarityThreshold: workspace.similarityThreshold,
        vectorSearchMode: workspace.vectorSearchMode,
      },
      stats: {
        hasEmbeddings: hasVectors && vectorCount > 0,
        vectorCount,
      },
    };

    return {
      content: [
        {
          type: "text",
          text: JSON.stringify(info, null, 2),
        },
      ],
    };
  }

  setupErrorHandling() {
    this.server.onerror = (error) => {
      console.error("[MCP Server Error]", error);
    };

    process.on("SIGINT", async () => {
      await this.server.close();
      process.exit(0);
    });
  }

  async run() {
    const transport = new StdioServerTransport();
    await this.server.connect(transport);
    console.error("AnythingLLM RAG MCP Server started");
  }
}

// Start the server
const server = new AnythingLLMRAGServer();
server.run().catch(console.error);