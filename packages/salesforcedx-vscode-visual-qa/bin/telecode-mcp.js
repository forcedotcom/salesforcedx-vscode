#!/usr/bin/env node
process.env.TELECODE_MCP_MAIN = '1';
require('../out/src/mcpServer.js');
