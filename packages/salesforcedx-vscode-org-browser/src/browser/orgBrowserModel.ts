/*
 * Copyright (c) 2026, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */

import type { OrgBrowserFilterState, OrgBrowserNode, OrgBrowserNodeKind, OrgBrowserPresence } from './protocol';
import { ExtensionProviderService } from '@salesforce/effect-ext-utils';
import * as Effect from 'effect/Effect';
import * as SubscriptionRef from 'effect/SubscriptionRef';
import type { OrgMetadataCatalogEntry, OrgMetadataReference } from 'salesforcedx-vscode-services';
import { matchesPattern } from './filter';

const FOLDER_TYPES = new Set(['Dashboard', 'Document', 'EmailTemplate', 'Report']);
export type OrgBrowserCatalog = {
  readonly getChildren: (
    reference?: OrgMetadataReference
  ) => Effect.Effect<readonly OrgMetadataCatalogEntry[], unknown>;
  readonly getChildrenCached: (
    reference: OrgMetadataReference
  ) => Effect.Effect<readonly OrgMetadataCatalogEntry[] | undefined, unknown>;
  readonly refresh: (reference?: OrgMetadataReference) => Effect.Effect<void, unknown>;
};

const getLiveCatalog = Effect.fn('OrgBrowserModel.getLiveCatalog')(function* () {
  const api = yield* (yield* ExtensionProviderService).getServicesApi;
  return yield* api.services.OrgMetadataCatalog;
});
const editableManageableState = (entry: OrgMetadataCatalogEntry): boolean =>
  !entry.manageableState || ['unmanaged', 'installedEditable', 'deprecatedEditable'].includes(entry.manageableState);
const hasFullName = <T extends { readonly reference: { readonly xmlName?: string; readonly fullName?: string } }>(
  entry: T
): entry is T & { readonly reference: { readonly xmlName: string; readonly fullName: string } } =>
  Boolean(entry.reference.xmlName && entry.reference.fullName);
const presenceOf = (entry: Pick<OrgMetadataCatalogEntry, 'inOrg' | 'inWorkspace'>): OrgBrowserPresence =>
  entry.inOrg && entry.inWorkspace ? 'both' : entry.inWorkspace ? 'local' : 'org';
const nodeId = (kind: OrgBrowserNodeKind, xmlName: string, fullName?: string): string =>
  `${kind}:${xmlName}${fullName ? `:${fullName}` : ''}`;
const entryVisible = (entry: OrgMetadataCatalogEntry, filter: OrgBrowserFilterState): boolean =>
  filter.showLocal && filter.showOrg
    ? true
    : filter.showLocal
      ? entry.inWorkspace
      : filter.showOrg
        ? entry.inOrg
        : false;

const fieldLabel = (entry: OrgMetadataCatalogEntry): string => {
  const field = entry.field;
  if (!field) return entry.name;
  switch (field.type) {
    case 'string':
    case 'textarea':
    case 'email':
      return `${field.name} | ${field.type} | length: ${field.length?.toLocaleString()}`;
    case 'reference':
      return `${field.relationshipName} | reference`;
    case 'double':
    case 'currency':
    case 'percent':
      return `${field.name} | ${field.type} | scale: ${field.scale} | precision: ${field.precision}`;
    default:
      return `${field.name} | ${field.type}`;
  }
};

const toNode = (
  entry: OrgMetadataCatalogEntry & { readonly reference: { readonly xmlName: string; readonly fullName: string } },
  kind: OrgBrowserNodeKind,
  parentId: string
): OrgBrowserNode => ({
  id: nodeId(kind, entry.reference.xmlName, entry.reference.fullName),
  parentId,
  kind,
  label: kind === 'customField' ? fieldLabel(entry) : entry.name,
  xmlName: entry.reference.xmlName,
  fullName: entry.reference.fullName,
  expandable: kind === 'folder' || kind === 'customObject',
  presence: presenceOf(entry),
  actions:
    kind === 'folder'
      ? ['refresh']
      : kind === 'component' || kind === 'customField'
        ? ['retrieve']
        : ['refresh', 'retrieve']
});

export class OrgBrowserModel<R> {
  constructor(
    private filter: OrgBrowserFilterState,
    private readonly catalogEffect: Effect.Effect<OrgBrowserCatalog, unknown, R>
  ) {}

  public getFilter(): OrgBrowserFilterState {
    return this.filter;
  }

  public setFilter(filter: OrgBrowserFilterState): void {
    this.filter = filter;
  }

  // Effect.fn supplies the span while the generator retains this model instance.
  // eslint-disable-next-line unicorn/consistent-function-scoping
  public getActiveOrgId = Effect.fn('OrgBrowserModel.getActiveOrgId')(function* () {
    const api = yield* (yield* ExtensionProviderService).getServicesApi;
    return (yield* SubscriptionRef.get(yield* api.services.TargetOrgRef())).orgId;
  });

