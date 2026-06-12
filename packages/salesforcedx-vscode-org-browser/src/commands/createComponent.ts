/*
 * Copyright (c) 2026, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */
import * as vscode from 'vscode';

type CreateCommand = { commandId: string; label: string };

const ALL_CREATE_COMMANDS = new Map<string, CreateCommand>([
  ['ApexClass', { commandId: 'sf.apex.generate.class', label: 'New Apex Class' }],
  ['ApexTrigger', { commandId: 'sf.apex.generate.trigger', label: 'New Apex Trigger' }],
  ['LightningComponentBundle', { commandId: 'sf.metadata.lightning.generate.lwc', label: 'New LWC' }],
  ['AuraDefinitionBundle', { commandId: 'sf.lightning.generate.aura.component', label: 'New Aura Component' }],
  ['ApexPage', { commandId: 'sf.visualforce.generate.page', label: 'New Visualforce Page' }],
  ['ApexComponent', { commandId: 'sf.visualforce.generate.component', label: 'New Visualforce Component' }]
]);

export type CreateCommandMap = ReadonlyMap<string, CreateCommand>;

export const resolveAvailableCreateCommands = async (): Promise<CreateCommandMap> => {
  const registered = new Set(await vscode.commands.getCommands(true));
  const available = new Map<string, CreateCommand>();
  ALL_CREATE_COMMANDS.forEach((entry, xmlName) => {
    if (registered.has(entry.commandId)) available.set(xmlName, entry);
  });
  return available;
};
