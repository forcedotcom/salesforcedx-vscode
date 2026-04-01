/*
 * Copyright (c) 2025, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */

import { packageJsonSalesforceDepVersions } from '../src/packageJsonSalesforceDepVersions';
import { createJsonLinter, filterByRule } from './jsonLintHelper';

const RULE_NAME = 'package-json-salesforce-dep-versions';

describe('package-json-salesforce-dep-versions', () => {
  it('should be exported', () => {
    expect(packageJsonSalesforceDepVersions).toBeDefined();
    expect(packageJsonSalesforceDepVersions.meta?.type).toBe('problem');
  });

  describe('with Linter', () => {
    const lintJson = createJsonLinter(RULE_NAME, packageJsonSalesforceDepVersions);

    it('passes when @salesforce dep uses caret in dependencies', () => {
      const code = JSON.stringify({ name: 'test', dependencies: { '@salesforce/core': '^3.0.0' } }, null, 2);
      expect(filterByRule(lintJson(code), RULE_NAME)).toHaveLength(0);
    });

    it('passes when @salesforce dep uses caret in devDependencies', () => {
      const code = JSON.stringify({ name: 'test', devDependencies: { '@salesforce/cli': '^7.0.0' } }, null, 2);
      expect(filterByRule(lintJson(code), RULE_NAME)).toHaveLength(0);
    });

    it('errors when @salesforce dep is pinned (exact version)', () => {
      const code = JSON.stringify({ name: 'test', dependencies: { '@salesforce/core': '3.0.0' } }, null, 2);
      const errors = filterByRule(lintJson(code), RULE_NAME);
      expect(errors).toHaveLength(1);
      expect(errors[0].messageId).toBe('pinnedVersion');
    });

    it('errors when @salesforce dep uses tilde', () => {
      const code = JSON.stringify({ name: 'test', dependencies: { '@salesforce/core': '~3.0.0' } }, null, 2);
      const errors = filterByRule(lintJson(code), RULE_NAME);
      expect(errors).toHaveLength(1);
      expect(errors[0].messageId).toBe('pinnedVersion');
    });

    it('errors when @salesforce dep is pinned in devDependencies', () => {
      const code = JSON.stringify({ name: 'test', devDependencies: { '@salesforce/cli': '7.1.2' } }, null, 2);
      const errors = filterByRule(lintJson(code), RULE_NAME);
      expect(errors).toHaveLength(1);
      expect(errors[0].messageId).toBe('pinnedVersion');
    });

    it('passes when non-@salesforce dep is pinned', () => {
      const code = JSON.stringify({ name: 'test', dependencies: { lodash: '4.17.21' } }, null, 2);
      expect(filterByRule(lintJson(code), RULE_NAME)).toHaveLength(0);
    });

    it('passes when @salesforce dep uses workspace wildcard (*)', () => {
      const code = JSON.stringify({ name: 'test', dependencies: { '@salesforce/my-local-pkg': '*' } }, null, 2);
      expect(filterByRule(lintJson(code), RULE_NAME)).toHaveLength(0);
    });

    it('reports one error per pinned @salesforce dep', () => {
      const code = JSON.stringify(
        {
          name: 'test',
          dependencies: {
            '@salesforce/core': '3.0.0',
            '@salesforce/source-deploy-retrieve': '8.0.0'
          }
        },
        null,
        2
      );
      expect(filterByRule(lintJson(code), RULE_NAME)).toHaveLength(2);
    });

    it('skips files not matching packages/*/package.json', () => {
      const code = JSON.stringify({ name: 'test', dependencies: { '@salesforce/core': '3.0.0' } }, null, 2);
      expect(filterByRule(lintJson(code, 'some/other/file.json'), RULE_NAME)).toHaveLength(0);
    });

    it('passes when no @salesforce deps exist', () => {
      const code = JSON.stringify({ name: 'test', dependencies: { vscode: '^1.80.0' } }, null, 2);
      expect(filterByRule(lintJson(code), RULE_NAME)).toHaveLength(0);
    });

    it('passes when pinned-exception packages are pinned (@salesforce/apex, @salesforce/label, @salesforce/schema)', () => {
      const code = JSON.stringify(
        {
          name: 'test',
          dependencies: {
            '@salesforce/apex': '0.0.21',
            '@salesforce/label': '0.0.21',
            '@salesforce/schema': '0.0.21'
          }
        },
        null,
        2
      );
      expect(filterByRule(lintJson(code), RULE_NAME)).toHaveLength(0);
    });
  });
});
