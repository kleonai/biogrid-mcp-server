#!/usr/bin/env node
/*
 * BioGRID MCP Server – v1.0.0
 * -----------------------------------------------------------
 * A minimal Model‑Context‑Protocol server exposing BioGRID's
 * public REST API (https://wiki.thebiogrid.org/en/Help:Webservice)
 * as structured JSON‑schema tools that any MCP‑capable agent can
 * discover and invoke.
 *
 * ENVIRONMENT
 * ───────────
 *   • Requires a BioGRID API key. Set BIOGRID_API_KEY in your
 *     environment before running.
 *   • Node ≥18, TypeScript ≥5 (compiled via ts‑node / esbuild).
 *
 * TOOLS EXPOSED
 * ─────────────
 *   1. get_gene_interactions      – all interactions for a gene (physical + genetic)
 *   2. get_physical_interactions  – physical only
 *   3. get_genetic_interactions   – genetic only
 *   4. search_genes               – search by symbol / synonym
 *   5. export_edge_list           – edge list download for a set of BioGRID IDs
 */

import {
    Server,
    StdioServerTransport,
  } from '@modelcontextprotocol/sdk/server/index.js';
  import {
    ListToolsRequestSchema,
    CallToolRequestSchema,
    ListResourceTemplatesRequestSchema,
    ReadResourceRequestSchema,
    McpError,
    ErrorCode,
  } from '@modelcontextprotocol/sdk/types.js';
  import axios, { AxiosInstance } from 'axios';
  import dotenv from 'dotenv';
  import { ProcessEnv } from 'node:process';
  
  dotenv.config();
  
  //──────────────────────────────────────────────────────────────────────────────
  //  TYPE HELPERS  ──────────────────────────────────────────────────────────────
  //
  interface BioGridInteraction {
    BIOGRID_INTERACTION_ID: string;
    OFFICIAL_SYMBOL_A: string;
    OFFICIAL_SYMBOL_B: string;
    BIOGRID_ID_A: string;
    BIOGRID_ID_B: string;
    INTERACTION_TYPE: string; // "physical" | "genetic"
    EXPERIMENTAL_SYSTEM: string;
    EXPERIMENTAL_SYSTEM_TYPE: string; // "physical" | "genetic"
    AUTHOR: string;
    PUBMED_ID: string;
    TAXON_ID_A: string;
    TAXON_ID_B: string;
    THROUGH_PUT: string;
    SCORE: string;
  }
  
  interface GeneResult {
    BIOGRID_ID: string;
    OFFICIAL_SYMBOL: string;
    SYNONYMS: string;
    TAXON_ID: string;
    ORGANISM_NAME: string;
  }
  
  //──────────────────────────────────────────────────────────────────────────────
  //  ARG VALIDATION  ────────────────────────────────────────────────────────────
  //
  const isStringArray = (val: unknown): val is string[] => Array.isArray(val) && val.every((x) => typeof x === 'string');
  
  const assertEnv = (key: string): void => {
    if (!process.env[key]) {
      console.error(`[BioGRID MCP] Missing ${key} environment variable.`);
      process.exit(1);
    }
  };
  
  //──────────────────────────────────────────────────────────────────────────────
  //  SERVER CLASS  ──────────────────────────────────────────────────────────────
  //
  class BioGridServer {
    private server: Server;
    private api: AxiosInstance;
    private readonly apiKey: string;
  
    constructor() {
      assertEnv('BIOGRID_API_KEY');
      this.apiKey = process.env.BIOGRID_API_KEY as string;
  
      this.server = new Server(
        { name: 'biogrid-server', version: '1.0.0' },
        { capabilities: { resources: {}, tools: {} } }
      );
  
      this.api = axios.create({
        baseURL: 'https://webservice.thebiogrid.org',
        timeout: 20000,
        params: { format: 'json', accesskey: this.apiKey },
        headers: { 'User-Agent': 'BioGRID-MCP-Server/1.0.0' },
      });
  
      this.setupToolHandlers();
      this.setupResourceHandlers();
  
      this.server.onerror = (err: Error) => console.error('[MCP Error]', err);
      process.on('SIGINT', async () => {
        await this.server.close();
        process.exit(0);
      });
    }
  
    //───────────────────────────────────────────────────────────────────────────
    //  TOOL HANDLERS  ──────────────────────────────────────────────────────────
    //
  
    private setupToolHandlers() {
      // List tools
      this.server.setRequestHandler(ListToolsRequestSchema, async () => ({
        tools: [
          {
            name: 'get_gene_interactions',
            description: 'Retrieve all physical and genetic interactions for a gene symbol or BioGRID ID.',
            inputSchema: {
              type: 'object',
              properties: {
                gene: { type: 'string', description: 'Gene symbol or BioGRID ID.' },
                taxon_id: { type: 'string', description: 'NCBI Taxonomy ID (optional).' },
                max_results: { type: 'number', minimum: 1, maximum: 10000, description: 'Result cap (default 500).' },
              },
              required: ['gene'],
            },
          },
          {
            name: 'get_physical_interactions',
            description: 'Retrieve only PHYSICAL interactions for a gene.',
            inputSchema: {
              type: 'object',
              properties: {
                gene: { type: 'string' },
                taxon_id: { type: 'string' },
                max_results: { type: 'number', minimum: 1, maximum: 10000 },
              },
              required: ['gene'],
            },
          },
          {
            name: 'get_genetic_interactions',
            description: 'Retrieve only GENETIC interactions for a gene.',
            inputSchema: {
              type: 'object',
              properties: {
                gene: { type: 'string' },
                taxon_id: { type: 'string' },
                max_results: { type: 'number', minimum: 1, maximum: 10000 },
              },
              required: ['gene'],
            },
          },
          {
            name: 'search_genes',
            description: 'Search BioGRID for genes matching a query string.',
            inputSchema: {
              type: 'object',
              properties: {
                query: { type: 'string' },
                taxon_id: { type: 'string' },
                max_results: { type: 'number', minimum: 1, maximum: 100 },
              },
              required: ['query'],
            },
          },
          {
            name: 'export_edge_list',
            description: 'Export edge list for a set of BioGRID gene IDs.',
            inputSchema: {
              type: 'object',
              properties: {
                biogrid_ids: { type: 'array', items: { type: 'string' }, description: 'Array of BIOGRID IDs.' },
                interaction_type: { type: 'string', enum: ['physical', 'genetic', 'all'], description: 'Edge filter.' },
              },
              required: ['biogrid_ids'],
            },
          },
        ],
      }));
  
      // Execute tool
      this.server.setRequestHandler(CallToolRequestSchema, async (req: any) => {
        const { name, arguments: args } = req.params;
        switch (name) {
          case 'get_gene_interactions':
            return this.runInteractionQuery(args.gene, args.taxon_id, 'all', args.max_results);
          case 'get_physical_interactions':
            return this.runInteractionQuery(args.gene, args.taxon_id, 'physical', args.max_results);
          case 'get_genetic_interactions':
            return this.runInteractionQuery(args.gene, args.taxon_id, 'genetic', args.max_results);
          case 'search_genes':
            return this.runGeneSearch(args.query, args.taxon_id, args.max_results);
          case 'export_edge_list':
            return this.runEdgeExport(args.biogrid_ids, args.interaction_type || 'all');
          default:
            throw new McpError(ErrorCode.MethodNotFound, `Unknown tool: ${name}`);
        }
      });
    }
  
    //───────────────────────────────────────────────────────────────────────────
    //  RESOURCE TEMPLATES (MINIMAL)  ───────────────────────────────────────────
    //
    private setupResourceHandlers() {
      this.server.setRequestHandler(ListResourceTemplatesRequestSchema, async () => ({
        resourceTemplates: [
          {
            uriTemplate: 'biogrid://export/{biogrid_ids}',
            name: 'BioGRID edge list',
            mimeType: 'application/json',
            description: 'Edge list JSON for a set of BIOGRID IDs',
          },
        ],
      }));
  
      this.server.setRequestHandler(ReadResourceRequestSchema, async (req: any) => {
        const uri = req.params.uri;
        const match = uri.match(/^biogrid:\/\/export\/(.+)$/);
        if (!match) throw new McpError(ErrorCode.InvalidRequest, 'Invalid biogrid URI');
        const ids = decodeURIComponent(match[1]).split(',');
        const result = await this.runEdgeExport(ids, 'all');
        return {
          contents: [
            {
              uri,
              mimeType: 'application/json',
              text: result.content[0].text,
            },
          ],
        };
      });
    }
  
    //───────────────────────────────────────────────────────────────────────────
    //  ACTUAL QUERY HELPERS  ───────────────────────────────────────────────────
    //
    private async runInteractionQuery(
      gene: string,
      taxon_id: string | undefined,
      type: 'physical' | 'genetic' | 'all',
      max_results: number | undefined
    ) {
      if (typeof gene !== 'string') throw new McpError(ErrorCode.InvalidParams, 'gene must be string');
      const params: Record<string, string> = {
        searchNames: 'true',
        geneList: gene,
        includeInteractors: 'true',
        start: '0',
        max: String(max_results || 500),
      };
      if (taxon_id) params.taxonId = taxon_id;
      if (type !== 'all') params.interSpeciesExcluded = 'true', params.experimentalSystemType = type;
  
      try {
        const { data } = await this.api.get<BioGridInteraction[]>('/interactions/', { params });
        const filtered = data.filter((d: BioGridInteraction) => type === 'all' || d.EXPERIMENTAL_SYSTEM_TYPE.toLowerCase() === type);
        return {
          content: [
            {
              type: 'text',
              text: JSON.stringify(
                {
                  query_gene: gene,
                  interaction_type: type,
                  count: filtered.length,
                  edges: filtered.map((d: BioGridInteraction) => ({
                    a: d.OFFICIAL_SYMBOL_A,
                    b: d.OFFICIAL_SYMBOL_B,
                    biogrid_interaction_id: d.BIOGRID_INTERACTION_ID,
                    experimental_system: d.EXPERIMENTAL_SYSTEM,
                    system_type: d.EXPERIMENTAL_SYSTEM_TYPE,
                    pubmed_id: d.PUBMED_ID,
                  })),
                },
                null,
                2
              ),
            },
          ],
        };
      } catch (err: any) {
        throw new McpError(ErrorCode.InternalError, `BioGRID API error: ${err.message || err}`);
      }
    }
  
    private async runGeneSearch(query: string, taxon_id: string | undefined, max_results: number | undefined) {
      if (typeof query !== 'string') throw new McpError(ErrorCode.InvalidParams, 'query must be string');
      const params: Record<string, string> = {
        searchNames: 'true',
        geneList: query,
        start: '0',
        max: String(max_results || 25),
      };
      if (taxon_id) params.taxonId = taxon_id;
  
      try {
        const { data } = await this.api.get<GeneResult[]>('/gene/', { params });
        return {
          content: [
            {
              type: 'text',
              text: JSON.stringify({
                query,
                count: data.length,
                genes: data.map((g: GeneResult) => ({
                  biogrid_id: g.BIOGRID_ID,
                  symbol: g.OFFICIAL_SYMBOL,
                  synonyms: g.SYNONYMS.split('|'),
                  taxon_id: g.TAXON_ID,
                  organism: g.ORGANISM_NAME,
                })),
              }, null, 2),
            },
          ],
        };
      } catch (err: any) {
        throw new McpError(ErrorCode.InternalError, `BioGRID gene search error: ${err.message || err}`);
      }
    }
  
    private async runEdgeExport(ids: string[], interaction_type: 'physical' | 'genetic' | 'all') {
      if (!isStringArray(ids) || ids.length === 0) throw new McpError(ErrorCode.InvalidParams, 'biogrid_ids array required');
      const params: Record<string, string> = {
        geneList: ids.join('|'),
        includeInteractors: 'false',
        format: 'json',
        start: '0',
        max: '10000',
        accesskey: this.apiKey,
      };
      if (interaction_type !== 'all') params.experimentalSystemType = interaction_type;
  
      try {
        const { data } = await this.api.get<BioGridInteraction[]>('/interactions/', { params });
        const edgeList = data.map((d: BioGridInteraction) => [d.OFFICIAL_SYMBOL_A, d.OFFICIAL_SYMBOL_B]);
        return {
          content: [
            {
              type: 'text',
              text: JSON.stringify({ edge_list: edgeList, count: edgeList.length }, null, 2),
            },
          ],
        };
      } catch (err: any) {
        throw new McpError(ErrorCode.InternalError, `BioGRID edge export error: ${err.message || err}`);
      }
    }
  
    //───────────────────────────────────────────────────────────────────────────
    async run() {
      const transport = new StdioServerTransport();
      await this.server.connect(transport);
      console.error('[BioGRID MCP] server listening on stdio');
    }
  }
  
  new BioGridServer().run().catch(console.error);
  