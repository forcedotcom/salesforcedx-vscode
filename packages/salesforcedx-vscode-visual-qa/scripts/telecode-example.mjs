#!/usr/bin/env node
import { Client } from '@modelcontextprotocol/sdk/client/index.js';
import { StdioClientTransport } from '@modelcontextprotocol/sdk/client/stdio.js';
import { CallToolResultSchema } from '@modelcontextprotocol/sdk/types.js';

const client = new Client({ name: 'telecode-example', version: '1.0.0' });
const transport = new StdioClientTransport({
  command: './packages/salesforcedx-vscode-visual-qa/bin/telecode-mcp.js'
});
const call = async (name, args = {}) => await client.callTool({ name, arguments: args }, CallToolResultSchema);
const text = result => {
  const item = result.content.find(content => content.type === 'text');
  if (!item || result.isError) throw new Error(item?.text ?? `${result}`);
  return JSON.parse(item.text);
};

try {
  await client.connect(transport);
  text(await call('start', { objective: 'Capture a repeatable VS Code observation', extensionMode: 'dev' }));
  const first = text(await call('observe'));
  text(
    await call('act', {
      observationSequence: first.sequence,
      action: { kind: 'waitForText', text: 'Explorer', timeoutMs: 10000 }
    })
  );
  const second = text(await call('observe'));
  if (second.sequence !== first.sequence + 1) throw new Error('Observation sequence did not advance');
  console.log(`Validated Telecode run; evidence: ${second.screenshotPath}`);
} finally {
  text(await call('finish'));
  await client.close();
}
