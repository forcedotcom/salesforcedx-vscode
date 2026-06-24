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
import { getOrgRuntime } from '../../extensionProvider';
import { nls } from '../../messages';

export const DEFAULT_ALIAS = 'vscodeOrg';
const PRODUCTION_URL = 'https://login.salesforce.com';
const SANDBOX_URL = 'https://test.salesforce.com';
const INSTANCE_URL_PLACEHOLDER = 'https://na35.salesforce.com';

export type AuthParams = {
  alias: string;
  loginUrl: string;
};

export type AccessTokenParams = {
  alias: string;
  instanceUrl: string;
  accessToken: string;
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
    ignoreFocusOut: true
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

const validateUrl = (url: string): string | null => {
  const expr = /https?:\/\/(.*)/;
  if (expr.test(url)) {
    return null;
  }
  return nls.localize('auth_invalid_url');
};

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

export class AuthParamsGatherer implements ParametersGatherer<AuthParams> {
  constructor(
    public instanceUrl: string | undefined,
    /** When web login is invoked programmatically (e.g. access-token re-auth), reuse this alias or username so the new auth replaces the same target-org label. */
    public readonly reauthAliasOrUsername?: string
  ) {}

  public async gather(): Promise<CancelResponse | ContinueResponse<AuthParams>> {
    const self = this;
    return getOrgRuntime().runPromise(
      Effect.gen(function* () {
        const api = yield* (yield* ExtensionProviderService).getServicesApi;
        const promptService = yield* api.services.PromptService;
        const skipAlias = self.instanceUrl !== undefined;
        // allow passing in the instance url programmatically instead of via quick pick
        if (!self.instanceUrl) {
          const orgTypes = buildOrgTypes(yield* getProjectLoginUrl());
          const selection = yield* Effect.promise(() => vscode.window.showQuickPick(Object.values(orgTypes))).pipe(
            Effect.flatMap(promptService.considerUndefinedAsCancellation)
          );

          const orgType = selection.label;
          if (orgType === orgTypes.custom?.label) {
            self.instanceUrl = yield* Effect.promise(() =>
              vscode.window.showInputBox({
                prompt: nls.localize('parameter_gatherer_enter_custom_url'),
                placeHolder: PRODUCTION_URL,
                validateInput: validateUrl
              })
            ).pipe(Effect.flatMap(promptService.considerUndefinedAsCancellation));
          } else if (orgType === orgTypes.project?.label) {
            self.instanceUrl = yield* getProjectLoginUrl();
          } else {
            self.instanceUrl = orgType === 'Sandbox' ? SANDBOX_URL : PRODUCTION_URL;
          }
        }

        const reauthLabel = self.reauthAliasOrUsername?.trim();
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
          loginUrl: self.instanceUrl ?? PRODUCTION_URL
        };
      }).pipe(
        Effect.map((data): ContinueResponse<AuthParams> => ({ type: 'CONTINUE', data })),
        Effect.catchTag(
          'UserCancellationError',
          (): Effect.Effect<CancelResponse> => Effect.succeed({ type: 'CANCEL' })
        )
      )
    );
  }
}

export class AccessTokenParamsGatherer implements ParametersGatherer<AccessTokenParams> {
  public async gather(): Promise<CancelResponse | ContinueResponse<AccessTokenParams>> {
    return getOrgRuntime().runPromise(
      Effect.gen(function* () {
        const api = yield* (yield* ExtensionProviderService).getServicesApi;
        const promptService = yield* api.services.PromptService;

        const instanceUrl = yield* Effect.promise(inputInstanceUrl).pipe(
          Effect.flatMap(promptService.considerUndefinedAsCancellation)
        );

        // empty string is a valid "use default alias" answer, so only undefined (Esc) cancels
        const alias = yield* Effect.promise(inputAlias).pipe(
          Effect.flatMap(value =>
            value === undefined ? new api.services.UserCancellationError({}) : Effect.succeed(value)
          )
        );

        const accessToken = yield* Effect.promise(inputAccessToken).pipe(
          Effect.flatMap(promptService.considerUndefinedAsCancellation)
        );

        return {
          accessToken,
          alias: alias || DEFAULT_ALIAS,
          instanceUrl
        };
      }).pipe(
        Effect.map((data): ContinueResponse<AccessTokenParams> => ({ type: 'CONTINUE', data })),
        Effect.catchTag(
          'UserCancellationError',
          (): Effect.Effect<CancelResponse> => Effect.succeed({ type: 'CANCEL' })
        )
      )
    );
  }
}

export class ScratchOrgLogoutParamsGatherer implements ParametersGatherer<string> {
  constructor(
    public readonly username: string,
    public readonly alias?: string
  ) {}

  public async gather(): Promise<CancelResponse | ContinueResponse<string>> {
    const self = this;
    return getOrgRuntime().runPromise(
      Effect.gen(function* () {
        const api = yield* (yield* ExtensionProviderService).getServicesApi;
        const prompt = nls.localize('org_logout_scratch_prompt', self.alias ?? self.username);
        const logoutResponse = nls.localize('org_logout_scratch_logout');

        const confirm = yield* Effect.promise(() =>
          vscode.window.showInformationMessage(prompt, { modal: true }, logoutResponse)
        );
        if (confirm !== logoutResponse) {
          return yield* new api.services.UserCancellationError({});
        }
        return self.username;
      }).pipe(
        Effect.map((data): ContinueResponse<string> => ({ type: 'CONTINUE', data })),
        Effect.catchTag(
          'UserCancellationError',
          (): Effect.Effect<CancelResponse> => Effect.succeed({ type: 'CANCEL' })
        )
      )
    );
  }
}

const getProjectLoginUrl = Effect.fn('AuthParamsGatherer.getProjectLoginUrl')(function* () {
  const api = yield* (yield* ExtensionProviderService).getServicesApi;
  const project = yield* api.services.ProjectService.getSfProject();
  const projectJson = yield* Effect.tryPromise(() => project.retrieveSfProjectJson());
  return projectJson.get('sfdcLoginUrl');
});
