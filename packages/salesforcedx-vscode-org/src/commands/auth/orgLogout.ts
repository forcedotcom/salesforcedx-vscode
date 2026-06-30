/*
 * Copyright (c) 2026, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */

import { AuthRemover, StateAggregator } from '@salesforce/core';
import { ExtensionProviderService, sfProjectPreconditionChecker } from '@salesforce/effect-ext-utils';
import {
  ContinueResponse,
  LibraryCommandletExecutor,
  ParametersGatherer,
  SfCommandlet
} from '@salesforce/salesforcedx-utils-vscode';
import * as Effect from 'effect/Effect';
import * as SubscriptionRef from 'effect/SubscriptionRef';
import * as vscode from 'vscode';
import { OUTPUT_CHANNEL } from '../../channels';
import { getOrgRuntime } from '../../extensionProvider';
import { nls } from '../../messages';
import { SelectOrgsForLogout } from '../../parameterGatherers/selectOrgsForLogout';
import { telemetryService } from '../../telemetry';
import { updateConfigAndStateAggregators } from '../../util/orgUtil';
import { ScratchOrgLogoutParamsGatherer } from './authParamsGatherer';
// SimpleGatherer - need to inline this small utility
class SimpleGatherer<T> implements ParametersGatherer<T> {
  private data: T;
  constructor(data: T) {
    this.data = data;
  }
  public gather(): Promise<ContinueResponse<T>> {
    return Promise.resolve({ type: 'CONTINUE', data: this.data });
  }
}

export class OrgLogoutSelected extends LibraryCommandletExecutor<{ usernames: string[] }> {
  constructor() {
    super(nls.localize('org_logout_all_text'), 'org_logout_selected', OUTPUT_CHANNEL);
  }

  public async run(response: ContinueResponse<{ usernames: string[] }>): Promise<boolean> {
    const { usernames } = response.data;
    try {
      const api = await getOrgRuntime().runPromise(
        Effect.gen(function* () {
          return yield* (yield* ExtensionProviderService).getServicesApi;
        })
      );
      const { ConfigService, AliasService } = api.services;

      // Clear the cached StateAggregator singleton so AuthRemover.init() rebuilds aliases
      // from disk; removeAuth reads aliases via the in-memory singleton, so a stale cache
      // would silently miss aliases added after the extension booted.
      await StateAggregator.clearInstanceAsync();
      const authRemover = await AuthRemover.create();
      for (const username of usernames) {
        const aliases = await getOrgRuntime().runPromise(AliasService.getAliasesFromUsername(username));
        const isTargetOrg = await getOrgRuntime().runPromise(ConfigService.isCurrentTargetOrg(username, aliases));
        const isTargetDevHub = await getOrgRuntime().runPromise(ConfigService.isCurrentTargetDevHub(username, aliases));
        if (isTargetOrg) {
          await getOrgRuntime().runPromise(ConfigService.unsetTargetOrg());
        }
        if (isTargetDevHub) {
          await getOrgRuntime().runPromise(ConfigService.unsetTargetDevHub());
        }
        // removeAuth clears all global+local config keys pointing at the username/aliases
        // (target-org and target-dev-hub) and removes all aliases on disk.
        await authRemover.removeAuth(username);
      }
      // refresh the extension's cached aggregators/connection after the on-disk change.
      await updateConfigAndStateAggregators();
      return true;
    } catch (e) {
      const err = e instanceof Error ? e : new Error(String(e));
      telemetryService.sendException('org_logout_selected', `Error: name = ${err.name} message = ${err.message}`);
      return false;
    }
  }
}

export const orgLogoutAll = async () => {
  const commandlet = new SfCommandlet(sfProjectPreconditionChecker, new SelectOrgsForLogout(), new OrgLogoutSelected());
  await commandlet.run();
};

export class OrgLogoutDefault extends LibraryCommandletExecutor<string> {
  constructor() {
    super(nls.localize('org_logout_default_text'), 'org_logout_default', OUTPUT_CHANNEL);
  }

  public async run(response: ContinueResponse<string>): Promise<boolean> {
    try {
      const api = await getOrgRuntime().runPromise(
        Effect.gen(function* () {
          return yield* (yield* ExtensionProviderService).getServicesApi;
        })
      );
      const { ConfigService } = api.services;

      // Clear the cached StateAggregator singleton so AuthRemover.init() rebuilds aliases
      // from disk; removeAuth reads aliases via the in-memory singleton, so a stale cache
      // would silently miss aliases added after the extension booted.
      await StateAggregator.clearInstanceAsync();
      const authRemover = await AuthRemover.create();
      // removeAuth clears all global+local config keys pointing at the username/aliases
      // (target-org and target-dev-hub) and removes all aliases on disk.
      await authRemover.removeAuth(response.data);
      // removeAuth unsets target-org on disk but does NOT clear the reactive TargetOrgRef.
      // unsetTargetOrg clears that in-memory ref (clearDefaultOrgRef) so the org-picker status
      // bar reverts to "No Default Org Set"; without it the bar keeps showing the logged-out alias.
      await getOrgRuntime().runPromise(ConfigService.unsetTargetOrg());
      // refresh the extension's cached aggregators/connection after the on-disk change.
      await updateConfigAndStateAggregators();
    } catch (e) {
      const err = e instanceof Error ? e : new Error(String(e));
      telemetryService.sendException('org_logout_default', `Error: name = ${err.name} message = ${err.message}`);
      return false;
    }
    return true;
  }
}

export const orgLogoutDefault = async () => {
  const { username, isScratch, aliases } = await getOrgRuntime().runPromise(resolveTargetOrg());
  if (username) {
    // confirm logout for scratch orgs due to special considerations:
    // https://developer.salesforce.com/docs/atlas.en-us.sfdx_dev.meta/sfdx_dev/sfdx_dev_auth_logout.htm
    const logoutCommandlet = new SfCommandlet(
      sfProjectPreconditionChecker,
      isScratch ? new ScratchOrgLogoutParamsGatherer(username, aliases[0]) : new SimpleGatherer<string>(username),
      new OrgLogoutDefault()
    );
    await logoutCommandlet.run();
  } else {
    void vscode.window.showInformationMessage(nls.localize('org_logout_no_default_org'));
  }
};

const resolveTargetOrg = Effect.fn('OrgLogout.resolveTargetOrg')(function* () {
  const api = yield* (yield* ExtensionProviderService).getServicesApi;
  const orgInfo = yield* SubscriptionRef.get(yield* api.services.TargetOrgRef());

  return {
    username: orgInfo.username,
    isScratch: orgInfo.isScratch ?? false,
    aliases: orgInfo.aliases ?? []
  };
});
