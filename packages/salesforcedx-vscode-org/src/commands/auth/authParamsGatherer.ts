/*
 * Copyright (c) 2026, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */

import { ExtensionProviderService } from '@salesforce/effect-ext-utils';
import { CancelResponse, ContinueResponse, ParametersGatherer } from '@salesforce/salesforcedx-utils-vscode';
import * as Effect from 'effect/Effect';
import * as vscode from 'vscode';
import { nls } from '../../messages';
import { runGatherer } from '../../parameterGatherers/runGatherer';
import { validateAliasInput } from '../../util/orgAlias';

export const DEFAULT_ALIAS = 'vscodeOrg';
const PRODUCTION_URL = 'https://login.salesforce.com';
const SANDBOX_URL = 'https://test.salesforce.com';
const INSTANCE_URL_PLACEHOLDER = 'https://na35.salesforce.com';

export type AuthParams = {
  alias: string;
  loginUrl: string;
};

const inputInstanceUrl = async (): Promise<string | undefined> =>
  vscode.window.showInputBox({
    prompt: nls.localize('parameter_gatherer_enter_instance_url'),
    placeHolder: INSTANCE_URL_PLACEHOLDER,
    validateInput: validateUrl,
    ignoreFocusOut: true
  });

const inputAlias = async (): Promise<string | undefined> =>
  vscode.window.showInputBox({
    prompt: nls.localize('parameter_gatherer_enter_alias_name'),
    placeHolder: DEFAULT_ALIAS,
    ignoreFocusOut: true,
    validateInput: validateAliasInput
  });

const inputAccessToken = async (): Promise<string | undefined> =>
  vscode.window.showInputBox({
    value: '',
    prompt: nls.localize('parameter_gatherer_enter_session_id'),
    placeHolder: nls.localize('parameter_gatherer_enter_session_id_placeholder'),
    password: true,
    ignoreFocusOut: true,
    validateInput: text =>
      text && text?.length > 0 ? null : nls.localize('parameter_gatherer_enter_session_id_diagnostic_message')
  });

// http(s):// host/port/path only — rejects shell metachars (`;|&$()`, backticks, quotes, spaces) so the CLI --instance-url arg stays injection-safe
const validateUrl = (url: string): string | undefined =>
  /^https?:\/\/[\w.-]+(:\d+)?(\/[\w./~-]*)?$/.test(url) ? undefined : nls.localize('auth_invalid_url');

const buildOrgTypes = (projectUrl: string | undefined): Record<string, vscode.QuickPickItem> =>
  Object.fromEntries(
    Object.entries({
      production: { label: 'auth_prod_label', detail: 'auth_prod_detail' },
      sandbox: { label: 'auth_sandbox_label', detail: 'auth_sandbox_detail' },
      custom: { label: 'auth_custom_label', detail: 'auth_custom_detail' }
    } as const)
      .map(([key, value]): [string, vscode.QuickPickItem] => [
        key,
        { label: nls.localize(value.label), detail: nls.localize(value.detail) }
      ])
      .concat(
        projectUrl
          ? [
              [
                'project',
                {
                  label: nls.localize('auth_project_label'),
                  detail: `${nls.localize('auth_project_detail')} (${projectUrl})`
                } as const
              ]
            ]
          : []
      )
  );

