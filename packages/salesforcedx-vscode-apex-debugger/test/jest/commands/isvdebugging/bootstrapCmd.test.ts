/*
 * Copyright (c) 2026, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */
import {
  INSTALLED_PACKAGES,
  ISVDEBUGGER,
  PACKAGE_XML,
  parseOrgNamespaceQueryResultJson,
  parsePackageInstalledListJson
} from '../../../../src/commands/isvdebugging/bootstrapCmd';

describe('isvDebugBootstrap pure helpers', () => {
  describe('exported consts', () => {
    it('exposes the temp/installed/package.xml names used to build project-relative paths', () => {
      expect(ISVDEBUGGER).toBe('isvdebuggermdapitmp');
      expect(INSTALLED_PACKAGES).toBe('installed-packages');
      expect(PACKAGE_XML).toBe('package.xml');
    });
  });

  describe('parseOrgNamespaceQueryResultJson', () => {
    it('returns the NamespacePrefix from the first record', () => {
      const json = JSON.stringify({ result: { records: [{ NamespacePrefix: 'acme' }] } });
      expect(parseOrgNamespaceQueryResultJson(json)).toBe('acme');
    });

    it('returns empty string when NamespacePrefix is null', () => {
      const json = JSON.stringify({ result: { records: [{ NamespacePrefix: null }] } });
      expect(parseOrgNamespaceQueryResultJson(json)).toBe('');
    });

    it('returns empty string when there are no records', () => {
      const json = JSON.stringify({ result: { records: [] } });
      expect(parseOrgNamespaceQueryResultJson(json)).toBe('');
    });
  });

  describe('parsePackageInstalledListJson', () => {
    it('maps subscriber-package fields into installed-package descriptors', () => {
      const json = JSON.stringify({
        result: [
          {
            SubscriberPackageId: '033000000000001',
            SubscriberPackageName: 'salesforce.fth',
            SubscriberPackageNamespace: 'sfth',
            SubscriberPackageVersionId: '04t000000000001',
            SubscriberPackageVersionName: 'v1',
            SubscriberPackageVersionNumber: '1.0.0.1'
          }
        ]
      });
      expect(parsePackageInstalledListJson(json)).toEqual([
        {
          id: '033000000000001',
          name: 'salesforce.fth',
          namespace: 'sfth',
          versionId: '04t000000000001',
          versionName: 'v1',
          versionNumber: '1.0.0.1'
        }
      ]);
    });

    it('returns an empty array when no packages are installed', () => {
      expect(parsePackageInstalledListJson(JSON.stringify({ result: [] }))).toEqual([]);
    });
  });
});
