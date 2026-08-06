#!/usr/bin/env node
process.env.SALESFORCE_VISUAL_QA_MCP_MAIN = '1';
require('../out/src/mcpServer.js');
