# upstream parity

Locks `writeResultFiles` output to published `@salesforce/apex-node@9.1.13` (github.com/forcedotcom/salesforcedx-apex).

- `fixtures.ts`: inputs. Changing them invalidates the baseline
- `__snapshots__`: bytes written by current code; verified equal to 9.1.13 except below
- large scenario: size + sha256 only

## Known differences from 9.1.13

- JUnit escapes `hostname` (9.1.13 wrote it raw → invalid XML)
- TAP splits stack traces on any newline form (9.1.13: `os.EOL` only)

## After an intended output change

`vitest -u`, review the diff, add real differences to the list above.
