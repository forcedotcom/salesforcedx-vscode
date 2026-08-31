/*
 * Copyright (c) 2026, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */

import {
  SF_COMMAND_CATALOG_PROVENANCE,
  SF_COMMAND_TOKEN_SEQUENCES
} from '../../../src/observability/generated/sfCommandCatalog';

describe('generated Salesforce CLI command catalog', () => {
  it('records the exact CLI version that resolved from latest-rc', () => {
    expect(SF_COMMAND_CATALOG_PROVENANCE.package).toBe('@salesforce/cli');
    expect(SF_COMMAND_CATALOG_PROVENANCE.requestedChannel).toBe('latest-rc');
    expect(SF_COMMAND_CATALOG_PROVENANCE.resolvedVersion).toMatch(/^\d+\.\d+\.\d+(?:[-+].+)?$/);
  });

  it('is normalized, sorted, and deduplicated', () => {
    const commands = [...SF_COMMAND_TOKEN_SEQUENCES];
    expect(commands).toEqual([...new Set(commands)].toSorted());
    expect(commands.every(command => command.length > 0 && !command.includes(':'))).toBe(true);
    expect(SF_COMMAND_CATALOG_PROVENANCE.spellingCount).toBe(commands.length);
    expect(SF_COMMAND_CATALOG_PROVENANCE.maxCommandTokens).toBe(
      Math.max(...commands.map(command => command.split(' ').length))
    );
  });

  it('contains canonical and permuted spellings used by the extensions', () => {
    expect(SF_COMMAND_TOKEN_SEQUENCES).toEqual(
      expect.arrayContaining(['org display', 'display org', 'org login web', 'web login org'])
    );
  });
});
