/*
 * Copyright (c) 2026, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */

import * as fs from 'node:fs/promises';
import * as os from 'node:os';
import * as path from 'node:path';

import { env, execAsync, MINIMAL_ORG_ALIAS, NON_TRACKING_ORG_ALIAS } from '@salesforce/playwright-vscode-ext';

import { isContainer } from '../fixtures';

// The org a `sharedTest` spec runs against: desktop's fixture targets the non-tracking org; the
// container uses its boot (minimal) org.
export const ORG_ALIAS = isContainer ? MINIMAL_ORG_ALIAS : NON_TRACKING_ORG_ALIAS;

const APEX_CLASS_META = [
  '<?xml version="1.0" encoding="UTF-8"?>',
  '<ApexClass xmlns="http://soap.sforce.com/2006/04/metadata">',
  '    <apiVersion>64.0</apiVersion>',
  '    <status>Active</status>',
  '</ApexClass>'
].join('\n');

export const makeApexTestClass = (name: string, methodName = 'passes'): string =>
  [
    '@isTest',
    `public class ${name} {`,
    '\t@isTest',
    `\tstatic void ${methodName}() {`,
    `\t\tSystem.assertEquals(1, 1, '${name}');`,
    '\t}',
    '}'
  ].join('\n');

/** In the Code Builder CI the boot org is authed on the host; a local run without that setup isn't. */
export const isOrgAuthedOnHost = (): Promise<boolean> =>
  execAsync(`sf org display -o ${ORG_ALIAS} --json`, { env })
    .then(() => true)
    .catch(() => false);

/**
 * ONE host-CLI deploy of Apex classes from a throwaway project, so the classes reach the org without
 * entering the workspace (an org-only class by construction) and nothing deploys through the extension
 * (no source-tracking conflict prompt). `--ignore-conflicts` keeps the container's source-tracked boot
 * org from rejecting a fresh, unrelated project.
 */
export const deployApexClassesFromHost = async (
  classes: readonly { name: string; content: string }[]
): Promise<void> => {
  const tmpRoot = await fs.mkdtemp(path.join(os.tmpdir(), 'apex-testing-host-deploy-'));
  try {
    const classesDir = path.join(tmpRoot, 'force-app', 'main', 'default', 'classes');
    await fs.mkdir(classesDir, { recursive: true });
    await fs.writeFile(
      path.join(tmpRoot, 'sfdx-project.json'),
      JSON.stringify({ packageDirectories: [{ path: 'force-app', default: true }], sourceApiVersion: '64.0' })
    );
    for (const { name, content } of classes) {
      await fs.writeFile(path.join(classesDir, `${name}.cls`), content);
      await fs.writeFile(path.join(classesDir, `${name}.cls-meta.xml`), APEX_CLASS_META);
    }
    await execAsync(
      `sf project deploy start --source-dir force-app --target-org ${ORG_ALIAS} --ignore-conflicts --json`,
      { cwd: tmpRoot, env }
    );
  } finally {
    await fs.rm(tmpRoot, { recursive: true, force: true }).catch(() => {});
  }
};

/** `deployApexClassesFromHost` for `makeApexTestClass` classes. */
export const deployApexTestClassesFromHost = (classNames: readonly string[], methodName?: string): Promise<void> =>
  deployApexClassesFromHost(classNames.map(name => ({ name, content: makeApexTestClass(name, methodName) })));
