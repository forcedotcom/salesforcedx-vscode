/*
 * Copyright (c) 2026, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */

import { redactSensitiveData } from '../../../src/observability/redactSensitiveData';
import { SF_COMMAND_TOKEN_SEQUENCES } from '../../../src/observability/generated/sfCommandCatalog';

describe('catalog-driven sf command redaction', () => {
  it.each([
    ['sf org display --json', 'sf org display --json'],
    ['sf display org --json', 'sf display org --json'],
    ['sf org:display --json', 'sf org:display --json'],
    ['sf display:org --json', 'sf display:org --json']
  ])('retains a catalogued command spelling and valueless flags: %s', (value, expected) => {
    expect(redactSensitiveData(value)).toBe(expected);
  });

  it('retains flag names while redacting attached values, separate values, and positional arguments', () => {
    expect(
      redactSensitiveData(
        'sf data query --query "SELECT Id FROM Account" --target-org=my-org record=value --json -- -literal'
      )
    ).toBe(
      'sf data query --query "<REDACTED COMMAND VALUE>" --target-org=<REDACTED COMMAND VALUE> <REDACTED COMMAND ARG> --json -- <REDACTED COMMAND ARG>'
    );
  });

  it('does not mistake a short flag with a concatenated value for a valueless flag', () => {
    expect(redactSensitiveData('sf org display -omy-secret --json')).toBe(
      'sf org display <REDACTED COMMAND ARG> --json'
    );
  });

  it('recognizes every generated space- and colon-separated command spelling', () => {
    for (const command of SF_COMMAND_TOKEN_SEQUENCES) {
      expect(redactSensitiveData(`sf ${command} --json`)).toBe(`sf ${command} --json`);
      const colonSpelling = command.replaceAll(' ', ':');
      expect(redactSensitiveData(`sf ${colonSpelling} --json`)).toBe(`sf ${colonSpelling} --json`);
    }
  });

  it('fails closed when a command is absent from the generated catalog', () => {
    expect(redactSensitiveData('Command failed: sf plugin secret --token value')).toBe(
      'Command failed: sf <REDACTED UNKNOWN COMMAND>'
    );
  });

  it('stops at shell and line boundaries and handles later commands independently', () => {
    expect(
      redactSensitiveData(
        [
          'sf org display --target-org first-org && sf org:open --target-org second-org',
          'Error: user@example.com'
        ].join('\n')
      )
    ).toBe(
      [
        'sf org display --target-org <REDACTED COMMAND VALUE> && sf org:open --target-org <REDACTED COMMAND VALUE>',
        'Error: <REDACTED USERNAME OR EMAIL>'
      ].join('\n')
    );
  });

  it('does not recognize a catalogued prefix inside a longer colon token', () => {
    expect(redactSensitiveData('sf org:display:not-a-command --target-org my-org')).toBe(
      'sf <REDACTED UNKNOWN COMMAND>'
    );
  });

  it('is idempotent for known and unknown command output', () => {
    const values = [
      'sf data query --query "<REDACTED COMMAND VALUE>" --json',
      'sf org display --target-org=<REDACTED COMMAND VALUE> --json',
      'sf alias set <REDACTED COMMAND ARG>',
      'sf <REDACTED UNKNOWN COMMAND>'
    ];

    values.forEach(value => expect(redactSensitiveData(value)).toBe(value));
  });
});
