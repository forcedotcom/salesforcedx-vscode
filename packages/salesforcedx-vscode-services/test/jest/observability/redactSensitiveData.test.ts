/*
 * Copyright (c) 2026, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */

import { redactSensitiveData } from '../../../src/observability/redactSensitiveData';

describe('redactSensitiveData', () => {
  describe('secrets', () => {
    describe('each shape gets its own label', () => {
      it('sfdx auth url', () => {
        expect(redactSensitiveData('auth force://PlatformCLI::5Aep861_ABC-xyz=@test.my.salesforce.com done')).toBe(
          'auth <REDACTED AUTH URL TOKEN> done'
        );
      });

      it('jwt', () => {
        expect(redactSensitiveData('bearer eyJhbGciOiJSUzI1NiJ9.eyJzdWIiOiIxMjMifQ.abc-_=sig tail')).toBe(
          'bearer <REDACTED JWT TOKEN> tail'
        );
      });

      it('opaque access token', () => {
        expect(redactSensitiveData('accessToken 00D000000000000!AQEAQKabcdef end')).toBe(
          'accessToken <REDACTED ACCESS TOKEN> end'
        );
      });

      it('Bearer header value', () => {
        expect(redactSensitiveData('Authorization: Bearer 5Aep861ABCdef')).toBe(
          'Authorization: <REDACTED BEARER TOKEN>'
        );
      });

      it('sid cookie', () => {
        expect(redactSensitiveData('cookie sid=00Dxx0000001gPLsecret; path=/')).toBe('cookie <REDACTED SID>; path=/');
      });

      it('refresh_token, url-encoded form', () => {
        expect(redactSensitiveData('grant_type=refresh_token&refresh_token=5Aep861ABC-xyz&client_id=x')).toBe(
          'grant_type=refresh_token&<REDACTED REFRESH TOKEN>&client_id=x'
        );
      });

      it('refresh_token, JSON-shaped', () => {
        expect(redactSensitiveData('{"refresh_token":"5Aep861ABC"}')).toBe('{"<REDACTED REFRESH TOKEN>"}');
      });

      it('refreshToken, camelCase key', () => {
        expect(redactSensitiveData('refreshToken: 5Aep8abc, other: 1')).toBe('<REDACTED REFRESH TOKEN>, other: 1');
      });
    });

    it('replaces multiple distinct secrets in one string in a single pass', () => {
      expect(
        redactSensitiveData('a 00D000000000000!TOK-1= b eyJa.eyJb.sigX c sid=abc; d Bearer zzz e refresh_token=qqq f')
      ).toBe(
        'a <REDACTED ACCESS TOKEN> b <REDACTED JWT TOKEN> c <REDACTED SID>; d <REDACTED BEARER TOKEN> e <REDACTED REFRESH TOKEN> f'
      );
    });

    it('redacts a token embedded in a multi-line Cause.pretty-shaped stack trace', () => {
      const trace = [
        'Error: Bad_OAuth_Token: Bad_OAuth_Token',
        '    at Connection.request (/x/node_modules/@jsforce/jsforce-node/lib/connection.js:100:11)',
        '    while retrying with 00D000000000000!AQEAQMxyz-1=+ against instance url',
        '    at Object.run (/x/node_modules/@salesforce/core/lib/org.js:42:9)'
      ].join('\n');

      expect(redactSensitiveData(trace)).toBe(
        [
          'Error: Bad_OAuth_Token: Bad_OAuth_Token',
          '    at Connection.request (/x/node_modules/@jsforce/jsforce-node/lib/connection.js:100:11)',
          '    while retrying with <REDACTED ACCESS TOKEN> against instance url',
          '    at Object.run (/x/node_modules/@salesforce/core/lib/org.js:42:9)'
        ].join('\n')
      );
    });

    it('consumes the whole token tail, including - = + _ that core accessTokenRegex stops at', () => {
      // core's `[.\w]*` tail would leave `-b+c=d` behind; the widened `[^\s'"]+` must not
      expect(redactSensitiveData('00D000000000000!AQEAQKa-b+c=d_e.f')).toBe('<REDACTED ACCESS TOKEN>');
    });

    it('stops the access token at a quote so surrounding JSON survives', () => {
      expect(
        redactSensitiveData('{"accessToken":"00D000000000000!AQ-1=","instanceUrl":"https://x.my.salesforce.com"}')
      ).toBe('{"accessToken":"<REDACTED ACCESS TOKEN>","instanceUrl":"https://x.my.salesforce.com"}');
    });

    it('short-circuits on the hint guard: hintless text comes back as the same reference', () => {
      const value = 'sf.lightning.generate.aura.component completed in 42ms';
      expect(redactSensitiveData(value)).toBe(value);
    });

    describe('ADR-0019: telemetry identity attributes survive', () => {
      it.each([
        ['orgId, 18 char', '00D000000000000AAA'],
        ['orgId, 15 char', '00D000000000000'],
        ['userId', '005000000000000AAA'],
        ['webUserId, sha-256 hex', 'e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855'],
        ['devHubOrgId', '00Dxx0000001gPLEAY']
      ])('%s passes through untouched', (_label, value) => {
        // an access token needs the `!` separator, so a bare id can never match
        expect(redactSensitiveData(value)).toBe(value);
      });

      it('leaves ids alone in a span-attribute-shaped string that also carries a token', () => {
        expect(
          redactSensitiveData('orgId=00D000000000000AAA userId=005000000000000AAA token=00D000000000000!AQ-1=')
        ).toBe('orgId=00D000000000000AAA userId=005000000000000AAA token=<REDACTED ACCESS TOKEN>');
      });
    });
  });

  describe('PII', () => {
    it.each([
      ['first.last@example.com', '<REDACTED USERNAME OR EMAIL>'],
      ['josé@example.com', '<REDACTED USERNAME OR EMAIL>'],
      ["o'hara@example.com", '<REDACTED USERNAME OR EMAIL>'],
      ['用户@例子.公司', '<REDACTED USERNAME OR EMAIL>'],
      ['"quoted local"@example.com', '<REDACTED USERNAME OR EMAIL>'],
      ['contact=first.last+scratch@example.co.uk', 'contact=<REDACTED USERNAME OR EMAIL>'],
      [
        'from user@example.com to admin@example.org',
        'from <REDACTED USERNAME OR EMAIL> to <REDACTED USERNAME OR EMAIL>'
      ]
    ])('redacts username-or-email shaped values anywhere in telemetry: %s', (value, expected) => {
      expect(redactSensitiveData(value)).toBe(expected);
    });

    it.each([
      [
        'sf org display --target-org first.last@example.com --json',
        'sf org display --target-org <REDACTED COMMAND VALUE> --json'
      ],
      [
        'sf org display --target-org "first.last@example.com" --json',
        'sf org display --target-org "<REDACTED COMMAND VALUE>" --json'
      ],
      [
        'sf org display --target-org=my-scratch-org --json',
        'sf org display --target-org=<REDACTED COMMAND VALUE> --json'
      ],
      ["sf org display -o 'my-scratch-org' --json", "sf org display -o '<REDACTED COMMAND VALUE>' --json"],
      ['sf org display -o=my-scratch-org --json', 'sf org display -o=<REDACTED COMMAND VALUE> --json'],
      ['Command failed: sf org display -o my-scratch-org', 'Command failed: sf org display -o <REDACTED COMMAND VALUE>']
    ])('redacts a target-org value while preserving command context: %s', (value, expected) => {
      expect(redactSensitiveData(value)).toBe(expected);
    });

    it('redacts target-org values embedded in error text', () => {
      expect(
        redactSensitiveData('Command failed: sf org display --target-org user@example.com --json\nError: unavailable')
      ).toBe('Command failed: sf org display --target-org <REDACTED COMMAND VALUE> --json\nError: unavailable');
    });

    it('redacts every flag value without needing to identify which one contains the access token', () => {
      expect(
        redactSensitiveData(
          'sf data query --query "SELECT NamespacePrefix FROM Organization LIMIT 1" --target-org "00D000000000000!AQEAQKabcdef" --json'
        )
      ).toBe('sf data query --query "<REDACTED COMMAND VALUE>" --target-org "<REDACTED COMMAND VALUE>" --json');
    });

    it.each([
      [
        'sf org create scratch --alias my-scratch-org --json',
        'sf org create scratch --alias <REDACTED COMMAND VALUE> --json'
      ],
      // Repository-authored commands use --alias; redact legacy CLI text defensively.
      ['sf org create scratch -a=my-scratch-org --json', 'sf org create scratch -a=<REDACTED COMMAND VALUE> --json'],
      [
        'Command failed: sf org login web --alias "my scratch org"',
        'Command failed: sf org login web --alias "<REDACTED COMMAND VALUE>"'
      ],
      [
        'sf org login access-token --alias user@example.com --no-prompt',
        'sf org login access-token --alias <REDACTED COMMAND VALUE> --no-prompt'
      ]
    ])('redacts aliases established by sf org commands: %s', (value, expected) => {
      expect(redactSensitiveData(value)).toBe(expected);
    });

    it.each([
      ['sf alias set my-org=user@example.com', 'sf alias set <REDACTED COMMAND ARG>'],
      [
        'sf alias set my-org=opaque-username other-org=other-username --json',
        'sf alias set <REDACTED COMMAND ARG> <REDACTED COMMAND ARG> --json'
      ],
      ['Command failed: sf alias set "my org"="user name"', 'Command failed: sf alias set "<REDACTED COMMAND ARG>"']
    ])('redacts both sides of sf alias set assignments: %s', (value, expected) => {
      expect(redactSensitiveData(value)).toBe(expected);
    });

    it('limits command-context redaction to the line containing the sf command', () => {
      expect(
        redactSensitiveData(
          [
            'npm config set color=true',
            'sf org login web --alias my-org',
            'sf alias set other-org=other-username',
            'sf data query -a AggregateResult',
            'git log -o output.txt'
          ].join('\n')
        )
      ).toBe(
        [
          'npm config set color=true',
          'sf org login web --alias <REDACTED COMMAND VALUE>',
          'sf alias set <REDACTED COMMAND ARG>',
          'sf data query -a <REDACTED COMMAND VALUE>',
          'git log -o output.txt'
        ].join('\n')
      );
    });

    it.each(['git log --alias my-alias', 'npm config set color=true'])(
      'does not apply sf command redaction to other executables: %s',
      value => {
        expect(redactSensitiveData(value)).toBe(value);
      }
    );

    it.each([
      ['target-org=my-scratch-org', 'target-org=<REDACTED USERNAME OR ALIAS>'],
      ['target-dev-hub="my-dev-hub"', 'target-dev-hub="<REDACTED USERNAME OR ALIAS>"'],
      [
        'sf config set target-org=my-scratch-org target-dev-hub="my dev hub"',
        'sf config set <REDACTED COMMAND ARG> <REDACTED COMMAND ARG>'
      ],
      ['target-org=user@example.com', 'target-org=<REDACTED USERNAME OR EMAIL>']
    ])('redacts target configuration assignments: %s', (value, expected) => {
      expect(redactSensitiveData(value)).toBe(expected);
    });

    it('redacts every positional config assignment, not only known sensitive keys', () => {
      expect(redactSensitiveData('sf config set api-version=65.0')).toBe('sf config set <REDACTED COMMAND ARG>');
    });

    it('is idempotent', () => {
      const values = [
        'contact=<REDACTED USERNAME OR EMAIL>',
        'sf org display --target-org <REDACTED COMMAND VALUE> --json',
        'sf org login web --alias <REDACTED COMMAND VALUE>',
        'sf alias set <REDACTED COMMAND ARG>',
        'target-org=<REDACTED USERNAME OR ALIAS>',
        'target-dev-hub="<REDACTED USERNAME OR ALIAS>"'
      ];
      values.forEach(value => expect(redactSensitiveData(value)).toBe(value));
    });

    it('applies generic email redaction outside target-org arguments', () => {
      expect(redactSensitiveData('sf org display --target-dev-hub devhub@example.com --json')).toBe(
        'sf org display --target-dev-hub <REDACTED COMMAND VALUE> --json'
      );
    });

    it.each(['ps -e -o pid,ppid,command', 'git log -o output.txt'])(
      'does not treat non-sf -o as target-org: %s',
      value => {
        expect(redactSensitiveData(value)).toBe(value);
      }
    );
  });
});
