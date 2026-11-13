/*
 * Copyright (c) 2026, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */
import { TemplateType } from '@salesforce/templates';
import {
  ExtensionContextService,
  ExtensionContextServiceLayer,
  ErrorHandlerService,
  NotificationModeService,
  ORG_METADATA_SCHEME,
  TraceFlagItemStruct,
  UserCancellationError,
  publicServiceKeys,
  type SalesforceVSCodeServicesApiV2,
  type OrgId,
  type PublicServices
} from '@salesforce/vscode-services/v2';
import type { CompatibilityHost, HostExit, HostReason } from '@salesforce/vscode-services-v3-compat/host';
import * as Context from 'effect/Context';
import * as Exit from 'effect/Exit';
import type * as Layer from 'effect/Layer';
import * as OtlpExporter from 'effect/observability/OtlpExporter';
import * as Option from 'effect/Option';
import { getLegacyTelemetrySender } from '../observability/legacyTelemetrySender.js';
import { getSdkLayerConfigFromContext } from '../observability/sdkLayerConfig.js';
import { SdkLayerFor } from '../observability/spans.js';
import { clearServicesRuntime } from '../servicesRuntime.js';
import { makeChannelServiceLayer } from './channelService.js';
import { createConnectionRuntime } from './connectionRuntime.js';
import { getErrorMessage, makeErrorHandlerServiceLayer, type ErrorHandlerMessages } from './errorHandlerService.js';
import { makeNotificationModeServiceLayer } from './notificationModeService.js';
import { makePreventOrgChanges } from './preventOrgChanges.js';
import { registerCommandWithRuntime } from './registerCommand.js';
import { ServiceOperations } from './serviceOperations.js';
import { OrgChanges } from './targetOrgRef.js';

const reasonsFromExit = (exit: Exit.Exit<void, never>): readonly HostReason<never>[] =>
  Exit.isSuccess(exit)
    ? []
    : exit.cause.reasons.map(reason => {
        if (reason._tag === 'Die') return { _tag: 'Die', defect: reason.defect } as const;
        if (reason._tag === 'Interrupt') return { _tag: 'Interrupt', fiberId: reason.fiberId } as const;
        return { _tag: 'Fail', error: reason.error } as const;
      });

/** The existing owner acquires one graph; its customer Context explicitly excludes all private implementation keys. */
export const createCatalogRuntime = async <R, E = never>(
  layer: Layer.Layer<PublicServices | OrgChanges | R, E>,
  redact: CompatibilityHost['redact'],
  errorHandlerMessages: ErrorHandlerMessages,
  orgChangedMessage: (orgId: OrgId) => string,
  signal?: AbortSignal,
  memoMap?: Layer.MemoMap
) => {
  const owner = await createConnectionRuntime(layer, redact, signal, Object.values(publicServiceKeys), memoMap);
  const operations = owner.runtime.runSync(ServiceOperations);
  const changes = owner.runtime.runSync(OrgChanges);
  const closeOwner = async (): Promise<HostExit<void, never>> => {
    const flushExit = await owner.runtime.context().then(
      ownerContext => {
        const flusher = Context.getOption(ownerContext, OtlpExporter.Flusher);
        return Option.isSome(flusher)
          ? owner.runtime.runPromiseExit(flusher.value.flush)
          : Promise.resolve(Exit.succeed(undefined));
      },
      defect => Exit.die(defect)
    );
    // O11y exporter shutdown can still use the runtime during flush; unpublish only after it settles.
    clearServicesRuntime(owner.runtime);
    const closeExit = await owner.close();
    const reasons = [...reasonsFromExit(flushExit), ...(closeExit._tag === 'Failure' ? closeExit.reasons : [])];
    return reasons.length > 0 ? { _tag: 'Failure', reasons } : closeExit;
  };
  const closeState: { promise?: Promise<HostExit<void, never>> } = {};
  const close = () => (closeState.promise ??= closeOwner());
  const disposeState: { promise?: Promise<HostExit<void, never>> } = {};
  const dispose = () =>
    (disposeState.promise ??= (async () => {
      const closeExit = await close();
      const disposeExit = await owner.dispose();
      const reasons = [
        ...(closeExit._tag === 'Failure' ? closeExit.reasons : []),
        ...(disposeExit._tag === 'Failure' ? disposeExit.reasons : [])
      ];
      return reasons.length > 0 ? { _tag: 'Failure', reasons } : disposeExit;
    })());
  const services = {
    ...owner.v2.services,
    ...publicServiceKeys,
    ORG_METADATA_SCHEME,
    TraceFlagItemStruct,
    UserCancellationError,
    TemplateType,
    ClearDefaultOrgRef: () => operations.run(changes.clear),
    preventOrgChanges: makePreventOrgChanges(orgChangedMessage),
    ExtensionContextService,
    ExtensionContextServiceLayer,
    ErrorHandlerService,
    ChannelServiceLayer: makeChannelServiceLayer,
    ErrorHandlerServiceLayer: makeErrorHandlerServiceLayer(errorHandlerMessages),
    getErrorMessage,
    getSdkLayerConfigFromContext,
    getLegacyTelemetrySender,
    SdkLayerFor,
    registerCommandWithRuntime,
    NotificationModeService,
    NotificationModeServiceLayer: makeNotificationModeServiceLayer
  } satisfies SalesforceVSCodeServicesApiV2['v2']['services'];

  return {
    ...owner,
    close,
    dispose,
    v2: {
      services
    }
  };
};
