#!/usr/bin/env node

/**
 * Test script for AnythingLLM RAG MCP Server
 * 
 * This script tests the MCP server by connecting as a client and calling each tool.
 */

const { Client } = require("@modelcontextprotocol/sdk/client/index.js");
const { StdioClientTransport } = require("@modelcontextprotocol/sdk/client/stdio.js");
const path = require("path");

async function testMCPServer() {
  console.log("🧪 Testing AnythingLLM RAG MCP Server...\n");

  const transport = new StdioClientTransport({
    command: "node",
    args: [path.join(__dirname, "index.js")],
  });

  const client = new Client(
    {
      name: "test-client",
      version: "1.0.0",
    },
    {
      capabilities: {},
    }
  );

  try {
    // Connect to the server
    await client.connect(transport);
    console.log("✅ Connected to MCP server\n");

    // Test 1: List tools
    console.log("📋 Available tools:");
    const tools = await client.listTools();
    tools.tools.forEach((tool) => {
      console.log(`  - ${tool.name}: ${tool.description}`);
    });
    console.log("");

    // Test 2: List workspaces
    console.log("🗂️  Testing list_workspaces...");
    const workspacesList = await client.callTool({
      name: "list_workspaces",
      arguments: {},
    });
    console.log("Response:", JSON.parse(workspacesList.content[0].text));
    console.log("");

    // Test 3: Get workspace info (if any workspace exists)
    const workspaces = JSON.parse(workspacesList.content[0].text);
    if (workspaces.workspaces && workspaces.workspaces.length > 0) {
      const firstWorkspace = workspaces.workspaces[0];
      console.log(`📊 Testing workspace_info for "${firstWorkspace.name}"...`);
      const workspaceInfo = await client.callTool({
        name: "workspace_info",
        arguments: {
          workspace: firstWorkspace.slug,
        },
      });
      console.log("Response:", JSON.parse(workspaceInfo.content[0].text));
      console.log("");

      // Test 4: Search embeddings (if workspace has embeddings)
      if (firstWorkspace.hasEmbeddings) {
        console.log(`🔍 Testing search_embeddings in "${firstWorkspace.name}"...`);
        const searchResult = await client.callTool({
          name: "search_embeddings",
          arguments: {
            query: "What is AnythingLLM?",
            workspace: firstWorkspace.slug,
            topN: 3,
            includePinned: true,
          },
        });
        const results = JSON.parse(searchResult.content[0].text);
        console.log(`Found ${results.results.length} results:`);
        results.results.forEach((result, i) => {
          console.log(`  ${i + 1}. ${result.title} (${result.type}, score: ${result.score || 'N/A'})`);
          console.log(`     ${result.text.slice(0, 100)}...`);
        });
      } else {
        console.log(`⚠️  Skipping search test - workspace has no embeddings`);
      }
    } else {
      console.log("⚠️  No workspaces found - skipping workspace-specific tests");
    }

    console.log("\n✅ All tests completed successfully!");
  } catch (error) {
    console.error("\n❌ Test failed:", error);
  } finally {
    await client.close();
    process.exit(0);
  }
}

// Run the test
testMCPServer().catch(console.error);