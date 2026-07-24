/*
 * Copyright (c) 2026, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */

import { Column, createTable, ExtensionProviderService, Row } from '@salesforce/effect-ext-utils';
import * as Effect from 'effect/Effect';
import { identity } from 'effect/Function';
import * as Match from 'effect/Match';
import * as Schema from 'effect/Schema';
import * as SubscriptionRef from 'effect/SubscriptionRef';
import { nls } from '../messages';
import { gatherOrgForDisplay } from '../parameterGatherers/selectOrgForDisplay';
import { decodeTaggedCliResponse } from '../util/cliJson';

/**
 * Raised when `sf org display --json` output cannot be decoded into either result shape.
 * @ExportTaggedError
 */
export class OrgDisplayParseError extends Schema.TaggedError<OrgDisplayParseError>()('OrgDisplayParseError', {
  message: Schema.String
}) {}

/**
 * `sf org display --json` result. Mirrors plugin-org's `OrgDisplayReturn`: only `username`/`accessToken`
 * are always emitted; the scratch-org block (`devHubId`, `status`, `expirationDate`, `createdBy`,
 * `createdDate`, `edition`, `namespace`, `orgName`) and `connectedStatus` (non-scratch only) are
 * mutually exclusive, and undefined keys are omitted from the JSON entirely. Extra keys sf adds
 * (`signupUsername`, `sfdxAuthUrl`, `clientApps`) are dropped by the decode.
 */
const OrgDisplayResult = Schema.Struct({
  username: Schema.String,
  accessToken: Schema.optional(Schema.String),
  alias: Schema.optional(Schema.String),
  apiVersion: Schema.optional(Schema.String),
  clientId: Schema.optional(Schema.String),
  connectedStatus: Schema.optional(Schema.String),
  createdBy: Schema.optional(Schema.String),
  createdDate: Schema.optional(Schema.String),
  devHubId: Schema.optional(Schema.String),
  edition: Schema.optional(Schema.String),
  expirationDate: Schema.optional(Schema.String),
  id: Schema.optional(Schema.String),
  instanceUrl: Schema.optional(Schema.String),
  namespace: Schema.optional(Schema.String),
  orgName: Schema.optional(Schema.String),
  password: Schema.optional(Schema.String),
  status: Schema.optional(Schema.String)
});
type OrgDisplayResult = Schema.Schema.Type<typeof OrgDisplayResult>;

const OrgDisplaySuccess = Schema.TaggedStruct('OrgDisplaySuccess', {
  status: Schema.Literal(0),
  result: OrgDisplayResult
});

/** sf prints `{ status, message }` (status !== 0) on failure; surface that message to the channel. */
const OrgDisplayFailure = Schema.TaggedStruct('OrgDisplayFailure', {
  status: Schema.Number,
  message: Schema.String
});

const OrgDisplayResponse = Schema.Union(OrgDisplaySuccess, OrgDisplayFailure);
type OrgDisplayResponse = Schema.Schema.Type<typeof OrgDisplayResponse>;

/**
 * Decodes sf CLI JSON: `{ status: 0, result }` (success) or `{ status, message }` (failure) — neither
 * carries a `_tag`. Inject the discriminant from `status === 0` before the tagged-union decode; all
 * downstream dispatch is on `_tag` via Match. Malformed shape → tagged error. See `cliJson.ts`.
 */
const decodeOrgDisplayResponse = decodeTaggedCliResponse(OrgDisplayResponse, raw =>
  raw.status === 0 ? 'OrgDisplaySuccess' : 'OrgDisplayFailure'
)(() => new OrgDisplayParseError({ message: nls.localize('org_display_result_parsing_error') }));

const formatOrgInfoAsTable = (orgInfo: OrgDisplayResult): string => {
  const columns: Column[] = [
    { key: 'property', label: 'Key' },
    { key: 'value', label: 'Value' }
  ];
  const isScratchOrg = !!orgInfo.devHubId;

  const rows: Row[] = [
    { property: 'Access Token', value: orgInfo.accessToken ?? '' },
    { property: 'Alias', value: orgInfo.alias ?? '' },
    { property: 'API Version', value: orgInfo.apiVersion ?? '' },
    { property: 'Client Id', value: orgInfo.clientId ?? '' },
    // sf emits connectedStatus for non-scratch orgs only and status for scratch orgs only, so fall
    // back to status to keep this row populated for both kinds (parity with the pre-CLI table).
    { property: 'Connected Status', value: orgInfo.connectedStatus ?? orgInfo.status ?? '' },
    { property: 'Instance Url', value: orgInfo.instanceUrl ?? '' },
    { property: 'Org Id', value: orgInfo.id ?? '' },
    { property: 'Username', value: orgInfo.username },
    ...(orgInfo.namespace ? [{ property: 'Namespace', value: orgInfo.namespace }] : []),
    ...(isScratchOrg
      ? [
          { property: 'Dev Hub Id', value: orgInfo.devHubId ?? '' },
          { property: 'Created By', value: orgInfo.createdBy ?? '' },
          { property: 'Created Date', value: orgInfo.createdDate ?? '' },
          { property: 'Expiration Date', value: orgInfo.expirationDate ?? '' },
          { property: 'Status', value: orgInfo.status ?? '' },
          { property: 'Password', value: orgInfo.password ?? '' },
          { property: 'Org Name', value: orgInfo.orgName ?? '' }
        ]
      : []),
    ...(orgInfo.edition && !isScratchOrg ? [{ property: 'Edition', value: orgInfo.edition }] : [])
  ].toSorted((a, b) => String(a.property).localeCompare(String(b.property)));

  return createTable(rows, columns, 'Org Description');
};

