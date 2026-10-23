/*
 * Copyright (c) 2026, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */

import { ExtensionProviderService } from '@salesforce/effect-ext-utils';
import { extractSourceTypesFromLog, getSourceUri } from '@salesforce/salesforcedx-apex-replay-debugger';
import type { LineBreakpointInfo } from '@salesforce/salesforcedx-utils';
import * as Effect from 'effect/Effect';
import type { OrgMetadataCatalogComponentReference } from 'salesforcedx-vscode-services';

const triggerPrefix = '__sfdc_trigger/';

const sourceReference = (sourceType: string, sourceTypes: string[]) => {
  const isTrigger = sourceType.startsWith(triggerPrefix);
  const parts = (isTrigger ? sourceType.slice(triggerPrefix.length) : sourceType).split('/');
  // Slash-qualified types preserve the namespace boundary. For dotted types, a separately
  // logged outer class identifies a nested class; otherwise do not query a namespace as a class.
  const classParts = parts.at(-1)!.split(/[.$]/);
  const hasNamespace =
    parts.length > 1 || (classParts.length > 1 && !sourceType.includes('$') && !sourceTypes.includes(classParts[0]));
  return {
    type: isTrigger ? 'ApexTrigger' : 'ApexClass',
    fullName: parts.length > 1 || !hasNamespace ? classParts[0] : classParts[1],
    namespacePrefix: hasNamespace ? parts[0].split('.')[0] : undefined
  };
};

const sourceReferences = (sourceTypes: string[]): OrgMetadataCatalogComponentReference[] => [
  ...new Map(
    sourceTypes
      .map(sourceType => sourceReference(sourceType, sourceTypes))
      .map(({ type, fullName }) => [`${type}:${fullName}`, { type, fullName }] as const)
  ).values()
];

const resolveCatalogSourceUris = Effect.fn('ApexReplayDebugger.resolveCatalogSourceUris')(function* (
  sourceTypes: string[]
) {
  return yield* (yield* ExtensionProviderService).getServicesApi.pipe(
    Effect.flatMap(
      api => api.services.OrgMetadataCatalog?.getEntries(sourceReferences(sourceTypes)) ?? Effect.succeed([])
    ),
    Effect.map(entries =>
      Object.fromEntries(
        sourceTypes.flatMap(sourceType => {
          const reference = sourceReference(sourceType, sourceTypes);
          const entry = entries.find(
            candidate =>
              candidate?.kind === 'component' &&
              candidate.reference.type === reference.type &&
              candidate.reference.fullName === reference.fullName &&
              candidate.namespacePrefix === reference.namespacePrefix
          );
          return entry ? [[sourceType, (entry.workspaceUri ?? entry.documentUri).toString()]] : [];
        })
      )
    )
  );
});

export const resolveReplaySourceUris = Effect.fn('ApexReplayDebugger.resolveReplaySourceUris')(function* (
  contents: string,
  lineBreakpointInfo: LineBreakpointInfo[]
) {
  const workspaceMapping = lineBreakpointInfo.map(info => [info.typeref, info.uri] as const);
  const unresolvedTypes = extractSourceTypesFromLog(contents).filter(type => !getSourceUri(type, workspaceMapping));
  if (unresolvedTypes.length === 0) return {};

  // Catalog source is best-effort against the currently selected org, not the log's originating org.
  return yield* resolveCatalogSourceUris(unresolvedTypes).pipe(
    Effect.tapError(error => Effect.logWarning('Unable to resolve Apex Replay Debugger source URIs', { error })),
    Effect.orElseSucceed((): Record<string, string> => ({}))
  );
});
