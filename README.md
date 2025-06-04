<img src="logo/combined-logo.png" width="1000" />
# Biogrid-mcp-server

This is a Model-Context-Protocol (MCP) endpoint server that unlocks BioGRID’s 2 × 10⁷ curated genetic and physical interactions for any LLM or autonomous agent to access the BioGRID API. This repository provides tools for your agent stack to go from raw gene symbols to publication-backed interaction networks, TSV edge lists, and ready-to-analyse statistics—all through schema-validated JSON calls. These tools self-describe inputs/outputs, so agents can discover, validate and correct calls on their own.

------------------------------------------------------------
# Tools 
1. get_interactions: Retrieve every BioGRID interaction that involves one gene.
2. get_neighbors: Lightweight wrapper returning first-degree partners for a single gene.
3. export_edge_list: Produce a TSV/CSV edge list for a set of genes – ready for Cytoscape or graph-tool.
4. search_genes: Fuzzy search BioGRID’s gene table to look up ambiguous symbols/aliases.
5. interaction_stats: Quick network summary for a gene list (counts, degree distribution, physical/genetic ratio).
-------------------------------------------------------------
# Resource templates 
1. biogrid://edge-list/{gene1,gene2,…}: TSV edge list for a gene set (same as export_edge_list but cached & shareable)
2. biogrid://interaction/{biogrid_id}: Lets an agent cite one interaction as evidence without parsing the whole TSV.
3. biogrid://gene/{gene_symbol}: Quick “knowledge card” a model can quote when introducing a gene.
4. biogrid://publications/{pubmed_id}: Enables citation-aware answers or RAG pipelines without hitting NCBI.
5. biogrid://dataset/{dataset_id}: Bulk download of a specific BioGRID dataset release (tar/zip).
-------------------------------------------------------------
# Example Use-Cases 
- Show me the interaction evidence connecting TP53 and MDM2, then link the PubMed abstracts.
- 


-------------------------------------------------------------
Ideal workflows
1. Variant triage:
search_genes → get_interactions → filter by genetic evidence → rank partners by PubMed support.

2. Module building:
get_neighbors (seed genes) → export_edge_list → feed into GRAPH-MCP for clustering → overlay_expression.

3. Cross-DB enrichment:
search_genes → STRING-MCP get_functional_enrichment → Reactome-MCP pathway overlay.



1. Quick Install
   git clone https://github.com/<you>/biogrid-mcp-server.git
   cd biogrid-mcp-server
   npm install

2. Set your BioGRID API key (free for academic use):
   export BIOGRID_API_KEY=YOUR_KEY_HERE

3. Run
   npm run start
   npm run start:http -- --port 3335
   [BIOGRID-MCP] server ready – manifest at /.well-known/mcp/manifest.json

4. Tool Synopsis

5. // Claude / OpenAI tool call
   {
   \"name\": \"get_neighbors\",
   \"arguments\": {
   \"gene_symbol\": \"TP53\",
   \"species\": 9606,
   \"type\": \"genetic\",
   \"limit\": 250
   }
   }

   Output:
   {
   \"query\": {\"gene\":\"TP53\",\"species\":9606,\"type\":\"genetic\"},
   \"neighbors\": [
   {\"partner\":\"MDM2\",\"biogridId\":\"111\",\"experimentalSystem\":\"Dosage Rescue\",\"pubmedIds\":[12345]},
   ...
   ],
   \"meta\": {\"total\": 187, \"timestamp\": \"2025-06-03T22:17:11Z\", \"biogrid_version\": \"4.4.229\"}
   }

6. Development guide
   src/api.ts – thin axios wrapper around BioGRID /interactions/ and /gene/ endpoints

src/parsers.ts – converts TSV ➞ typed objects

src/tools.ts – declare tool schemas and handlers

src/server.ts – wire up MCP transport (stdio + express)

Add new analytics (e.g., centrality, clustering) in src/analytics.ts
