#!/usr/bin/env node

// AnythingLLM CLI Tool for Direct Embedding Queries
// Usage: node query-embeddings.js --workspace "your-workspace" --query "your question" [options]

require('dotenv').config({ path: require('path').join(__dirname, '../.env') });
const { program } = require('commander');
const chalk = require('chalk');
const { getVectorDbClass, getLLMProvider, getEmbeddingEngineSelection } = require('../utils/helpers');
const { sourceIdentifier } = require('../utils/chats');
const { Workspace } = require('../models/workspace');

program
  .name('query-embeddings')
  .description('Query document embeddings directly without using the chat interface')
  .version('1.0.0')
  .requiredOption('-w, --workspace <name>', 'Workspace name or slug to query')
  .requiredOption('-q, --query <text>', 'Query text to search for')
  .option('-n, --top-n <number>', 'Number of results to return', '4')
  .option('-t, --threshold <number>', 'Similarity threshold (0-1)', '0.25')
  .option('--json', 'Output results as JSON')
  .option('--citations-only', 'Only return document citations without content')
  .option('--scores', 'Include similarity scores in output')
  .option('--rerank', 'Use reranking for better results')
  .parse();

const options = program.opts();

async function queryEmbeddings() {
  try {
    // Initialize vector database
    const VectorDb = getVectorDbClass();
    
    // Find workspace
    const workspace = await Workspace.get({ slug: options.workspace });
    if (!workspace) {
      console.error(chalk.red(`Error: Workspace "${options.workspace}" not found`));
      process.exit(1);
    }

    // Check if workspace has embeddings
    const hasVectorizedSpace = await VectorDb.hasNamespace(workspace.slug);
    const embeddingsCount = await VectorDb.namespaceCount(workspace.slug);
    
    if (!hasVectorizedSpace || embeddingsCount === 0) {
      console.error(chalk.yellow('Warning: This workspace has no embedded documents'));
      process.exit(1);
    }

    console.log(chalk.blue(`Searching in workspace: ${workspace.name}`));
    console.log(chalk.gray(`Total embeddings: ${embeddingsCount}`));
    console.log(chalk.gray(`Query: "${options.query}"\n`));

    // Get LLM provider for embeddings
    const LLMConnector = getLLMProvider({
      provider: workspace?.chatProvider || process.env.LLM_PROVIDER,
      model: workspace?.chatModel || process.env.CHAT_MODEL_PREF,
    });

    // Perform similarity search
    const searchResults = await VectorDb.performSimilaritySearch({
      namespace: workspace.slug,
      input: options.query,
      LLMConnector,
      similarityThreshold: parseFloat(options.threshold),
      topN: parseInt(options.topN),
      filterIdentifiers: [],
      rerank: options.rerank || false,
    });

    if (searchResults.message) {
      console.error(chalk.red(`Error: ${searchResults.message}`));
      process.exit(1);
    }

    // Format and display results
    if (options.json) {
      console.log(JSON.stringify({
        query: options.query,
        workspace: workspace.name,
        results: searchResults.sources.map((source, index) => ({
          index: index + 1,
          score: options.scores ? source.metadata.score : undefined,
          title: source.metadata.title,
          url: source.metadata.url,
          text: options.citationsOnly ? undefined : source.text,
          metadata: source.metadata
        }))
      }, null, 2));
    } else {
      if (searchResults.sources.length === 0) {
        console.log(chalk.yellow('No relevant documents found for your query.'));
      } else {
        console.log(chalk.green(`Found ${searchResults.sources.length} relevant documents:\n`));
        
        searchResults.sources.forEach((source, index) => {
          console.log(chalk.cyan(`[${index + 1}] ${source.metadata.title || 'Untitled Document'}`));
          
          if (source.metadata.url) {
            console.log(chalk.gray(`    Source: ${source.metadata.url}`));
          }
          
          if (options.scores && source.metadata.score) {
            console.log(chalk.gray(`    Score: ${(source.metadata.score * 100).toFixed(1)}%`));
          }
          
          if (!options.citationsOnly) {
            console.log(chalk.white(`    Content: ${source.text.slice(0, 200)}...`));
          }
          
          console.log('');
        });
      }
    }

  } catch (error) {
    console.error(chalk.red('Error:'), error.message);
    if (process.env.NODE_ENV === 'development') {
      console.error(error.stack);
    }
    process.exit(1);
  }
}

// Run the query
queryEmbeddings();