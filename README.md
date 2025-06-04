<img src="logo/combined-logo.png" width="300" />
# biogrid-mcp-server

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
