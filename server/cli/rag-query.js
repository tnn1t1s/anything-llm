#!/usr/bin/env node

// AnythingLLM Advanced RAG Query Tool
// Queries embeddings and shows exactly what context would be provided to an LLM

require('dotenv').config({ path: require('path').join(__dirname, '../.env') });
const { program } = require('commander');
const chalk = require('chalk');
const { getVectorDbClass, getLLMProvider } = require('../utils/helpers');
const { sourceIdentifier } = require('../utils/chats');
const { Workspace } = require('../models/workspace');
const { DocumentManager } = require('../utils/DocumentManager');
const { fillSourceWindow } = require('../utils/helpers/chat');

program
  .name('rag-query')
  .description('Advanced RAG query tool - see exactly what context would be provided to an LLM')
  .version('1.0.0')
  .requiredOption('-w, --workspace <name>', 'Workspace name or slug to query')
  .requiredOption('-q, --query <text>', 'Query text to search for')
  .option('-n, --top-n <number>', 'Number of results to return', '4')
  .option('-t, --threshold <number>', 'Similarity threshold (0-1)', '0.25')
  .option('--include-pinned', 'Include pinned documents in context')
  .option('--show-context', 'Show the full context that would be sent to LLM')
  .option('--token-count', 'Show token counts for context')
  .option('--json', 'Output results as JSON')
  .option('--rerank', 'Use reranking for better results')
  .parse();

const options = program.opts();

