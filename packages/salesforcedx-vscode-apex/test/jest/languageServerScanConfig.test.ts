/*
 * Copyright (c) 2026, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */

import { deriveExcludedMetadataFolders } from '../../src/languageServerScanConfig';

describe('languageServerScanConfig', () => {
  describe('deriveExcludedMetadataFolders', () => {
    it('excludes strict metadata directories that are not apex folders', () => {
      const registry = {
        strictDirectoryNames: {
          classes: 'apexclass',
          triggers: 'apextrigger',
          lwc: 'lightningcomponentbundle',
          staticresources: 'staticresource'
        }
      };

      const result = deriveExcludedMetadataFolders(registry, new Set(['classes', 'triggers']));

      expect(result).toEqual(['lwc', 'staticresources']);
    });

    it('normalizes folder names and filters empty values', () => {
      const registry = {
        strictDirectoryNames: {
          ' Classes ': 'apexclass',
          '': 'invalid',
          Objects: 'customobject'
        }
      };

      const result = deriveExcludedMetadataFolders(registry, new Set(['classes']));

      expect(result).toEqual(['objects']);
    });

    it('returns empty list when strictDirectoryNames is missing', () => {
      expect(deriveExcludedMetadataFolders({}, new Set(['classes', 'triggers']))).toEqual([]);
    });
  });
});
