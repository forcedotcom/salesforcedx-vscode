#!/usr/bin/env node
import { Client } from '@modelcontextprotocol/sdk/client/index.js';
import { StdioClientTransport } from '@modelcontextprotocol/sdk/client/stdio.js';
import { CallToolResultSchema } from '@modelcontextprotocol/sdk/types.js';

const client = new Client({ name: 'drivable-vscode-example', version: '1.0.0' });
const transport = new StdioClientTransport({
  command: './packages/drivable-vscode/bin/drivable-vscode-mcp.js'
});
const call = async (name, args = {}) => await client.callTool({ name, arguments: args }, CallToolResultSchema);
const text = result => {
  const item = result.content.find(content => content.type === 'text');
  if (!item || result.isError) throw new Error(item?.text ?? `${result}`);
  return JSON.parse(item.text);
};
const run = async objective => {
  text(await call('start', { objective, extensionMode: 'dev' }));
  const first = text(await call('observe'));
  text(
    await call('act', {
      observationSequence: first.sequence,
      action: { kind: 'waitForText', text: 'Explorer', timeoutMs: 10000 }
    })
  );
  const second = text(await call('observe'));
  if (second.sequence !== first.sequence + 1) throw new Error('Observation sequence did not advance');
  text(await call('finish'));
  return second.screenshotPath;
};

try {
  await client.connect(transport);
  const firstEvidence = await run('Capture the first VS Code observation');
  const secondEvidence = await run('Capture a second VS Code observation');
  console.log(`Validated 2 sequential drivable-vscode runs; evidence: ${firstEvidence}, ${secondEvidence}`);
} finally {
  await client.close();
}