async function performRAGQuery() {
  try {
    // Initialize components
    const VectorDb = getVectorDbClass();
    
    // Find workspace
    const workspace = await Workspace.get({ slug: options.workspace });
    if (!workspace) {
      console.error(chalk.red(`Error: Workspace "${options.workspace}" not found`));
      process.exit(1);
    }

    // Check embeddings
    const hasVectorizedSpace = await VectorDb.hasNamespace(workspace.slug);
    const embeddingsCount = await VectorDb.namespaceCount(workspace.slug);
    
    if (!hasVectorizedSpace || embeddingsCount === 0) {
      console.error(chalk.yellow('Warning: This workspace has no embedded documents'));
      process.exit(1);
    }

    console.log(chalk.blue(`\n=== RAG Query Analysis ===`));
    console.log(chalk.gray(`Workspace: ${workspace.name}`));
    console.log(chalk.gray(`Total embeddings: ${embeddingsCount}`));
    console.log(chalk.gray(`Query: "${options.query}"\n`));

    // Get LLM provider
    const LLMConnector = getLLMProvider({
      provider: workspace?.chatProvider || process.env.LLM_PROVIDER,
      model: workspace?.chatModel || process.env.CHAT_MODEL_PREF,
    });

    // Get pinned documents if requested
    let pinnedDocIdentifiers = [];
    let pinnedContexts = [];
    let pinnedSources = [];
    
    if (options.includePinned) {
      const docManager = new DocumentManager({
        workspace,
        maxTokens: LLMConnector.promptWindowLimit(),
      });
      
      const pinnedDocs = await docManager.pinnedDocs();
      pinnedDocs.forEach((doc) => {
        const { pageContent, ...metadata } = doc;
        pinnedDocIdentifiers.push(sourceIdentifier(doc));
        pinnedContexts.push(pageContent);
        pinnedSources.push({
          text: pageContent.slice(0, 1_000) + "...continued on in source document...",
          ...metadata,
          isPinned: true
        });
      });
      
      if (pinnedDocs.length > 0) {
        console.log(chalk.magenta(`Found ${pinnedDocs.length} pinned documents\n`));
      }
    }

    // Perform vector search
    const searchResults = await VectorDb.performSimilaritySearch({
      namespace: workspace.slug,
      input: options.query,
      LLMConnector,
      similarityThreshold: parseFloat(options.threshold),
      topN: parseInt(options.topN),
      filterIdentifiers: pinnedDocIdentifiers,
      rerank: options.rerank || workspace?.vectorSearchMode === "rerank",
    });

    if (searchResults.message) {
      console.error(chalk.red(`Error: ${searchResults.message}`));
      process.exit(1);
    }

    // Combine all sources
    const allSources = [...pinnedSources, ...searchResults.sources];
    const allContextTexts = [...pinnedContexts, ...searchResults.contextTexts];

    // Display results
    if (options.json) {
      const output = {
        query: options.query,
        workspace: workspace.name,
        settings: {
          topN: parseInt(options.topN),
          threshold: parseFloat(options.threshold),
          rerank: options.rerank || false,
          includePinned: options.includePinned
        },
        results: {
          totalSources: allSources.length,
          pinnedSources: pinnedSources.length,
          vectorSources: searchResults.sources.length,
          sources: allSources.map((source, index) => ({
            index: index + 1,
            type: source.isPinned ? 'pinned' : 'vector',
            score: source.metadata?.score,
            title: source.metadata?.title || source.title,
            url: source.metadata?.url || source.url,
            text: source.text
          }))
        }
      };
      
      if (options.showContext) {
        output.context = {
          texts: allContextTexts,
          combined: allContextTexts.join('\n\n---\n\n')
        };
      }
      
      if (options.tokenCount) {
        const tokenizer = require('js-tiktoken');
        const encoding = tokenizer.getEncoding('cl100k_base');
        const contextString = allContextTexts.join('\n\n');
        const tokens = encoding.encode(contextString);
        output.tokenCount = {
          total: tokens.length,
          percentOfWindow: ((tokens.length / LLMConnector.promptWindowLimit()) * 100).toFixed(1) + '%'
        };
        encoding.free();
      }
      
      console.log(JSON.stringify(output, null, 2));
    } else {
      // Human readable output
      console.log(chalk.green(`\n=== Search Results ===`));
      
      if (pinnedSources.length > 0) {
        console.log(chalk.magenta(`\nPinned Documents (${pinnedSources.length}):`));
        pinnedSources.forEach((source, index) => {
          console.log(chalk.magenta(`📌 [P${index + 1}] ${source.title || 'Untitled'}`));
          if (source.url) console.log(chalk.gray(`    ${source.url}`));
          console.log(chalk.gray(`    ${source.text.slice(0, 150)}...`));
        });
      }
      
      if (searchResults.sources.length > 0) {
        console.log(chalk.cyan(`\nVector Search Results (${searchResults.sources.length}):`));
        searchResults.sources.forEach((source, index) => {
          const score = source.metadata?.score;
          console.log(chalk.cyan(`🔍 [V${index + 1}] ${source.metadata?.title || 'Untitled'} ${score ? `(${(score * 100).toFixed(1)}%)` : ''}`));
          if (source.metadata?.url) console.log(chalk.gray(`    ${source.metadata.url}`));
          console.log(chalk.gray(`    ${source.text.slice(0, 150)}...`));
        });
      }
      
      if (allSources.length === 0) {
        console.log(chalk.yellow('\nNo relevant documents found.'));
      }
      
      if (options.showContext && allContextTexts.length > 0) {
        console.log(chalk.green(`\n=== Full Context (as would be sent to LLM) ===`));
        console.log(chalk.gray('--- START CONTEXT ---'));
        allContextTexts.forEach((text, index) => {
          console.log(chalk.white(`\n[Document ${index + 1}]`));
          console.log(text);
          console.log(chalk.gray('\n---'));
        });
        console.log(chalk.gray('--- END CONTEXT ---'));
      }
      
      if (options.tokenCount && allContextTexts.length > 0) {
        const tokenizer = require('js-tiktoken');
        const encoding = tokenizer.getEncoding('cl100k_base');
        const contextString = allContextTexts.join('\n\n');
        const tokens = encoding.encode(contextString);
        const windowLimit = LLMConnector.promptWindowLimit();
        
        console.log(chalk.green(`\n=== Token Analysis ===`));
        console.log(chalk.white(`Total context tokens: ${tokens.length.toLocaleString()}`));
        console.log(chalk.white(`Model window limit: ${windowLimit.toLocaleString()}`));
        console.log(chalk.white(`Usage: ${((tokens.length / windowLimit) * 100).toFixed(1)}% of context window`));
        
        if (tokens.length > windowLimit * 0.8) {
          console.log(chalk.yellow(`⚠️  Warning: Context is using >80% of the model's token window`));
        }
        
        encoding.free();
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

// Execute the query
performRAGQuery();