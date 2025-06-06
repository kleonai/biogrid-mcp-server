<img src="logo/combined-logo.png" width="1000" />

# BioGRID MCP server

This is a Model-Context-Protocol (MCP) endpoint server that unlocks BioGRID’s 2 × 10⁷ curated genetic and physical interactions for any LLM or autonomous agent to access the BioGRID API. This repository provides tools for your agent stack to go from raw gene symbols to publication-backed interaction networks, TSV edge lists, and ready-to-analyse statistics—all through schema-validated JSON calls. These tools self-describe inputs/outputs, so agents can discover, validate and correct calls on their own.

---

# Tools

1. get_interactions: Retrieve every BioGRID interaction that involves one gene.
2. get_neighbors: Lightweight wrapper returning first-degree partners for a single gene.
3. export_edge_list: Produce a TSV/CSV edge list for a set of genes – ready for Cytoscape or graph-tool.
4. search_genes: Fuzzy search BioGRID’s gene table to look up ambiguous symbols/aliases.
5. interaction_stats: Quick network summary for a gene list (counts, degree distribution, physical/genetic ratio).

---

# Resource templates

1. biogrid://edge-list/{gene1,gene2,…}: TSV edge list for a gene set (same as export_edge_list but cached & shareable)
2. biogrid://interaction/{biogrid_id}: Lets an agent cite one interaction as evidence without parsing the whole TSV.
3. biogrid://gene/{gene_symbol}: Quick “knowledge card” a model can quote when introducing a gene.
4. biogrid://publications/{pubmed_id}: Enables citation-aware answers or RAG pipelines without hitting NCBI.
5. biogrid://dataset/{dataset_id}: Bulk download of a specific BioGRID dataset release (tar/zip).

---

# Example Use-Cases

| Tool name             | Purpose                                                                                               | Core arguments (defaults)                                                                                   | Typical output                                                                                | Example use case                                                                                                                         |
| --------------------- | ----------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------- |
| **get_interactions**  | Retrieve every BioGRID interaction that involves **one gene**.                                        | `gene_symbol` **(required)**, `species` = 9606, `type` = `"all" \| "physical" \| "genetic"`, `limit` = 1000 | JSON array of interaction objects, each with partner, experimental system, PubMed IDs, score. | _“Show me all physical interactions reported for **TP53** so I can shortlist co-factor candidates for a CRISPR screen.”_                 |
| **get_neighbors**     | Lightweight wrapper returning **first-degree partners** only.                                         | Same args as above (`limit` defaults to 250).                                                               | JSON list of partner symbols plus metadata (great for prompt loops).                          | _Automatically expand a protein set: “Given **BRCA1**, return its top 25 genetic interactors and feed them into functional enrichment.”_ |
| **export_edge_list**  | Produce a TSV/CSV edge list for a **set of genes** – ready for Cytoscape, NetworkX, Gephi, etc.       | `gene_symbols[]` **(required)**, `species`, `type`                                                          | Single text blob (TSV) or chunked stream: source, target, interaction type, PubMed, evidence. | _“Create an edge list for the genes in my RNA-seq DEG list so I can cluster the network in Cytoscape and find functional modules.”_      |
| **search_genes**      | Fuzzy search BioGRID’s gene table to look up ambiguous symbols or aliases.                            | `query` **(required)**, `species`                                                                           | Ranked list with official symbol, systematic name, BioGRID ID and organism.                   | _Resolve an alias: “I’m not sure if **p85** maps to **PIK3R1** or **PIK3R2**—search and let me pick the correct high-confidence entry.”_ |
| **interaction_stats** | Quick network summary for a gene list (node/edge counts, degree distribution, physical:genetic ratio) | `gene_symbols[]` **(required)**, `species`, `type`                                                          | JSON with node-count, edge-count, mean degree, histogram buckets.                             | _“Before I export, give me a sanity check: How dense is the interaction network among my 50 Alzheimer’s hits?”_                          |

---

# Quick Install

### 1. Clone & Install

```bash
git clone https://github.com/<you>/biogrid-mcp-server.git
cd biogrid-mcp-server
npm install
```

### 2. Set your BioGRID API key

https://webservice.thebiogrid.org/
This is free for academic usages.

```bash
   export BIOGRID_API_KEY=YOUR_KEY_HERE
```

### 3. Run the sever

stdio mode is the best for local LLMs

```bash
npm run start
```

HTTP mode – expose on a port for remote agents (choose any free port):

```bash
npm run start:http -- --port 3335
```

You should see something like:

```bash
[BIOGRID-MCP] server ready – manifest at /.well-known/mcp/manifest.json
```

### 5. Tool call example

```bash
{
  "name": "get_neighbors",
  "arguments": {
    "gene_symbol": "TP53",
    "species": 9606,
    "type": "genetic",
    "limit": 250
  }
}
```

9606 here stands for the species 'human'.
Sample that you'll get

```bash
{
  "query": {"gene":"TP53","species":9606,"type":"genetic"},
  "neighbors": [
    {
      "partner": "MDM2",
      "biogridId": "111",
      "experimentalSystem": "Dosage Rescue",
      "pubmedIds": [12345]
    }
    /* … */
  ],
  "meta": {
    "total": 187,
    "timestamp": "YYYY-MM-DDTHH:MM:SSZ",
    "biogrid_version": "4.4.229"
  }
}
```

---

# Workflow examples across several MCP servers

1. Variant triage:
   search_genes → get_interactions → filter by genetic evidence → rank partners by PubMed support.

2. Module building:
   get_neighbors (seed genes) → export_edge_list → feed into GRAPH-MCP for clustering → overlay_expression.

3. Cross-DB enrichment:
   search_genes → STRING-MCP get_functional_enrichment → Reactome-MCP pathway overlay.

## Coming soon: http://github.com/kleonai/bio-mcp-servers for a list of Biology MCP servers and usage guides.

# Development guide

- src/api.ts – thin axios wrapper around BioGRID /interactions/ and /gene/ endpoints
- src/parsers.ts – converts TSV ➞ typed objects
- src/tools.ts – declare tool schemas and handlers
- src/server.ts – wire up MCP transport (stdio + express)
- Add new analytics (e.g., centrality, clustering) in src/analytics.ts

## Prerequisites

| Requirement         | Version              | Notes                                              |
| ------------------- | -------------------- | -------------------------------------------------- |
| **Node.js**         | ≥ 18 LTS             | TypeScript + ESM support                           |
| **npm**             | ≥ 9                  | ships with Node installations                      |
| **BioGRID API key** | _free_ for academics | [Request here](https://webservice.thebiogrid.org/) |

--------------------------------------------------------------------------------------------
The server has been developed by https://kleonlab.com/ 
