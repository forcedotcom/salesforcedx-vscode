/*
 * Copyright (c) 2026, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */

import * as Schema from 'effect/Schema';

export type OrgBrowserNodeKind = 'type' | 'folderType' | 'folder' | 'component' | 'customObject' | 'customField';
export type OrgBrowserPresence = 'local' | 'org' | 'both';
export type OrgBrowserNode = {
  readonly id: string;
  readonly parentId?: string;
  readonly kind: OrgBrowserNodeKind;
  readonly label: string;
  readonly xmlName: string;
  readonly fullName?: string;
  readonly expandable: boolean;
  readonly presence: OrgBrowserPresence;
  readonly actions: readonly ('refresh' | 'retrieve')[];
};
export type OrgBrowserFilterState = {
  readonly showLocal: boolean;
  readonly showOrg: boolean;
  readonly text: string;
  readonly typeFilter?: string;
  readonly componentFilter?: string;
  readonly typeIsRegex: boolean;
  readonly componentIsRegex: boolean;
};

const OrgBrowserViewStateSchema = Schema.Struct({
  version: Schema.Literal(1),
  expandedIds: Schema.Array(Schema.String),
  selectedId: Schema.optional(Schema.String),
  focusedId: Schema.optional(Schema.String),
  scrollTop: Schema.Number
});
export type OrgBrowserViewState = typeof OrgBrowserViewStateSchema.Type;

export type OrgBrowserLabels = {
  readonly local: string;
  readonly org: string;
  readonly filter: string;
  readonly filterPlaceholder: string;
  readonly clearFilter: string;
  readonly refresh: string;
  readonly refreshAll: string;
  readonly retrieve: string;
  readonly collapseAll: string;
  readonly loading: string;
  readonly empty: string;
  readonly filteredEmpty: string;
  readonly presenceEmpty: string;
  readonly tree: string;
  readonly controls: string;
  readonly presenceBoth: string;
  readonly presenceLocal: string;
  readonly presenceOrg: string;
};

const ReadyMessageSchema = Schema.Struct({ type: Schema.Literal('ready') });
const RequestInitialDataMessageSchema = Schema.Struct({ type: Schema.Literal('requestInitialData') });
const ExpandMessageSchema = Schema.Struct({
  type: Schema.Literal('expand'),
  generation: Schema.Number,
  requestId: Schema.Number,
  nodeId: Schema.String
});
const RefreshMessageSchema = Schema.Struct({
  type: Schema.Literal('refresh'),
  generation: Schema.Number,
  requestId: Schema.Number,
  nodeId: Schema.optional(Schema.String)
});
const RetrieveMessageSchema = Schema.Struct({
  type: Schema.Literal('retrieve'),
  generation: Schema.Number,
  requestId: Schema.Number,
  nodeId: Schema.String
});
const FilterMessageSchema = Schema.Struct({
  type: Schema.Literal('setFilter'),
  generation: Schema.Number,
  requestId: Schema.Number,
  showLocal: Schema.Boolean,
  showOrg: Schema.Boolean,
  text: Schema.String
});
const ViewStateMessageSchema = Schema.Struct({
  type: Schema.Literal('setViewState'),
  generation: Schema.Number,
  orgId: Schema.String,
  state: OrgBrowserViewStateSchema
});

const OrgBrowserWebviewMessageSchema = Schema.Union(
  ReadyMessageSchema,
  RequestInitialDataMessageSchema,
  ExpandMessageSchema,
  RefreshMessageSchema,
  RetrieveMessageSchema,
  FilterMessageSchema,
  ViewStateMessageSchema
);
export type OrgBrowserWebviewMessage = typeof OrgBrowserWebviewMessageSchema.Type;

export const decodeOrgBrowserWebviewMessage = Schema.decodeUnknownEither(OrgBrowserWebviewMessageSchema);

export const isCurrentOrgBrowserMessage = (message: OrgBrowserWebviewMessage, generation: number): boolean =>
  message.type === 'ready' || message.type === 'requestInitialData' || message.generation === generation;

export type OrgBrowserHostMessage =
  | { readonly type: 'configure'; readonly labels: OrgBrowserLabels }
  | {
      readonly type: 'initialize';
      readonly generation: number;
      readonly orgId: string;
      readonly labels: OrgBrowserLabels;
      readonly filter: OrgBrowserFilterState;
      readonly roots: readonly OrgBrowserNode[];
      readonly children?: readonly {
        readonly parentId: string;
        readonly nodes: readonly OrgBrowserNode[];
      }[];
      readonly viewState?: OrgBrowserViewState;
    }
  | {
      readonly type: 'children';
      readonly generation: number;
      readonly requestId: number;
      readonly parentId: string;
      readonly nodes: readonly OrgBrowserNode[];
    }
  | {
      readonly type: 'roots';
      readonly generation: number;
      readonly requestId: number;
      readonly nodes: readonly OrgBrowserNode[];
      readonly filter: OrgBrowserFilterState;
    }
  | { readonly type: 'loading'; readonly requestId: number; readonly nodeId?: string; readonly loading: boolean }
  | { readonly type: 'error'; readonly requestId?: number; readonly message: string }
  | { readonly type: 'collapseAll' }
  | { readonly type: 'focusFilter' };
