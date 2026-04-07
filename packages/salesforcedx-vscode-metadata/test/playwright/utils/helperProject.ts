/*
 * Copyright (c) 2025, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */

import * as fs from 'node:fs/promises';
import * as path from 'node:path';
import { exec } from 'node:child_process';
import { promisify } from 'node:util';

const execAsync = promisify(exec);

/**
 * Helper project utility for creating remote conflicts in conflict detection tests.
 * Manages a separate SFDX project directory that deploys to the same org to simulate
 * remote changes.
 */
export const deployApexClass = async (
  dir: string,
  orgAlias: string,
  name: string,
  content: string
): Promise<void> => {
  const classDir = path.join(dir, 'force-app/main/default/classes');
  await fs.mkdir(classDir, { recursive: true });

  await fs.writeFile(path.join(classDir, `${name}.cls`), content);
  await fs.writeFile(
    path.join(classDir, `${name}.cls-meta.xml`),
    `<?xml version="1.0" encoding="UTF-8"?>
<ApexClass xmlns="http://soap.sforce.com/2006/04/metadata">
    <apiVersion>62.0</apiVersion>
    <status>Active</status>
</ApexClass>`
  );

  const { stdout, stderr } = await execAsync(
    `sf project deploy start -o ${orgAlias} --metadata ApexClass:${name} --ignore-conflicts`,
    { cwd: dir }
  );
  if (stdout) console.log(`Helper project deploy stdout: ${stdout}`);
  if (stderr) console.error(`Helper project deploy stderr: ${stderr}`);
};
