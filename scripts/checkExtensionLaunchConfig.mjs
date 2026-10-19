#!/usr/bin/env node
import { readFile } from 'node:fs/promises';
import path from 'node:path';
import ts from 'typescript';
import { discoverExtensions, extensionGroups, requiredExtensions, root } from './selectedExtensions.mjs';

const pickerName = 'pickExtensions.mjs';
const developmentPath = '--extensionDevelopmentPath=${workspaceFolder}/.vscode/selected-extensions';
const buildTask = 'Compile and Bundle';

async function readJson(file) {
  return JSON.parse(await readFile(path.join(root, file), 'utf8'));
}

async function check() {
  const extensions = await discoverExtensions();
  const available = new Set(extensions.map(extension => extension.name));
  if (!Array.isArray(requiredExtensions) || requiredExtensions.length === 0) {
    throw new Error('Required extensions must be a non-empty array.');
  }
  for (const name of requiredExtensions) {
    if (!available.has(name)) throw new Error(`Required extension is missing: ${name}`);
  }
  for (const extension of extensions) {
    for (const dependency of extension.dependencies) {
      if (!available.has(dependency)) {
        throw new Error(`${extension.name} depends on a missing extension: ${dependency}`);
      }
    }
  }
  for (const [group, definition] of Object.entries(extensionGroups)) {
    if (typeof definition.label !== 'string' || definition.label.trim() === '') {
      throw new Error(`Group ${group} must have a label.`);
    }
    const { extensions: members } = definition;
    if (!Array.isArray(members) || members.length === 0) throw new Error(`Group ${group} must have extension names.`);
    const seen = new Set();
    for (const name of members) {
      if (!available.has(name)) throw new Error(`Group ${group} references a missing extension: ${name}`);
      if (requiredExtensions.includes(name)) throw new Error(`Group ${group} duplicates required extension: ${name}`);
      if (seen.has(name)) throw new Error(`Group ${group} lists ${name} more than once.`);
      seen.add(name);
    }
  }

  const tasks = new Map((await readJson('.vscode/tasks.json')).tasks.map(task => [task.label, task]));
  const launchText = await readFile(path.join(root, '.vscode', 'launch.json'), 'utf8');
  const parsedLaunch = ts.parseConfigFileTextToJson('.vscode/launch.json', launchText);
  if (parsedLaunch.error) throw new Error(ts.flattenDiagnosticMessageText(parsedLaunch.error.messageText, '\n'));

  let checked = 0;
  function inspectTask(label, ancestors = new Set()) {
    const task = tasks.get(label);
    if (!task) throw new Error(`Missing prelaunch task: ${label}`);
    if (ancestors.has(label)) throw new Error(`Task dependency cycle at ${label}`);
    const nextAncestors = new Set(ancestors).add(label);
    const childResults = (task.dependsOn ?? []).map(dependency => inspectTask(dependency, nextAncestors));
    let built = label === buildTask;
    const selectors = [];
    const pickerIndex = task.args?.findIndex(arg => typeof arg === 'string' && arg.endsWith(`/${pickerName}`));
    if (pickerIndex >= 0) {
      const groupIndex = task.args.indexOf('--group', pickerIndex + 1);
      const group = task.args[groupIndex + 1];
      if (groupIndex < 0 || !['interactive', 'all', ...Object.keys(extensionGroups)].includes(group)) {
        throw new Error(`Task ${label} uses an unknown extension group: ${group}`);
      }
      selectors.push(group);
    }
    for (const child of childResults) {
      built ||= child.built;
      selectors.push(...child.selectors);
    }
    if (childResults.some(child => child.built) && childResults.some(child => child.selectors.length)) {
      if (task.dependsOrder !== 'sequence') throw new Error(`Task ${label} must build before selecting extensions.`);
      let buildSeen = false;
      for (const child of childResults) {
        if (child.selectors.length && !buildSeen) throw new Error(`Task ${label} selects extensions before building.`);
        buildSeen ||= child.built;
      }
    }
    return { built, selectors };
  }

  for (const launch of parsedLaunch.config.configurations) {
    if (launch.type !== 'extensionHost') continue;
    if (!launch.args?.includes(developmentPath)) {
      throw new Error(`${launch.name} must use the picker development path.`);
    }
    const result = inspectTask(launch.preLaunchTask);
    if (result.selectors.length !== 1) {
      throw new Error(`${launch.name} must reach exactly one extension picker task.`);
    }
    checked++;
  }
  console.log(
    `Validated ${Object.keys(extensionGroups).length} extension groups and ${checked} extension-host launches.`
  );
}

try {
  await check();
} catch (error) {
  console.error(`Extension launch configuration: ${error.message}`);
  process.exitCode = 1;
}