const gatherAuthParams = Effect.fn('AuthParamsGatherer.gather')(function* (params: {
  readonly instanceUrl: string | undefined;
  readonly reauthAliasOrUsername: string | undefined;
}) {
  const api = yield* (yield* ExtensionProviderService).getServicesApi;
  const promptService = yield* api.services.PromptService;
  const skipAlias = params.instanceUrl !== undefined;

  // allow passing in the instance url programmatically instead of via quick pick
  const instanceUrl =
    params.instanceUrl ??
    (yield* Effect.gen(function* () {
      const projectUrl = yield* getProjectLoginUrl();
      const orgTypes = buildOrgTypes(projectUrl);
      const selection = yield* Effect.promise(() => vscode.window.showQuickPick(Object.values(orgTypes))).pipe(
        Effect.flatMap(promptService.considerUndefinedAsCancellation)
      );

      const orgType = selection.label;
      if (orgType === orgTypes.custom?.label) {
        return yield* Effect.promise(() =>
          vscode.window.showInputBox({
            prompt: nls.localize('parameter_gatherer_enter_custom_url'),
            placeHolder: PRODUCTION_URL,
            validateInput: validateUrl
          })
        ).pipe(Effect.flatMap(promptService.considerUndefinedAsCancellation));
      }
      if (orgType === orgTypes.project?.label) {
        return projectUrl;
      }
      // Dispatch on the localized label, not a hardcoded English literal.
      return orgType === orgTypes.sandbox?.label ? SANDBOX_URL : PRODUCTION_URL;
    }));

  const reauthLabel = params.reauthAliasOrUsername?.trim();
  // Closing the dialog (ESC/cancel) will cancel the operation; hitting enter with no alias defaults to 'vscodeOrg'
  const alias = skipAlias
    ? reauthLabel && reauthLabel.length > 0
      ? reauthLabel
      : `reauth-${DEFAULT_ALIAS}`
    : yield* Effect.promise(() =>
        vscode.window.showInputBox({
          prompt: nls.localize('parameter_gatherer_enter_alias_name'),
          placeHolder: DEFAULT_ALIAS
        })
      ).pipe(
        // empty string is a valid "use default alias" answer, so only undefined (Esc) cancels
        Effect.flatMap(value =>
          value === undefined ? new api.services.UserCancellationError({}) : Effect.succeed(value)
        )
      );
  return {
    alias: alias || DEFAULT_ALIAS,
    loginUrl: instanceUrl ?? PRODUCTION_URL
  };
});

export class AuthParamsGatherer implements ParametersGatherer<AuthParams> {
  constructor(
    public instanceUrl: string | undefined,
    /** When web login is invoked programmatically (e.g. access-token re-auth), reuse this alias or username so the new auth replaces the same target-org label. */
    public readonly reauthAliasOrUsername?: string
  ) {}

  public async gather(): Promise<CancelResponse | ContinueResponse<AuthParams>> {
    return runGatherer(
      gatherAuthParams({ instanceUrl: this.instanceUrl, reauthAliasOrUsername: this.reauthAliasOrUsername })
    );
  }
}

export const gatherAccessTokenParams = Effect.fn('AccessTokenParamsGatherer.gather')(function* () {
  const api = yield* (yield* ExtensionProviderService).getServicesApi;
  const promptService = yield* api.services.PromptService;

  const instanceUrl = yield* Effect.promise(inputInstanceUrl).pipe(
    Effect.flatMap(promptService.considerUndefinedAsCancellation)
  );

  // empty string is a valid "use default alias" answer, so only undefined (Esc) cancels.
  // NB: cannot use considerUndefinedAsCancellation here — it also cancels on empty/whitespace strings.
  const alias = yield* Effect.promise(inputAlias).pipe(
    Effect.flatMap(value => (value === undefined ? new api.services.UserCancellationError({}) : Effect.succeed(value)))
  );

  const accessToken = yield* Effect.promise(inputAccessToken).pipe(
    Effect.flatMap(promptService.considerUndefinedAsCancellation)
  );

  return {
    accessToken,
    alias: alias || DEFAULT_ALIAS,
    instanceUrl
  };
});

const gatherScratchOrgLogout = Effect.fn('ScratchOrgLogoutParamsGatherer.gather')(function* (params: {
  readonly username: string;
  readonly alias: string | undefined;
}) {
  const api = yield* (yield* ExtensionProviderService).getServicesApi;
  const promptService = yield* api.services.PromptService;

  yield* promptService.confirmOrThrow({
    message: nls.localize('org_logout_scratch_prompt', params.alias ?? params.username),
    confirmLabel: nls.localize('org_logout_scratch_logout')
  });
  return params.username;
});

export class ScratchOrgLogoutParamsGatherer implements ParametersGatherer<string> {
  constructor(
    public readonly username: string,
    public readonly alias?: string
  ) {}

  public async gather(): Promise<CancelResponse | ContinueResponse<string>> {
    return runGatherer(gatherScratchOrgLogout({ username: this.username, alias: this.alias }));
  }
}

const getProjectLoginUrl = Effect.fn('AuthParamsGatherer.getProjectLoginUrl')(function* () {
  const api = yield* (yield* ExtensionProviderService).getServicesApi;
  const project = yield* api.services.ProjectService.getSfProject();
  const projectJson = yield* Effect.tryPromise(() => project.retrieveSfProjectJson());
  return projectJson.get('sfdcLoginUrl');
});
