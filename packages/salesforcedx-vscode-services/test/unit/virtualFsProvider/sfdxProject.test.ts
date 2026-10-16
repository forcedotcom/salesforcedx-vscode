/*
 * Copyright (c) 2026, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */

import * as fs from 'node:fs';
import * as path from 'node:path';
import { sfdxProjectJson } from '../../../src/virtualFsProvider/templates/sfdxProject';

const API_VERSION = '67.0';

const pkg = JSON.parse(fs.readFileSync(path.resolve(__dirname, '../../../package.json'), 'utf8'));

describe('default API version constants stay in sync', () => {
  it('sfdx-project.json template uses the expected sourceApiVersion', () => {
    expect(sfdxProjectJson.join('\n')).toContain(`"sourceApiVersion": "${API_VERSION}"`);
  });

  it('package.json apiVersion setting defaults to the expected version', () => {
    expect(pkg.contributes.configuration.properties['salesforce-web-console.apiVersion'].default).toBe(API_VERSION);
  });
});
