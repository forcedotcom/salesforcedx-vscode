/*
 * Copyright (c) 2026, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */

import * as Schema from 'effect/Schema';

/**
 * The sf CLI can prepend non-JSON lines to stdout even with `--json` (e.g. the scratch-org expiration
 * warning, seen on macOS CI). `TerminalService.simpleExec` already injects `SF_JSON_TO_STDOUT` +
 * `FORCE_COLOR=0` so the payload is on stdout and ANSI-free, but it cannot strip those prepended human
 * lines (the shape is per-command). Slice from the first `{` to the last `}` to isolate the JSON payload
 * before decoding. No braces → slice yields '' → a decode error (tagged by the caller), not a defect.
 */
export const sanitizeCliJson = (stdout: string): string =>
  stdout.substring(stdout.indexOf('{'), stdout.lastIndexOf('}') + 1);

/** Parses sanitized sf-CLI stdout into a plain object so a discriminant can be injected before a tagged-union decode. */
export const CliRawObject = Schema.parseJson(Schema.Record({ key: Schema.String, value: Schema.Unknown }));
