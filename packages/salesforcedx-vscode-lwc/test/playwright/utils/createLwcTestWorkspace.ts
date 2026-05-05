/*
 * Copyright (c) 2026, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */

/* Node fs/path: desktop fixture + headless server bootstrap only — not used from browser-driven web spec steps. */

import * as fs from 'node:fs/promises';
import * as path from 'node:path';

/** Seeded bundle content for `gtdHtmlComp` after **SFDX: Create Lightning Web Component** (replace template defaults). */
export const LWC_GTD_HTML_COMP_SEED_JS = `import { LightningElement } from 'lwc';

export default class Lwc1 extends LightningElement {
    greeting = 'Hello, World!';
}
`;

export const LWC_GTD_HTML_COMP_SEED_HTML = `<template>
    <p>{greeting}</p>
</template>
`;

/** Minimal `CustomLabels.labels-meta.xml` under scratch workspaces (optional metadata for LSP typings). */
const LWC_E2E_SEED_CUSTOM_LABELS_XML = `<?xml version="1.0" encoding="UTF-8"?>
<CustomLabels xmlns="http://soap.sforce.com/2006/04/metadata">
    <labels>
        <fullName>LwcE2eSeedLabel</fullName>
        <value>Seed value</value>
    </labels>
</CustomLabels>
`;

/** `force-app/main/default/lwc` + labels so the LSP can emit `customlabels.d.ts`; LWCs are created in tests via **SFDX: Create Lightning Web Component**. */
export const seedLwcHeadlessWorkspaceSupplement = async (workspaceDir: string): Promise<void> => {
  const lwcDir = path.join(workspaceDir, 'force-app', 'main', 'default', 'lwc');
  await fs.mkdir(lwcDir, { recursive: true });
  const labelsDir = path.join(workspaceDir, 'force-app', 'main', 'default', 'labels');
  await fs.mkdir(labelsDir, { recursive: true });
  await fs.writeFile(path.join(labelsDir, 'CustomLabels.labels-meta.xml'), LWC_E2E_SEED_CUSTOM_LABELS_XML);
};

/**
 * Empty `snippetsE2E` bundle only — {@link ../specs/lwcSnippets.headless.spec.ts} opens these files before insert/completion;
 * not created via SFDX to keep the HTML/JS bodies empty for snippet assertions.
 */
export const seedSnippetsE2eEmptyBundle = async (workspaceDir: string): Promise<void> => {
  const bundleDir = path.join(workspaceDir, 'force-app', 'main', 'default', 'lwc', 'snippetsE2E');
  await fs.mkdir(bundleDir, { recursive: true });
  await Promise.all([
    fs.writeFile(path.join(bundleDir, 'snippetsE2E.html'), '', 'utf8'),
    fs.writeFile(path.join(bundleDir, 'snippetsE2E.js'), '', 'utf8')
  ]);
};