  public getRoots = Effect.fn('OrgBrowserModel.getRoots')(function* (this: OrgBrowserModel<R>) {
    if (!this.filter.showLocal && !this.filter.showOrg) return [];
    const catalog = yield* this.catalogEffect;
    const entries = yield* catalog.getChildren();
    const candidates = entries.filter(
      entry =>
        entry.kind === 'type' &&
        entry.reference.xmlName &&
        entryVisible(entry, this.filter) &&
        (!this.filter.typeFilter ||
          matchesPattern(entry.reference.xmlName, this.filter.typeFilter, this.filter.typeIsRegex))
    );
    const componentFilter = this.filter.componentFilter;
    const filtered = componentFilter
      ? yield* Effect.filter(candidates, entry =>
          catalog
            .getChildrenCached({ xmlName: entry.reference.xmlName! })
            .pipe(
              Effect.map(cached =>
                cached
                  ? cached.some(
                      component =>
                        hasFullName(component) &&
                        entryVisible(component, this.filter) &&
                        matchesPattern(component.reference.fullName, componentFilter, this.filter.componentIsRegex)
                    )
                  : true
              )
            )
        )
      : candidates;
    return filtered
      .map(entry => {
        const xmlName = entry.reference.xmlName!;
        const kind: OrgBrowserNodeKind = FOLDER_TYPES.has(xmlName) ? 'folderType' : 'type';
        return {
          id: nodeId(kind, xmlName),
          kind,
          label: xmlName,
          xmlName,
          expandable: true,
          presence: presenceOf(entry),
          actions: kind === 'folderType' ? (['refresh'] as const) : (['refresh', 'retrieve'] as const)
        } satisfies OrgBrowserNode;
      })
      .toSorted((left, right) => left.label.localeCompare(right.label));
  });

  // eslint-disable-next-line unicorn/consistent-function-scoping
  public getChildren = Effect.fn('OrgBrowserModel.getChildren')(function* (
    this: OrgBrowserModel<R>,
    node: OrgBrowserNode
  ) {
    const catalog = yield* this.catalogEffect;
    const entries = yield* catalog.getChildren({
      xmlName: node.xmlName,
      ...(node.fullName ? { fullName: node.fullName } : {})
    });
    const visible = entries.filter(hasFullName).filter(entry => entryVisible(entry, this.filter));
    const projected = visible.flatMap(entry => {
      if (node.kind === 'customObject') {
        return entry.reference.xmlName === 'CustomField' ? [toNode(entry, 'customField', node.id)] : [];
      }
      if (node.kind === 'folderType') return entry.kind === 'folder' ? [toNode(entry, 'folder', node.id)] : [];
      if (node.kind === 'folder')
        return entry.kind === 'component' && editableManageableState(entry)
          ? [toNode(entry, 'component', node.id)]
          : [];
      if (entry.kind !== 'component' || !editableManageableState(entry)) return [];
      return [toNode(entry, node.xmlName === 'CustomObject' ? 'customObject' : 'component', node.id)];
    });
    const componentFilter = node.kind === 'customObject' ? undefined : this.filter.componentFilter;
    return (
      componentFilter
        ? projected.filter(child =>
            child.fullName ? matchesPattern(child.fullName, componentFilter, this.filter.componentIsRegex) : false
          )
        : projected
    ).toSorted((left, right) => left.label.localeCompare(right.label));
  });

  // eslint-disable-next-line unicorn/consistent-function-scoping
  public refresh = Effect.fn('OrgBrowserModel.refresh')(function* (this: OrgBrowserModel<R>, node?: OrgBrowserNode) {
    const catalog = yield* this.catalogEffect;
    yield* catalog.refresh(
      node ? { xmlName: node.xmlName, ...(node.fullName ? { fullName: node.fullName } : {}) } : {}
    );
  });

  // eslint-disable-next-line unicorn/consistent-function-scoping
  public getRetrieveMembers = Effect.fn('OrgBrowserModel.getRetrieveMembers')(function* (
    this: OrgBrowserModel<R>,
    node: OrgBrowserNode
  ) {
    if ((node.kind === 'component' || node.kind === 'customObject' || node.kind === 'customField') && node.fullName) {
      return [{ type: node.xmlName, fullName: node.fullName }];
    }
    if (node.kind !== 'type') return [];
    const children = yield* this.getChildren(node);
    return children.flatMap(child => (child.fullName ? [{ type: child.xmlName, fullName: child.fullName }] : []));
  });
}

export const makeLiveOrgBrowserModel = (filter: OrgBrowserFilterState) => new OrgBrowserModel(filter, getLiveCatalog());
