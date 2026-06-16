/*
 * Copyright (c) 2026, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */

import { createDesktopTest } from '@salesforce/playwright-vscode-ext';
import * as fs from 'node:fs/promises';
import * as path from 'node:path';

// Aura component markup, verbatim from test-tools `createAura` (lwcUtils.ts:141). Layout is
// load-bearing for the aura LSP specs:
//   L1 `<aura:component>`        — autocompletion spec types `<aura:appl` at L2 C1 (the tab line)
//   L3 `<aura:attribute name="simpleNewContact" …/>` — Go to Definition target (def site, col 27)
//   L8 `{!v.simpleNewContact}`   — Go to Definition source (ref site, cursor at 8:15)
const AURA_CMP = [
  '<aura:component>',
  '\t',
  '\t<aura:attribute name="simpleNewContact" type="Object"/>',
  '\t<div class="slds-page-header" role="banner">',
  '\t\t<h1 class="slds-m-right_small">Create New Contact</h1>',
  '\t</div>',
  '\t<aura:if isTrue="{!not(empty(v.simpleNewContact))}">',
  '\t\t{!v.simpleNewContact}',
  '\t</aura:if>',
  '</aura:component>'
].join('\n');

const AURA_CMP_META = [
  '<?xml version="1.0" encoding="UTF-8"?>',
  '<AuraDefinitionBundle xmlns="http://soap.sforce.com/2006/04/metadata">',
  '    <apiVersion>64.0</apiVersion>',
  '    <description>A Lightning Component Bundle</description>',
  '</AuraDefinitionBundle>'
].join('\n');

// aura LSP specs do not exercise Push/Pull, so the workspace has no org. The aura1 bundle is
// pre-seeded onto disk before Electron launches so the Aura Language Server's startup scan picks
// it up — drops the WDIO `reloadWindow` workaround.
const baseTest = createDesktopTest({
  fixturesDir: __dirname,
  additionalExtensionDirs: ['salesforcedx-vscode-core'],
  disableOtherExtensions: false,
  userSettings: {
    // Prevent Go to Definition from opening a peek widget when the target file is already open
    // (within-file nav for aura) — navigate directly instead.
    'editor.gotoLocation.multipleDefinitions': 'goto',
    'editor.gotoLocation.multipleDeclarations': 'goto',
    'editor.gotoLocation.multipleImplementations': 'goto',
    'editor.gotoLocation.multipleTypeDefinitions': 'goto',
    'editor.gotoLocation.multipleReferences': 'goto',
    'editor.gotoLocation.alternativeDefinitionCommand': ''
  }
});

// Override `workspaceDir` so the aura1 bundle lands on disk before Electron is launched (which
// depends on workspaceDir). The Aura LS scans the project at startup; files written after launch
// require a window reload.
export const noOrgDesktopTest = baseTest.extend<{ workspaceDir: string }>({
  workspaceDir: async ({ workspaceDir }, use) => {
    const bundleDir = path.join(workspaceDir, 'force-app', 'main', 'default', 'aura', 'aura1');
    await fs.mkdir(bundleDir, { recursive: true });
    await Promise.all([
      fs.writeFile(path.join(bundleDir, 'aura1.cmp'), AURA_CMP),
      fs.writeFile(path.join(bundleDir, 'aura1.cmp-meta.xml'), AURA_CMP_META)
    ]);
    await use(workspaceDir);
  }
});
