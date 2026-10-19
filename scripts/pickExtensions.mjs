#!/usr/bin/env node
import { mkdir, rm, rename, symlink } from 'node:fs/promises';
import path from 'node:path';
import inquirer from 'inquirer';
import { discoverExtensions, extensionGroups, requiredExtensions, root } from './selectedExtensions.mjs';

const selectedExtensionsDir = path.join(root, '.vscode', 'selected-extensions');

const group =
  process.argv.length === 2
    ? 'interactive'
    : process.argv[2] === '--group' && process.argv.length === 4
      ? process.argv[3]
      : undefined;
const validGroups = ['interactive', 'all', ...Object.keys(extensionGroups)];

try {
  if (!group || !validGroups.includes(group)) {
    throw new Error(`Usage: node scripts/pickExtensions.mjs [--group ${validGroups.join('|')}]`);
  }

  // A cancelled prompt or failed discovery must never launch an earlier selection.
  await rm(selectedExtensionsDir, { recursive: true, force: true });
  const available = await discoverExtensions();
  const byName = new Map(available.map(extension => [extension.name, extension]));
  let selection;

  if (group === 'interactive') {
    if (!process.stdin.isTTY) throw new Error('The extension picker needs an interactive terminal.');
    const { selectedGroup } = await inquirer.prompt([
      {
        type: 'select',
        name: 'selectedGroup',
        message: 'Choose extensions to launch',
        choices: [
          ...Object.keys(extensionGroups).map(name => ({
            name: extensionGroups[name].label,
            value: name
          })),
          { name: 'Custom selection', value: undefined }
        ]
      }
    ]);
    if (selectedGroup) {
      selection = [...requiredExtensions, ...extensionGroups[selectedGroup].extensions];
    } else {
      const optional = available.filter(extension => !requiredExtensions.includes(extension.name));
      console.log(`Always included: ${requiredExtensions.join(', ')}`);
      const { selected } = await inquirer.prompt([
        {
          type: 'checkbox',
          name: 'selected',
          message: 'Choose additional extensions to launch',
          choices: optional.map(extension => ({
            name: `${extension.label} (${extension.name})`,
            value: extension.name
          }))
        }
      ]);
      selection = [...requiredExtensions, ...selected];
    }
  } else {
    selection =
      group === 'all'
        ? available.map(extension => extension.name)
        : [...requiredExtensions, ...extensionGroups[group].extensions];
  }

  for (let index = 0; index < selection.length; index++) {
    const extension = byName.get(selection[index]);
    if (!extension) throw new Error(`Unknown extension in group ${group}: ${selection[index]}`);
    for (const dependency of extension.dependencies) {
      if (!byName.has(dependency)) throw new Error(`Missing extension dependency: ${dependency}`);
      if (!selection.includes(dependency)) selection.push(dependency);
    }
  }

  const staging = `${selectedExtensionsDir}-${process.pid}`;
  await mkdir(staging);
  try {
    for (const name of selection) {
      await symlink(
        path.join(root, 'packages', name),
        path.join(staging, `salesforce.${name}`),
        process.platform === 'win32' ? 'junction' : 'dir'
      );
    }
    await rename(staging, selectedExtensionsDir);
  } finally {
    await rm(staging, { recursive: true, force: true });
  }
  console.log(`Launching ${selection.length} extension(s) in group ${group}: ${selection.join(', ')}`);
} catch (error) {
  console.error(error.name === 'ExitPromptError' ? 'Extension selection cancelled.' : error.message);
  process.exitCode = 1;
}