/** True when a string holds something `sanitizeJson` can slice a JSON object out of (see `cliJson.ts`). */
const hasJsonObject = (text: string): boolean => text.includes('{') && text.lastIndexOf('}') > text.indexOf('{');

/**
 * Runs an `sf org display --json` variant and reports it to the org channel: the org table on
 * success, the CLI's message on failure.
 *
 * sf exits non-zero when it fails, which makes `simpleExec` fail with `TerminalServiceError` — whose
 * message already carries the CLI's JSON error payload (`execErrorMessage` folds stdout in). Recover
 * that message into the same decode pipeline so the `OrgDisplayFailure` branch is reachable
 * (`decodeTaggedCliResponse` slices from the first `{`, dropping the `Command failed: ...` prefix).
 * A failure whose message carries no JSON at all is infrastructure (sf not on PATH, spawn/permission
 * error), so it stays a `TerminalServiceError` for ErrorHandlerService instead of degrading into an
 * `OrgDisplayParseError` that would hide the real diagnostic.
 */
const displayOrg = Effect.fn('orgDisplay.displayOrg')(function* (command: string) {
  const api = yield* (yield* ExtensionProviderService).getServicesApi;
  const terminalService = yield* api.services.TerminalService;
  // simpleExec injects SF_JSON_TO_STDOUT + FORCE_COLOR=0 for sf commands, keeping the JSON we decode clean.
  const stdout = yield* terminalService
    .simpleExec({ command, parse: identity })
    .pipe(
      Effect.catchTag('TerminalServiceError', error =>
        hasJsonObject(error.message) ? Effect.succeed(error.message) : error
      )
    );

  const response = yield* decodeOrgDisplayResponse(stdout);

  const channel = yield* api.services.ChannelService;
  yield* channel.appendToChannel(
    Match.type<OrgDisplayResponse>().pipe(
      Match.tag('OrgDisplaySuccess', ({ result }) => formatOrgInfoAsTable(result)),
      Match.tag('OrgDisplayFailure', ({ message }) => message),
      Match.exhaustive
    )(response)
  );
  yield* channel.showChannel;
});

/**
 * Effect command for `sf.org.display.default`: display the default org's details via
 * `sf org display --json`.
 */
export const orgDisplayDefaultCommand = Effect.fn('orgDisplayDefaultCommand')(function* () {
  const api = yield* (yield* ExtensionProviderService).getServicesApi;

  // precondition: getSfProject sets the sf:project_opened context and fails with a typed
  // FailedToResolveSfProjectError (rendered by ErrorHandlerService) when there's no project.
  yield* api.services.ProjectService.getSfProject();

  // pass --target-org so sf resolves the default org by username rather than the extension-host cwd
  // (simpleExec runs without a workspace cwd). orgOpen/orgDelete use the same pattern.
  const orgInfo = yield* SubscriptionRef.get(yield* api.services.TargetOrgRef());
  const targetOrgFlag = orgInfo.username ? ` --target-org "${orgInfo.username}"` : '';
  if (!orgInfo.username) {
    yield* Effect.log('no target-org username; falling back to sf default-org resolution', { module: 'orgDisplay' });
  }

  yield* displayOrg(`sf org display${targetOrgFlag} --json`);
});

/**
 * Effect command for `sf.org.display.username`: pick an authed org, then display its details via
 * `sf org display --target-org <username> --json`.
 */
export const orgDisplayUsernameCommand = Effect.fn('orgDisplayUsernameCommand')(function* () {
  const api = yield* (yield* ExtensionProviderService).getServicesApi;

  // precondition: getSfProject sets the sf:project_opened context and fails with a typed
  // FailedToResolveSfProjectError (rendered by ErrorHandlerService) when there's no project.
  yield* api.services.ProjectService.getSfProject();

  // picker selection; UserCancellationError propagates to ErrorHandlerService (no error toast on Esc).
  const { username } = yield* gatherOrgForDisplay();

  // quote the username: simpleExec runs the child via /bin/sh -c.
  yield* displayOrg(`sf org display --target-org "${username}" --json`);
});
