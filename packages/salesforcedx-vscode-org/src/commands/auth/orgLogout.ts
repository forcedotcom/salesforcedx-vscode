/*
 * Copyright (c) 2017, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */

import { AuthRemover } from '@salesforce/core';
import { ExtensionProviderService, sfProjectPreconditionChecker } from '@salesforce/effect-ext-utils';
import {
  ContinueResponse,
  LibraryCommandletExecutor,
  ParametersGatherer,
  SfCommandlet,
  notificationService
} from '@salesforce/salesforcedx-utils-vscode';
import * as Effect from 'effect/Effect';
import * as SubscriptionRef from 'effect/SubscriptionRef';
import { OUTPUT_CHANNEL } from '../../channels';
import { AllServicesLayer } from '../../extensionProvider';
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
      const authRemover = await AuthRemover.create();
      for (const username of usernames) {
        await authRemover.removeAuth(username);
        await removeOrgAliases(username).pipe(Effect.provide(AllServicesLayer), Effect.runPromise);
        const isTarget = await checkIsCurrentTargetOrg(username, []).pipe(
          Effect.provide(AllServicesLayer),
          Effect.runPromise
        );
        if (isTarget) {
          await doUnsetTargetOrg().pipe(Effect.provide(AllServicesLayer), Effect.runPromise);
        }
      }
      await updateConfigAndStateAggregators();
      return true;
    } catch (e) {
      telemetryService.sendException('org_logout_selected', `Error: name = ${e.name} message = ${e.message}`);
      return false;
    }
  }
}

export const orgLogoutAll = async () => {
  const commandlet = new SfCommandlet(sfProjectPreconditionChecker, new SelectOrgsForLogout(), new OrgLogoutSelected());
  await commandlet.run();
};

const checkIsCurrentTargetOrg = Effect.fn('OrgLogout.checkIsCurrentTargetOrg')(
  function* (username: string, aliases: readonly string[]) {
    const api = yield* (yield* ExtensionProviderService).getServicesApi;
    return yield* api.services.ConfigService.isCurrentTargetOrg(username, aliases);
  }
);

const removeOrgAliases = Effect.fn('OrgLogout.removeOrgAliases')(function* (username: string) {
  const api = yield* (yield* ExtensionProviderService).getServicesApi;
  const allAliasesOnDisk = yield* api.services.AliasService.getAliasesFromUsername(username);
  yield* api.services.AliasService.unsetAliases(allAliasesOnDisk);
});

const doUnsetTargetOrg = Effect.fn('OrgLogout.doUnsetTargetOrg')(function* () {
  const api = yield* (yield* ExtensionProviderService).getServicesApi;
  yield* api.services.ConfigService.unsetTargetOrg();
});

export class OrgLogoutDefault extends LibraryCommandletExecutor<string> {
  private readonly orgAliases: readonly string[];

  constructor(aliases: readonly string[] = []) {
    super(nls.localize('org_logout_default_text'), 'org_logout_default', OUTPUT_CHANNEL);
    this.orgAliases = aliases;
  }

  public async run(response: ContinueResponse<string>): Promise<boolean> {
    try {
      const shouldUnset = await checkIsCurrentTargetOrg(response.data, this.orgAliases).pipe(
        Effect.provide(AllServicesLayer),
        Effect.runPromise
      );
      const authRemover = await AuthRemover.create();
      await authRemover.removeAuth(response.data);
      await removeOrgAliases(response.data).pipe(Effect.provide(AllServicesLayer), Effect.runPromise);
      if (shouldUnset) {
        await doUnsetTargetOrg().pipe(Effect.provide(AllServicesLayer), Effect.runPromise);
      }
    } catch (e) {
      telemetryService.sendException('org_logout_default', `Error: name = ${e.name} message = ${e.message}`);
      return false;
    }
    return true;
  }
}

export const orgLogoutDefault = async () => {
  const { username, isScratch, aliases } = await resolveTargetOrg().pipe(
    Effect.provide(AllServicesLayer),
    Effect.runPromise
  );
  if (username) {
    // confirm logout for scratch orgs due to special considerations:
    // https://developer.salesforce.com/docs/atlas.en-us.sfdx_dev.meta/sfdx_dev/sfdx_dev_auth_logout.htm
    const logoutCommandlet = new SfCommandlet(
      sfProjectPreconditionChecker,
      isScratch ? new ScratchOrgLogoutParamsGatherer(username, aliases[0]) : new SimpleGatherer<string>(username),
      new OrgLogoutDefault(aliases)
    );
    await logoutCommandlet.run();
  } else {
    void notificationService.showInformationMessage(nls.localize('org_logout_no_default_org'));
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
