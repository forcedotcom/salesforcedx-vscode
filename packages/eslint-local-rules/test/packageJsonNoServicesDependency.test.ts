/*
 * Copyright (c) 2026, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */

import { packageJsonNoServicesDependency } from '../src/packageJsonNoServicesDependency';
import { createJsonLinter, filterByRule } from './jsonLintHelper';

const RULE_NAME = 'package-json-no-services-dependency';

describe(RULE_NAME, () => {
  const lintJson = createJsonLinter(RULE_NAME, packageJsonNoServicesDependency);

  it('passes when services is an extensionDependency and devDependency', () => {
    const code = JSON.stringify(
      {
        extensionDependencies: ['salesforce.salesforcedx-vscode-services'],
        devDependencies: { 'salesforcedx-vscode-services': '*' }
      },
      undefined,
      2
    );

    expect(filterByRule(lintJson(code), RULE_NAME)).toHaveLength(0);
  });

  it('passes when dependencies do not include services', () => {
    const code = JSON.stringify({ dependencies: { 'salesforcedx-vscode-core': '*' } }, undefined, 2);

    expect(filterByRule(lintJson(code), RULE_NAME)).toHaveLength(0);
  });

  it('reports services under dependencies', () => {
    const code = JSON.stringify({ dependencies: { 'salesforcedx-vscode-services': '*' } }, undefined, 2);
    const errors = filterByRule(lintJson(code), RULE_NAME);

    expect(errors).toHaveLength(1);
    expect(errors[0].messageId).toBe('servicesDependency');
    expect(errors[0].message).toContain('devDependencies');
  });

  it('reports services under dependencies for Windows paths', () => {
    const code = JSON.stringify({ dependencies: { 'salesforcedx-vscode-services': '*' } }, undefined, 2);

    expect(filterByRule(lintJson(code, String.raw`C:\repo\packages\test\package.json`), RULE_NAME)).toHaveLength(1);
  });

  it('ignores package.json files outside packages/*', () => {
    const code = JSON.stringify({ dependencies: { 'salesforcedx-vscode-services': '*' } }, undefined, 2);

    expect(filterByRule(lintJson(code, 'package.json'), RULE_NAME)).toHaveLength(0);
  });
});
