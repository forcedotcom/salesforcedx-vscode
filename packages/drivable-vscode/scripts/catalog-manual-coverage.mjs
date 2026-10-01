#!/usr/bin/env node
import { Client } from '@modelcontextprotocol/sdk/client/index.js';
import { StdioClientTransport } from '@modelcontextprotocol/sdk/client/stdio.js';
import { CallToolResultSchema } from '@modelcontextprotocol/sdk/types.js';
import { existsSync, readdirSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';

const client = new Client({ name: 'drivable-catalog-coverage', version: '1.0.0' });
const transport = new StdioClientTransport({
  command: './packages/drivable-vscode/bin/drivable-vscode-mcp.js',
  stderr: 'inherit'
});
const call = async (name, args = {}) => await client.callTool({ name, arguments: args }, CallToolResultSchema);
const parseText = result => {
  const item = result.content.find(content => content.type === 'text');
  if (!item) throw new Error(`No text in ${JSON.stringify(result).slice(0, 500)}`);
  const parsed = JSON.parse(item.text);
  if (result.isError) throw new Error(parsed.message ?? item.text);
  return parsed;
};
const notes = [];
const log = message => {
  notes.push(message);
  console.log(message);
};

const observe = async () => parseText(await call('observe'));
const act = async (obs, action) => {
  parseText(await call('act', { observationSequence: obs.sequence, action }));
};
const tryAct = async (obs, action, label) => {
  try {
    await act(obs, action);
    log(`ok ${label}`);
    return true;
  } catch (error) {
    log(`fail ${label}: ${error.message}`);
    return false;
  }
};
const waitVisible = async (obs, text, label, timeoutMs = 30_000) =>
  tryAct(obs, { kind: 'waitForText', text, timeoutMs }, label);
const orgBrowserTree = obs => {
  const snap = obs.ariaSnapshot ?? '';
  const start = snap.indexOf('tree "Salesforce Org Browser"');
  if (start === -1) return '';
  const main = snap.indexOf('\n  - main:', start);
  return snap.slice(start, main === -1 ? undefined : main);
};
const treeHas = (obs, fragment) => orgBrowserTree(obs).includes(fragment);
const toolbarHas = (obs, fragment) => (obs.ariaSnapshot ?? '').includes(`button "${fragment}"`);
const finding = async payload => {
  parseText(await call('add_finding', payload));
};
const listFiles = dir => {
  if (!existsSync(dir)) return [];
  return readdirSync(dir, { withFileTypes: true }).flatMap(entry => {
    const next = join(dir, entry.name);
    if (entry.name === 'node_modules' || entry.name === '.git') return [];
    return entry.isDirectory() ? listFiles(next) : [next];
  });
};
const fieldMetaFiles = (workspaceDir, fieldName) =>
  listFiles(workspaceDir).filter(path => path.endsWith(`${fieldName}.field-meta.xml`));
const fieldRow = (obs, fieldName) =>
  orgBrowserTree(obs)
    .split('\n')
    .find(line => line.includes(fieldName) && line.includes('[level=3]'));
const applyFilter = async (obs, value, label) => {
  const filterButton = toolbarHas(obs, 'Edit Filter (active)') ? 'Edit Filter (active)' : 'Filter by Type/Component';
  if (!(await tryAct(obs, { kind: 'click', role: 'button', name: filterButton }, `open filter ${label}`))) {
    return false;
  }
  obs = await observe();
  await tryAct(obs, { kind: 'press', key: 'Meta+a' }, `select filter ${label}`);
  if (value.length === 0) {
    await tryAct(obs, { kind: 'press', key: 'Backspace' }, `clear filter ${label}`);
  } else {
    await tryAct(obs, { kind: 'type', text: value }, `type ${label}`);
  }
  await tryAct(obs, { kind: 'press', key: 'Enter' }, `commit ${label}`);
  return true;
};

const run = async () => {
  const started = parseText(
    await call('start', {
      objective:
        'Cover catalog manual gaps: Org Browser Custom Object fields, field retrieve + overwrite dialog, Reports folder vs component, Hide Local/Hide Org presence.',
      orgAlias: 'orgBrowserDreamhouseTestOrg',
      extensionMode: 'dev'
    })
  );
  log(`started runId=${started.runId} workspace=${started.workspaceDir} artifacts=${started.artifactDir}`);

  let obs = await observe();
  log(`obs#${obs.sequence} title=${obs.title}`);
  await waitVisible(obs, 'Explorer', 'wait Explorer', 15_000);
  obs = await observe();
  await tryAct(obs, { kind: 'click', role: 'button', name: 'Close (⌘W)' }, 'close Welcome');
  obs = await observe();

  const openedBrowser =
    (await tryAct(obs, { kind: 'click', role: 'tab', name: 'Salesforce Org Browser' }, 'click Org Browser tab')) ||
    (await tryAct(
      obs,
      { kind: 'command', title: 'Focus on Salesforce Org Browser View' },
      'command Focus Org Browser'
    ));
  if (!openedBrowser) {
    await finding({
      title: 'Could not open Org Browser',
      severity: 'high',
      area: 'Org Browser',
      steps: ['Start drivable session with orgBrowserDreamhouseTestOrg', 'Click Salesforce Org Browser tab'],
      expected: 'Org Browser view opens',
      actual: 'Neither activity-bar tab nor Focus command succeeded',
      confidence: 'high',
      evidence: [obs.screenshotPath]
    });
  }

  obs = await observe();
  await waitVisible(obs, 'ApexClass', 'wait ApexClass', 30_000);
  obs = await observe();
  if (!treeHas(obs, 'ApexClass')) {
    await finding({
      title: 'Org Browser types did not load',
      severity: 'high',
      area: 'Org Browser',
      steps: ['Open Org Browser', 'Wait for ApexClass in the Org Browser tree'],
      expected: 'Root metadata types including ApexClass',
      actual: orgBrowserTree(obs).slice(0, 400),
      confidence: 'high',
      evidence: [obs.screenshotPath]
    });
  } else {
    log('types visible in Org Browser tree');
  }

  await applyFilter(obs, 'CustomObject', 'CustomObject');
  obs = await observe();
  await waitVisible(obs, 'CustomObject', 'wait CustomObject after filter', 30_000);
  obs = await observe();
  writeFileSync('/tmp/drivable-catalog-aria-objects.txt', orgBrowserTree(obs));
  if (!treeHas(obs, 'treeitem "CustomObject')) {
    await finding({
      title: 'CustomObject missing after type filter',
      severity: 'high',
      area: 'Org Browser / catalog getChildren',
      steps: ['Open Org Browser', 'Filter by Type/Component CustomObject'],
      expected: 'CustomObject treeitem in Org Browser',
      actual: orgBrowserTree(obs).slice(0, 500),
      confidence: 'high',
      evidence: [obs.screenshotPath]
    });
  } else {
    await tryAct(obs, { kind: 'click', role: 'treeitem', name: 'CustomObject' }, 'expand CustomObject');
    obs = await observe();
    await waitVisible(obs, 'Broker__c', 'wait Broker__c', 30_000);
    obs = await observe();
    writeFileSync('/tmp/drivable-catalog-aria-objects.txt', orgBrowserTree(obs));
    if (!treeHas(obs, 'Broker__c') && !treeHas(obs, 'Property__c')) {
      await finding({
        title: 'Custom Object children missing',
        severity: 'high',
        area: 'Org Browser / catalog getChildren',
        steps: ['Open Org Browser', 'Filter CustomObject', 'Expand CustomObject'],
        expected: 'Broker__c or Property__c under CustomObject',
        actual: orgBrowserTree(obs).slice(0, 500),
        confidence: 'high',
        evidence: [obs.screenshotPath]
      });
    } else {
      const objectName = treeHas(obs, 'Broker__c') ? 'Broker__c' : 'Property__c';
      log(`found ${objectName} in tree`);
      await tryAct(obs, { kind: 'click', role: 'treeitem', name: objectName }, `expand ${objectName}`);
      obs = await observe();
      const fieldProbe = objectName === 'Broker__c' ? 'Email__c' : 'Name';
      await waitVisible(obs, fieldProbe, `wait field ${fieldProbe}`, 20_000);
      obs = await observe();
      writeFileSync('/tmp/drivable-catalog-aria-fields.txt', orgBrowserTree(obs));
      const hasField = /\[level=3\]/.test(orgBrowserTree(obs));
      if (!hasField) {
        await finding({
          title: 'Custom Object fields did not expand',
          severity: 'high',
          area: 'Org Browser / catalog field children',
          steps: ['Filter CustomObject', `Expand CustomObject`, `Expand ${objectName}`],
          expected: 'Field rows (level 3) under the object',
          actual: orgBrowserTree(obs).slice(0, 500),
          confidence: 'high',
          evidence: [obs.screenshotPath]
        });
      } else {
        log('fields visible under object');
        const beforeRow = fieldRow(obs, fieldProbe);
        log(`field row before retrieve: ${beforeRow ?? '(missing)'}`);
        await tryAct(obs, { kind: 'click', role: 'treeitem', name: fieldProbe }, `select ${fieldProbe}`);
        obs = await observe();
        writeFileSync('/tmp/drivable-catalog-aria-field-selected.txt', orgBrowserTree(obs));
        const retrieveField = async (current, label) =>
          tryAct(
            current,
            {
              kind: 'click',
              role: 'button',
              name: 'Retrieve Metadata',
              exact: true,
              within: { role: 'treeitem', name: fieldProbe }
            },
            `${label} Retrieve Metadata`
          );
        const confirmOverwriteIfShown = async (current, attempts, required) => {
          const loop = async (obs, i) => {
            if (await waitVisible(obs, 'Overwrite local files', `wait overwrite ${i}/${attempts}`, 30_000)) {
              const confirmed = await tryAct(
                obs,
                { kind: 'click', role: 'button', name: 'Yes', exact: true },
                'Yes overwrite'
              );
              log(`overwrite dialog shown attempt ${i}; Yes=${confirmed}`);
              return confirmed;
            }
            if (i >= attempts) {
              if (required) {
                const afterWait = await observe();
                await finding({
                  title: 'Retrieve overwrite dialog did not appear',
                  severity: 'high',
                  area: 'Org Browser / retrieve overwrite (window.dialogStyle custom)',
                  steps: [
                    `Expand CustomObject / ${objectName}`,
                    `Retrieve ${fieldProbe} into the workspace`,
                    `Retrieve ${objectName}`,
                    `Retrieve ${objectName} again`
                  ],
                  expected: 'Modal "Overwrite local files for N CustomObject?" with Yes',
                  actual: `dialogs=${JSON.stringify(afterWait.dialogs)} notifications=${JSON.stringify(afterWait.notifications)}`,
                  confidence: 'high',
                  evidence: [afterWait.screenshotPath]
                });
              } else {
                log('no overwrite dialog on this retrieve');
              }
              return false;
            }
            return loop(await observe(), i + 1);
          };
          return loop(current, 1);
        };
        const waitRetrieveSucceeded = async current => {
          const loop = async (obs, i) => {
            if (await waitVisible(obs, 'Retrieve Metadata succeeded.', `wait retrieve succeeded ${i}`, 30_000))
              return true;
            const retry = await observe();
            if ((retry.notifications ?? []).some(text => text.includes('Retrieve Metadata succeeded'))) return true;
            if (i >= 4) return false;
            return loop(retry, i + 1);
          };
          return loop(current, 1);
        };
        const assertFieldOnDisk = async (label, expectLocal) => {
          const files = fieldMetaFiles(started.workspaceDir, fieldProbe);
          const local = files.filter(path => path.includes('/force-app/') && !path.includes('metadata-shadow'));
          const shadow = files.filter(path => path.includes('metadata-shadow') || path.includes('sf-org-metadata'));
          log(`${label} field files local=${JSON.stringify(local)} shadow=${JSON.stringify(shadow)}`);
          if (expectLocal && local.length === 0) {
            await finding({
              title: 'Field retrieve did not write a workspace CustomField file',
              severity: 'high',
              area: 'Org Browser / catalog retrieve destination',
              steps: [`Retrieve ${objectName}.${fieldProbe}`],
              expected: `force-app/.../objects/${objectName}/fields/${fieldProbe}.field-meta.xml`,
              actual: `local=${JSON.stringify(local)} shadow=${JSON.stringify(shadow)} tabs=${JSON.stringify(obs.tabs)} editor=${obs.activeEditor ?? ''}`,
              confidence: 'high',
              evidence: [obs.screenshotPath]
            });
          }
          if (shadow.length > 0 && local.length === 0) {
            await finding({
              title: 'Field retrieve wrote shadow metadata instead of the project',
              severity: 'high',
              area: 'Org Browser / catalog retrieve destination',
              steps: [`Retrieve ${objectName}.${fieldProbe}`],
              expected: 'Workspace force-app field file, not metadata-shadow / sf-org-metadata',
              actual: `shadow=${JSON.stringify(shadow)}`,
              confidence: 'high',
              evidence: [obs.screenshotPath]
            });
          }
          return { local, shadow };
        };

        const firstRetrieve = await retrieveField(obs, 'first');
        if (!firstRetrieve) {
          await finding({
            title: 'Could not invoke Retrieve Metadata on the field',
            severity: 'high',
            area: 'Org Browser / field retrieve',
            steps: [`Select ${fieldProbe}`, 'Click Retrieve Metadata on the field row toolbar'],
            expected: 'Retrieve Metadata on the selected field row runs',
            actual: orgBrowserTree(obs).slice(0, 500),
            confidence: 'medium',
            evidence: [obs.screenshotPath]
          });
        } else {
          const firstDone = await waitRetrieveSucceeded(obs);
          log(`first retrieve succeeded toast=${firstDone}`);
          obs = await observe();
          writeFileSync('/tmp/drivable-catalog-aria-after-first-retrieve.txt', orgBrowserTree(obs));
          log(`field row after first retrieve: ${fieldRow(obs, fieldProbe) ?? '(missing)'}`);
          await assertFieldOnDisk('after first retrieve', true);
          const afterFieldRow = fieldRow(obs, fieldProbe);
          if (afterFieldRow?.includes('') === true) {
            await finding({
              title: 'Field icon stayed outline after retrieve into the workspace',
              severity: 'medium',
              area: 'Org Browser / filePresent icon',
              steps: [`Retrieve ${fieldProbe} into force-app`],
              expected: 'Filled local icon (pass-filled), not circle-large-outline',
              actual: afterFieldRow,
              confidence: 'medium',
              evidence: [obs.screenshotPath]
            });
          }
          const editor = `${obs.activeEditor ?? ''} ${JSON.stringify(obs.tabs)}`;
          if (editor.includes('sf-org-metadata') || editor.includes('metadata-shadow')) {
            await finding({
              title: 'Retrieved field opened from shadow / org-metadata URI',
              severity: 'high',
              area: 'Org Browser / retrieve destination',
              steps: [`Retrieve ${fieldProbe}`],
              expected: 'Editor/tab path under the disposable workspace force-app',
              actual: editor,
              confidence: 'high',
              evidence: [obs.screenshotPath]
            });
          }

          const retrieveObject = (current, label) =>
            tryAct(
              current,
              {
                kind: 'click',
                role: 'button',
                name: 'Retrieve Metadata',
                exact: true,
                within: { role: 'treeitem', name: objectName }
              },
              label
            );
          await tryAct(
            obs,
            { kind: 'click', role: 'treeitem', name: objectName },
            `select ${objectName} for overwrite`
          );
          obs = await observe();
          if (!(await retrieveObject(obs, `first ${objectName} retrieve`))) {
            await finding({
              title: 'Could not retrieve the parent object after the field was local',
              severity: 'high',
              area: 'Org Browser / retrieve overwrite',
              steps: [`Retrieve ${fieldProbe}`, `Retrieve ${objectName}`],
              expected: 'Retrieve Metadata on the object row runs',
              actual: orgBrowserTree(obs).slice(0, 500),
              confidence: 'medium',
              evidence: [obs.screenshotPath]
            });
          } else {
            await confirmOverwriteIfShown(obs, 1, false);
            const firstObjectDone = await waitRetrieveSucceeded(obs);
            log(`first ${objectName} retrieve succeeded toast=${firstObjectDone}`);
            obs = await observe();
            await tryAct(obs, { kind: 'click', role: 'treeitem', name: objectName }, `reselect ${objectName}`);
            obs = await observe();
            if (!(await retrieveObject(obs, `second ${objectName} retrieve`))) {
              await finding({
                title: 'Second object retrieve could not start',
                severity: 'high',
                area: 'Org Browser / retrieve overwrite',
                steps: [`Retrieve ${objectName} a second time`],
                expected: 'Retrieve Metadata runs again so overwrite can appear',
                actual: orgBrowserTree(obs).slice(0, 500),
                confidence: 'medium',
                evidence: [obs.screenshotPath]
              });
            } else {
              const overwrote = await confirmOverwriteIfShown(obs, 4, true);
              const objectDone = overwrote ? await waitRetrieveSucceeded(obs) : false;
              log(`second ${objectName} retrieve overwrite=${overwrote} succeeded toast=${objectDone}`);
              obs = await observe();
              writeFileSync('/tmp/drivable-catalog-aria-after-overwrite.txt', orgBrowserTree(obs));
            }
          }
        }
      }
    }
  }

  await applyFilter(obs, 'Report', 'Report');
  obs = await observe();
  await waitVisible(obs, 'Report', 'wait Report after filter', 30_000);
  obs = await observe();
  await tryAct(obs, { kind: 'click', role: 'treeitem', name: 'Report' }, 'expand Report');
  obs = await observe();
  await waitVisible(obs, 'unfiled$public', 'wait unfiled$public', 30_000);
  obs = await observe();
  writeFileSync('/tmp/drivable-catalog-aria-reports.txt', orgBrowserTree(obs));
  if (!treeHas(obs, 'unfiled$public')) {
    await finding({
      title: 'Report folder unfiled$public missing',
      severity: 'medium',
      area: 'Org Browser / catalog projectChildren folders',
      steps: ['Filter Report', 'Expand Report'],
      expected: 'unfiled$public folder under Report',
      actual: orgBrowserTree(obs).slice(0, 500),
      confidence: 'medium',
      evidence: [obs.screenshotPath]
    });
  } else {
    await tryAct(obs, { kind: 'click', role: 'treeitem', name: 'unfiled$public' }, 'expand unfiled$public');
    obs = await observe();
    writeFileSync('/tmp/drivable-catalog-aria-reports.txt', orgBrowserTree(obs));
    const folderChildren = orgBrowserTree(obs).includes('unfiled$public/');
    log(`unfiled$public expanded; folder children=${folderChildren}`);
    if (!folderChildren) {
      await finding({
        title: 'Report folder expanded with no components',
        severity: 'medium',
        area: 'Org Browser / catalog folder children',
        steps: ['Filter Report', 'Expand Report', 'Expand unfiled$public'],
        expected: 'Report components under unfiled$public',
        actual: orgBrowserTree(obs).slice(0, 500),
        confidence: 'medium',
        evidence: [obs.screenshotPath]
      });
    }
  }

  const hidLocal = await tryAct(obs, { kind: 'click', role: 'button', name: 'Hide Local Types' }, 'Hide Local Types');
  obs = await observe();
  writeFileSync('/tmp/drivable-catalog-aria-hide-local.txt', obs.ariaSnapshot ?? '');
  if (hidLocal) {
    await waitVisible(obs, 'Show Local Types', 'wait Show Local Types', 10_000);
    obs = await observe();
  }
  if (hidLocal && toolbarHas(obs, 'Show Local Types')) {
    log('Hide Local toggled');
    if (!treeHas(obs, 'Report') && !treeHas(obs, 'CustomObject') && !treeHas(obs, 'ApexClass')) {
      await finding({
        title: 'Hide Local emptied the Org Browser tree',
        severity: 'high',
        area: 'Org Browser / workspace scan catchAll',
        steps: ['Load org types with Report filter', 'Click Hide Local Types'],
        expected: 'Org-only types remain (Report with current filter)',
        actual: orgBrowserTree(obs).slice(0, 400),
        confidence: 'medium',
        evidence: [obs.screenshotPath]
      });
    }
  }
  if (toolbarHas(obs, 'Show Local Types')) {
    await tryAct(obs, { kind: 'click', role: 'button', name: 'Show Local Types' }, 'restore Show Local Types');
    obs = await observe();
  }

  await applyFilter(obs, 'ApexClass', 'ApexClass');
  obs = await observe();
  await waitVisible(obs, 'ApexClass', 'wait ApexClass after filter', 30_000);
  obs = await observe();
  const hidOrg = await tryAct(obs, { kind: 'click', role: 'button', name: 'Hide Org Types' }, 'Hide Org Types');
  obs = await observe();
  if (hidOrg) {
    await waitVisible(obs, 'Show Org Types', 'wait Show Org Types', 10_000);
    obs = await observe();
  }
  writeFileSync('/tmp/drivable-catalog-aria-hide-org.txt', orgBrowserTree(obs));
  if (hidOrg && toolbarHas(obs, 'Show Org Types')) {
    const localApex = treeHas(obs, 'ApexClass') || treeHas(obs, 'DrivableVscodeController');
    log(`Hide Org Types; local Apex visible=${localApex}`);
    if (!localApex) {
      await finding({
        title: 'Hide Org Types hid local seed metadata',
        severity: 'high',
        area: 'Org Browser / scanWorkspaceInventory catchAll',
        steps: [
          'Disposable workspace has ApexClass DrivableVscodeController',
          'Filter ApexClass',
          'Click Hide Org Types'
        ],
        expected: 'Local-only ApexClass remains',
        actual: orgBrowserTree(obs).slice(0, 400),
        confidence: 'medium',
        evidence: [obs.screenshotPath]
      });
    }
  } else if (hidOrg) {
    log('Hide Org click succeeded but Show Org Types did not appear');
  }

  log(
    'skip catalog state: SFDX: Show Org Metadata Catalog State is commandPalette when sf:internal_dev; enabling salesforcedx-vscode-core.internal-development makes core activate() return before project init'
  );

  const finished = parseText(await call('finish'));
  log(`finish ${JSON.stringify(finished)}`);
  return { started, finished, notes };
};

try {
  await client.connect(transport);
  const result = await run();
  writeFileSync('/tmp/drivable-catalog-notes.json', JSON.stringify(result, undefined, 2));
} catch (error) {
  console.error(error);
  try {
    parseText(await call('finish'));
  } catch (finishError) {
    console.error('finish failed', finishError);
  }
  process.exitCode = 1;
} finally {
  await client.close();
}
