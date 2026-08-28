/*
 * Copyright (c) 2026, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */

import { redactPii } from '../../../src/observability/redactPii';

describe('redactPii', () => {
  it.each([
    ['first.last@example.com', '<REDACTED_USERNAME_OR_EMAIL>'],
    ['josé@example.com', '<REDACTED_USERNAME_OR_EMAIL>'],
    ["o'hara@example.com", '<REDACTED_USERNAME_OR_EMAIL>'],
    ['用户@例子.公司', '<REDACTED_USERNAME_OR_EMAIL>'],
    ['"quoted local"@example.com', '<REDACTED_USERNAME_OR_EMAIL>'],
    ['contact=first.last+scratch@example.co.uk', 'contact=<REDACTED_USERNAME_OR_EMAIL>'],
    ['from user@example.com to admin@example.org', 'from <REDACTED_USERNAME_OR_EMAIL> to <REDACTED_USERNAME_OR_EMAIL>']
  ])('redacts username-or-email shaped values anywhere in telemetry: %s', (value, expected) => {
    expect(redactPii(value)).toBe(expected);
  });

  it.each([
    [
      'sf org display --target-org first.last@example.com --json',
      'sf org display --target-org <REDACTED_USERNAME_OR_EMAIL> --json'
    ],
    [
      'sf org display --target-org "first.last@example.com" --json',
      'sf org display --target-org "<REDACTED_USERNAME_OR_EMAIL>" --json'
    ],
    ['sf org display --target-org=my-scratch-org --json', 'sf org display --target-org=<REDACTED_TARGET_ORG> --json'],
    ["sf org display -o 'my-scratch-org' --json", "sf org display -o '<REDACTED_TARGET_ORG>' --json"],
    ['sf org display -o=my-scratch-org --json', 'sf org display -o=<REDACTED_TARGET_ORG> --json'],
    ['Command failed: sf org display -o my-scratch-org', 'Command failed: sf org display -o <REDACTED_TARGET_ORG>']
  ])('redacts a target-org value while preserving command context: %s', (value, expected) => {
    expect(redactPii(value)).toBe(expected);
  });

  it('redacts target-org values embedded in error text', () => {
    expect(redactPii('Command failed: sf org display --target-org user@example.com --json\nError: unavailable')).toBe(
      'Command failed: sf org display --target-org <REDACTED_USERNAME_OR_EMAIL> --json\nError: unavailable'
    );
  });

  it('is idempotent', () => {
    const values = [
      'contact=<REDACTED_USERNAME_OR_EMAIL>',
      'sf org display --target-org <REDACTED_USERNAME_OR_EMAIL> --json',
      'sf org display --target-org <REDACTED_TARGET_ORG> --json'
    ];
    values.forEach(value => expect(redactPii(value)).toBe(value));
  });

  it('applies generic email redaction outside target-org arguments', () => {
    expect(redactPii('sf org display --target-dev-hub devhub@example.com --json')).toBe(
      'sf org display --target-dev-hub <REDACTED_USERNAME_OR_EMAIL> --json'
    );
  });

  it.each(['ps -e -o pid,ppid,command', 'git log -o output.txt'])(
    'does not treat non-sf -o as target-org: %s',
    value => {
      expect(redactPii(value)).toBe(value);
    }
  );
});
