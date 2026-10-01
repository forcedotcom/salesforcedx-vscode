#!/usr/bin/env node
process.env.DRIVABLE_VSCODE_MCP_MAIN = '1';
require('../out/src/mcpServer.js');
