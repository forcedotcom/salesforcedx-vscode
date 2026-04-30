/*
 *  Copyright (c) 2020, salesforce.com, inc.
 *  All rights reserved.
 *  Licensed under the BSD 3-Clause license.
 *  For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 *
 */

import { LightningElement, track } from 'lwc';
import { JsonMap } from '@salesforce/ts-types';
import { messages } from 'querybuilder/messages';
import { ToolingSDK } from '../services/toolingSDK';
import { VscodeMessageService } from '../services/message/vscodeMessageService';

import { ToolingModelService } from '../services/toolingModelService';
import { IMessageService } from '../services/message/iMessageService';
import {
  MessageType,
  SoqlEditorEvent
} from '../services/message/soqlEditorEvent';
import {
  recoverableErrors,
  recoverableFieldErrors,
  recoverableFromErrors,
  recoverableLimitErrors
} from '../error/errorModel';
import { getBodyClass } from '../services/globals';
import { ToolingModelJson, SubqueryJson } from '../services/model';
import { lwcIndexableArray } from '../services/lwcUtils';
import type { TreeNode } from '../schemaTree/schemaTree';
import type { BreadcrumbItem } from '../detailPanel/detailPanel';
import {
  extractRelOptions,
  extractChildRelOptions
} from '../services/drillUtils';
import { segmentSoql } from '../services/soqlSegmenter';
import type { SoqlSegment } from '../services/soqlSegmenter';

export default class App extends LightningElement {
  @track
  public query: ToolingModelJson = ToolingModelService.toolingModelTemplate;

  @track
  public sObjects: string[] = [];
  @track
  public fields: string[] = [];
  public toolingSDK: ToolingSDK;
  public modelService: ToolingModelService;
  public messageService: IMessageService;
  public theme = 'light';
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  public sobjectMetadata: any;
  public notifications = [];
  // Cache of sObject name → field list for parent relationship drill-down
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  private _metadataCache: Map<string, any> = new Map();

  @track public activeContextPath: string[] = [];
  @track public activeRelPath: string[] = [];
  @track private _expandedNodes: Set<string> = new Set(['root']);

  public get treeNodes(): TreeNode[] {
    if (!this.query.sObject) return [];
    return this._buildTreeNodes();
  }

  public get querySegments(): SoqlSegment[] {
    return segmentSoql(this.query.originalSoqlStatement, this.query);
  }

  public get activeContextData() {
    return this.modelService.getContextData(this.activeContextPath);
  }

  public get activeContextLabel(): string {
    if (this.activeRelPath.length > 0) {
      return this.activeRelPath[this.activeRelPath.length - 1];
    }
    if (this.activeContextPath.length === 0) return this.query.sObject;
    return this.activeContextPath[this.activeContextPath.length - 1];
  }

  public get activeBreadcrumbs(): BreadcrumbItem[] {
    const crumbs: BreadcrumbItem[] = [];
    const allSegments: Array<{ label: string; contextPath: string[]; relPath: string[] }> = [];

    // Root sObject is always the first crumb
    allSegments.push({ label: this.query.sObject || 'Query', contextPath: [], relPath: [] });

    // Subquery context segments
    for (let i = 0; i < this.activeContextPath.length; i++) {
      allSegments.push({
        label: this.activeContextPath[i],
        contextPath: this.activeContextPath.slice(0, i + 1),
        relPath: []
      });
    }

    // Relationship path segments
    for (let i = 0; i < this.activeRelPath.length; i++) {
      allSegments.push({
        label: this.activeRelPath[i],
        contextPath: [...this.activeContextPath],
        relPath: this.activeRelPath.slice(0, i + 1)
      });
    }

    for (let i = 0; i < allSegments.length; i++) {
      const seg = allSegments[i];
      crumbs.push({
        id: `bc-${i}`,
        index: i,
        label: seg.label,
        contextPath: seg.contextPath,
        relPath: seg.relPath,
        isLast: i === allSegments.length - 1
      });
    }
    return crumbs;
  }

  public get activeSelectedFields(): string[] {
    if (this.activeRelPath.length > 0) {
      const topRelName = this.activeRelPath[0];
      const rels = this._getContextRelationships();
      const relData = rels.find(r => r.relationshipName === topRelName);
      if (!relData) return [];
      const dottedPrefix = this.activeRelPath.slice(1).join('.');
      return relData.fields
        .filter(f => dottedPrefix ? f.startsWith(`${dottedPrefix}.`) : !f.includes('.'))
        .map(f => dottedPrefix ? f.slice(dottedPrefix.length + 1) : f);
    }
    return this.activeContextData.selectedFields;
  }

  public get activeAvailableFields(): string[] {
    if (this.activeRelPath.length > 0) {
      return this._getRelAvailableFields(this.activeRelPath);
    }
    if (this.activeContextPath.length === 0) return this.fields;
    return this._getSubqueryAvailableFields(this.activeContextPath);
  }

  public get activeWhereFields(): string[] {
    if (this.activeContextPath.length === 0) return this.whereFields;
    return this._getSubqueryAvailableFields(this.activeContextPath);
  }

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  public get activeMetadata(): any {
    if (this.activeContextPath.length === 0) return this.sobjectMetadata;
    const childSObject = this._resolveChildSObject(this.activeContextPath[this.activeContextPath.length - 1]);
    if (!childSObject) return null;
    return this._metadataCache.get(childSObject.toLowerCase()) || null;
  }

  /* eslint-disable @typescript-eslint/no-unsafe-member-access, @typescript-eslint/no-explicit-any */
  private _resolveChildSObject(relationshipName: string): string | null {
    for (const [, meta] of this._metadataCache) {
      const cr = (meta?.childRelationships || []).find(
        (c: any) => c.relationshipName === relationshipName
      );
      if (cr) return cr.childSObject as string;
    }
    return null;
  }

  private _resolveRelSObject(relPath: string[]): string | null {
    // Walk the relationship chain from the root sObject's metadata
    let currentMeta = this.sobjectMetadata;
    for (const relName of relPath) {
      if (!currentMeta || !currentMeta.fields) return null;
      const refField = (currentMeta.fields as any[]).find(
        (f: any) => f.type === 'reference' && f.relationshipName === relName
      );
      if (!refField || !refField.referenceTo?.[0]) return null;
      const targetSObject: string = refField.referenceTo[0];
      currentMeta = this._metadataCache.get(targetSObject.toLowerCase());
      if (!currentMeta) {
        this.toolingSDK.loadSObjectMetatada(targetSObject);
        return null;
      }
    }
    return currentMeta?.name ?? null;
  }

  private _getRelAvailableFields(relPath: string[]): string[] {
    const sobjectName = this._resolveRelSObject(relPath);
    if (!sobjectName) return [];
    const cached = this._metadataCache.get(sobjectName.toLowerCase());
    if (!cached) return [];
    return cached.fields?.map((f: any) => f.name as string).sort() ?? [];
  }

  private _getSubqueryAvailableFields(path: string[]): string[] {
    const relName = path[path.length - 1];
    const childSObject = this._resolveChildSObject(relName);
    if (!childSObject) return [];
    const cached = this._metadataCache.get(childSObject.toLowerCase());
    if (!cached) return [];
    return cached.fields?.map((f: any) => f.name as string).sort() ?? [];
  }
  /* eslint-enable @typescript-eslint/no-unsafe-member-access, @typescript-eslint/no-explicit-any */

  private _findSubquery(path: string[]): SubqueryJson | null {
    let nodes: SubqueryJson[] = this.query.subqueries || [];
    let node: SubqueryJson | undefined;
    for (const segment of path) {
      node = nodes.find(s => s.relationshipName === segment);
      if (!node) return null;
      nodes = node.subqueries || [];
    }
    return node ?? null;
  }

  private _fieldCountLabel(count: number): string {
    if (count === 0) return '';
    return ` (${count} field${count !== 1 ? 's' : ''})`;
  }

  private _buildTreeNodes(): TreeNode[] {
    const nodes: TreeNode[] = [];
    const rootId = 'root';
    const rootExpanded = this._expandedNodes.has(rootId);
    const isRootSelected = this.activeContextPath.length === 0;
    const rootFieldCount = this.query.fields.length;

    const rootHasContent = rootFieldCount > 0 ||
      (this.query.relationships || []).length > 0 ||
      (this.query.subqueries || []).length > 0;

    nodes.push({
      id: rootId,
      label: `${this.query.sObject}${this._fieldCountLabel(rootFieldCount)}`,
      type: 'root',
      depth: 0,
      isExpanded: rootExpanded,
      isSelected: isRootSelected,
      hasContent: rootHasContent,
      contextPath: [],
      hasChildren: true,
      isLoading: this.isFieldsLoading
    });

    if (rootExpanded && this.sobjectMetadata) {
      // Parent relationship nodes
      const rels = extractRelOptions(this.sobjectMetadata);
      for (const rel of rels) {
        this._addParentRelNode(nodes, rel.relationshipName, [], [rel.relationshipName], 1);
      }

      // Child subquery nodes
      const childRels = extractChildRelOptions(this.sobjectMetadata);
      for (const child of childRels) {
        this._addSubqueryNode(nodes, child.relationshipName, [child.relationshipName], 1);
      }
    }

    return nodes;
  }

  /* eslint-disable @typescript-eslint/no-unsafe-member-access, @typescript-eslint/no-explicit-any */
  private _addParentRelNode(nodes: TreeNode[], relName: string, contextPath: string[], relPath: string[], depth: number): void {
    const nodeId = `rel.${[...contextPath, ...relPath].join('.')}`;
    const isExpanded = this._expandedNodes.has(nodeId);
    const isSelected = this._pathsEqual(this.activeContextPath, contextPath) &&
      this._pathsEqual(this.activeRelPath, relPath);

    let relFieldCount = 0;
    if (relPath.length === 1) {
      const contextRels = contextPath.length === 0
        ? (this.query.relationships || [])
        : (this._findSubquery(contextPath)?.relationships || []);
      const relData = contextRels.find(r => r.relationshipName === relPath[0]);
      relFieldCount = relData ? relData.fields.length : 0;
    }

    nodes.push({
      id: nodeId,
      label: `${relName}${this._fieldCountLabel(relFieldCount)}`,
      type: 'parentRel',
      depth,
      isExpanded,
      isSelected,
      hasContent: relFieldCount > 0,
      contextPath: [...contextPath],
      relPath: [...relPath],
      hasChildren: true
    });

    if (isExpanded) {
      const targetSObject = this._resolveRelSObject(relPath);
      if (targetSObject) {
        const cached = this._metadataCache.get(targetSObject.toLowerCase());
        if (cached) {
          const childRels = extractRelOptions(cached);
          for (const childRel of childRels) {
            this._addParentRelNode(nodes, childRel.relationshipName, contextPath, [...relPath, childRel.relationshipName], depth + 1);
          }
        }
      }
    }
  }
  /* eslint-enable @typescript-eslint/no-unsafe-member-access, @typescript-eslint/no-explicit-any */

  private _addSubqueryNode(nodes: TreeNode[], relName: string, path: string[], depth: number): void {
    const nodeId = `subquery.${path.join('.')}`;
    const isExpanded = this._expandedNodes.has(nodeId);
    const isSelected = this._pathsEqual(this.activeContextPath, path);
    const sq = this._findSubquery(path);
    const fieldCount = sq ? sq.fields.length : 0;
    const sqHasContent = sq !== null && (
      sq.fields.length > 0 ||
      (sq.relationships || []).length > 0 ||
      (sq.subqueries || []).length > 0
    );

    nodes.push({
      id: nodeId,
      label: `${relName}${this._fieldCountLabel(fieldCount)}`,
      type: 'childSubquery',
      depth,
      isExpanded,
      isSelected,
      hasContent: sqHasContent,
      contextPath: [...path],
      hasChildren: true
    });

    if (isExpanded) {
      const childSObject = this._resolveChildSObject(relName);
      const cached = childSObject ? this._metadataCache.get(childSObject.toLowerCase()) : null;
      if (cached) {
        // Parent relationships for this child sObject
        const rels = extractRelOptions(cached);
        for (const rel of rels) {
          this._addParentRelNode(nodes, rel.relationshipName, [...path], [rel.relationshipName], depth + 1);
        }
        // Child subqueries for this child sObject
        const childRels = extractChildRelOptions(cached);
        for (const child of childRels) {
          this._addSubqueryNode(nodes, child.relationshipName, [...path, child.relationshipName], depth + 1);
        }
      } else if (childSObject) {
        this.toolingSDK.loadSObjectMetatada(childSObject);
      }
    }
  }

  private _pathsEqual(a: string[], b: string[]): boolean {
    return a.length === b.length && a.every((v, i) => v === b[i]);
  }

  public get shouldBlockQueryBuilder(): boolean {
    return (
      (this.hasUnrecoverableError || this.hasUnsupportedMessage) &&
      this.dismissNotifications === false
    );
  }
  public get showUnsupportedNotification(): boolean {
    return !this.hasUnrecoverableError && this.hasUnsupportedMessage;
  }
  public get showSyntaxErrorNotification(): boolean {
    return this.hasUnrecoverableError;
  }
  public get showNoDefaultOrgNotification(): boolean {
    return this.hasNoDefaultOrg;
  }
  public get showBlockedQueryBuilder(): boolean {
    return !this.hasNoDefaultOrg && this.shouldBlockQueryBuilder;
  }
  public get showQueryBuilderForm(): boolean {
    return !this.hasNoDefaultOrg && !this.shouldBlockQueryBuilder;
  }

  // Base fields + committed relationship fields (e.g. Owner.Name) for use in Filter / Order By
  public get whereFields(): string[] {
    const relFields = (this.query.relationships || []).flatMap(r =>
      r.fields.map(f => `${r.relationshipName}.${f}`)
    );
    return [...this.fields, ...relFields].sort();
  }
  public hasNoDefaultOrg = false;
  public hasUnsupportedMessage = false;
  public hasRecoverableFieldsError = false;
  public hasRecoverableFromError = false;
  public hasRecoverableLimitError = false;
  public hasRecoverableError = true;
  public hasUnrecoverableError = false;
  public isFromLoading = false;
  public isFieldsLoading = false;
  public isQueryRunning = false;
  public isQueryPlanRunning = false;
  public dismissNotifications = false;

  public constructor() {
    super();
    this.messageService = new VscodeMessageService();
    this.toolingSDK = new ToolingSDK(this.messageService);
    this.modelService = new ToolingModelService(this.messageService);
  }

  /* eslint-disable @typescript-eslint/no-unsafe-assignment,@typescript-eslint/no-unsafe-member-access,@typescript-eslint/no-unsafe-call,@typescript-eslint/no-unsafe-return */
  public connectedCallback(): void {
    this.modelService.UIModel.subscribe(this.uiModelSubscriber.bind(this));

    this.toolingSDK.sobjects.subscribe((objs: string[]) => {
      this.isFromLoading = false;
      this.sObjects = objs;
    });

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    this.toolingSDK.sobjectMetadata.subscribe((sobjectMetadata: any) => {
      // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access
      if (sobjectMetadata && sobjectMetadata.name) {
        // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access
        this._metadataCache.set((sobjectMetadata.name as string).toLowerCase(), sobjectMetadata);
      }
      // Only update the primary fields list when this is the main sObject being loaded
      // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access
      const loadedName: string = sobjectMetadata?.name ?? '';
      const currentSObject = this.query?.sObject ?? '';
      if (!currentSObject || loadedName.toLowerCase() === currentSObject.toLowerCase() || !loadedName) {
        this.isFieldsLoading = false;
        this.fields =
          sobjectMetadata && sobjectMetadata.fields
            // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access, @typescript-eslint/no-unsafe-call
            ? sobjectMetadata.fields.map((f) => f.name).sort()
            : [];
        this.sobjectMetadata = sobjectMetadata;
      }
    });

    this.toolingSDK.queryRunState.subscribe(() => {
      this.isQueryRunning = false;
    });

    this.toolingSDK.queryPlanRunState.subscribe(() => {
      this.isQueryPlanRunning = false;
    });

    this.toolingSDK.noDefaultOrg.subscribe((hasNoDefaultOrg: boolean) => {
      this.hasNoDefaultOrg = hasNoDefaultOrg;
    });

    this.loadSObjectDefinitions();
    this.modelService.restoreViewState();
  }

  public renderedCallback(): void {
    const themeClass = getBodyClass();
    if (themeClass.indexOf('vscode-dark') > -1) {
      this.theme = 'dark';
    } else if (themeClass.indexOf('vscode-high-contrast') > -1) {
      this.theme = 'contrast';
    }
  }

  /* eslint-disable @typescript-eslint/no-unsafe-assignment */
  public uiModelSubscriber(newQuery: ToolingModelJson): void {
    // only re-render if incoming soql statement is different
    if (this.query.originalSoqlStatement !== newQuery.originalSoqlStatement) {
      this.notifications = lwcIndexableArray<string>([
        ...this.inspectUnsupported(newQuery.unsupported),
        ...this.inspectErrors(newQuery.errors)
      ]);
      this.loadSObjectMetadata(newQuery);
      this.query = newQuery;
    }
  }
  /* eslint-enable @typescript-eslint/no-unsafe-assignment,@typescript-eslint/no-unsafe-member-access,@typescript-eslint/no-unsafe-call,@typescript-eslint/no-unsafe-return */

  public loadSObjectDefinitions(): void {
    this.isFromLoading = true;
    this.toolingSDK.loadSObjectDefinitions();
  }

  public loadSObjectMetadata(newQuery: ToolingModelJson): void {
    const previousSObject = this.query ? this.query.sObject : '';
    const newSObject = newQuery.sObject;
    // if empty sobject, clear fields
    if (!newSObject.length) {
      this.fields = [];
      return;
    }
    // if empty previous sobject or else new sobject does not match previous
    if (previousSObject.length === 0 || previousSObject !== newSObject) {
      this.onSObjectChanged(newSObject);
    }
    // if no fields have been downloaded yet
    else if (
      previousSObject === newSObject &&
      this.fields.length === 0 &&
      this.isFieldsLoading === false
    ) {
      this.onSObjectChanged(newSObject);
    }
  }

  /* eslint-disable @typescript-eslint/no-unsafe-member-access,@typescript-eslint/no-explicit-any */
  public inspectErrors(errors: any[]): unknown[] {
    this.hasRecoverableFieldsError = false;
    this.hasRecoverableFromError = false;
    this.hasRecoverableLimitError = false;
    this.hasUnrecoverableError = false;
    const messages = [];
    errors.forEach((error) => {
      if (recoverableErrors[error.type]) {
        this.hasRecoverableError = true;
        if (recoverableFieldErrors[error.type]) {
          this.hasRecoverableFieldsError = true;
        }
        if (recoverableLimitErrors[error.type]) {
          this.hasRecoverableLimitError = true;
        }
        if (recoverableFromErrors[error.type]) {
          this.hasRecoverableFromError = true;
        }
      } else {
        this.hasUnrecoverableError = true;
      }
      messages.push(error.message);
    });
    return messages;
  }

  /* eslint-disable @typescript-eslint/no-unsafe-assignment,@typescript-eslint/no-unsafe-call,@typescript-eslint/no-unsafe-return*/
  public inspectUnsupported(unsupported: JsonMap[]): any {
    const filteredUnsupported = unsupported
      // this reason is often associated with a parse error, so snuffing it out instead of double notifications
      .filter(
        (unsup) => unsup.reason.reasonCode !== 'unmodeled:empty-condition'
      )
      .map((unsup) => {
        return unsup.reason.message;
      });
    this.hasUnsupportedMessage = filteredUnsupported.length > 0;
    return filteredUnsupported;
  }
  /* ---- SOBJECT HANDLERS ---- */
  public handleObjectChange(e: CustomEvent): void {
    const selectedSObjectName = e.detail.selectedSobject;
    this.onSObjectChanged(selectedSObjectName);
    // when triggered by the ui, send message
    this.modelService.setSObject(selectedSObjectName);
  }

  public onSObjectChanged(sobjectName: string): void {
    if (sobjectName) {
      this.fields = [];
      this.isFieldsLoading = true;
      this.toolingSDK.loadSObjectMetatada(sobjectName);
    }
  }
  /* ---- FIELD HANDLERS ---- */
  public handleFieldSelected(e: CustomEvent): void {
    this.modelService.setFields(e.detail.fields);
  }
  public handleFieldSelectAll(): void {
    this.modelService.setFields(this.fields);
  }
  public handleFieldClearAll(): void {
    this.modelService.setFields([]);
  }

  public handleOrderBySelected(e: CustomEvent): void {
    this.modelService.addUpdateOrderByField(e.detail);
  }
  public handleOrderByRemoved(e: CustomEvent): void {
    this.modelService.removeOrderByField(e.detail.field);
  }
  /* ---- LIMIT HANDLERS ---- */
  public handleLimitChanged(e: CustomEvent): void {
    this.modelService.changeLimit(e.detail.limit);
  }
  /* ---- WHERE HANDLERS ---- */
  public handleWhereSelection(e: CustomEvent): void {
    this.modelService.upsertWhereFieldExpr(e.detail);
  }
  public handleAndOrSelection(e: CustomEvent): void {
    this.modelService.setAndOr(e.detail);
  }
  public handleRemoveWhereCondition(e: CustomEvent): void {
    this.modelService.removeWhereFieldCondition(e.detail);
  }

  /* ---- TREE HANDLERS ---- */
  /* eslint-disable @typescript-eslint/no-unsafe-member-access, @typescript-eslint/no-unsafe-call, @typescript-eslint/no-explicit-any */
  public handleTreeNodeSelect(e: CustomEvent): void {
    const path = [...(e.detail.contextPath as string[])];
    const relPath = [...(e.detail.relPath as string[] || [])];
    this.activeContextPath = path;
    this.activeRelPath = relPath;

    // When selecting a child subquery, ensure its metadata is loaded
    if (path.length > 0) {
      this._ensureSubqueryMetadataLoaded(path);
    }
    // When selecting a parent rel, ensure its target sObject metadata is loaded
    if (relPath.length > 0) {
      this._resolveRelSObject(relPath);
    }
  }

  private _ensureSubqueryMetadataLoaded(path: string[]): void {
    const relName = path[path.length - 1];
    // Find the child sObject name from the parent's cached metadata
    let childSObject: string | undefined;
    this._metadataCache.forEach((meta: any) => {
      if (childSObject) return;
      const cr = (meta?.childRelationships || []).find(
        (c: any) => c.relationshipName === relName
      );
      if (cr) childSObject = cr.childSObject as string;
    });
    if (!childSObject) return;
    if (this._metadataCache.has(childSObject.toLowerCase())) return;
    this.toolingSDK.loadSObjectMetatada(childSObject);
  }
  /* eslint-enable @typescript-eslint/no-unsafe-member-access, @typescript-eslint/no-unsafe-call, @typescript-eslint/no-explicit-any */

  public handleTreeFieldToggle(e: CustomEvent): void {
    const { contextPath, field, checked } = e.detail as { contextPath: string[]; field: string; checked: boolean };
    if (contextPath.length === 0) {
      // Root field toggle
      const currentFields = [...this.query.fields];
      if (checked) {
        if (!currentFields.includes(field)) currentFields.push(field);
      } else {
        const idx = currentFields.indexOf(field);
        if (idx >= 0) currentFields.splice(idx, 1);
      }
      this.modelService.setFields(currentFields);
    } else {
      // Subquery field toggle
      const sq = this._findSubquery(contextPath);
      const currentFields = sq ? [...sq.fields] : [];
      if (checked) {
        if (!currentFields.includes(field)) currentFields.push(field);
      } else {
        const idx = currentFields.indexOf(field);
        if (idx >= 0) currentFields.splice(idx, 1);
      }
      this.modelService.setSubqueryFieldsAtPath(contextPath, currentFields);
    }
  }

  public handleTreeNodeExpand(e: CustomEvent): void {
    const { nodeId, expanded } = e.detail as { nodeId: string; contextPath: string[]; expanded: boolean };
    const updated = new Set(this._expandedNodes);
    if (expanded) {
      updated.add(nodeId);
    } else {
      updated.delete(nodeId);
    }
    this._expandedNodes = updated;
  }

  public handlePreviewNavigate(e: CustomEvent): void {
    const { contextPath } = e.detail as { contextPath: string[] };
    this.activeContextPath = [...contextPath];
    this.activeRelPath = [];
    if (contextPath.length > 0) {
      this._ensureSubqueryMetadataLoaded(contextPath);
    }
    // Auto-expand tree nodes along the path
    const updated = new Set(this._expandedNodes);
    updated.add('root');
    for (let i = 0; i < contextPath.length; i++) {
      updated.add(`subquery.${contextPath.slice(0, i + 1).join('.')}`);
    }
    this._expandedNodes = updated;
  }

  public handleDetailNavigate(e: CustomEvent): void {
    const { contextPath, relPath } = e.detail as { contextPath: string[]; relPath: string[] };
    this.activeContextPath = [...contextPath];
    this.activeRelPath = [...relPath];
    if (contextPath.length > 0) {
      this._ensureSubqueryMetadataLoaded(contextPath);
    }
    if (relPath.length > 0) {
      this._resolveRelSObject(relPath);
    }
    // Auto-expand tree nodes along the path so the selected node is visible
    if (contextPath.length === 0 && relPath.length === 0) {
      // Root — ensure root is expanded
      const updated = new Set(this._expandedNodes);
      updated.add('root');
      this._expandedNodes = updated;
    }
  }

  public handleDetailFieldsChanged(e: CustomEvent): void {
    const { fields } = e.detail as { fields: string[] };
    if (this.activeRelPath.length > 0) {
      const topRelName = this.activeRelPath[0];
      const dottedPrefix = this.activeRelPath.slice(1).join('.');
      // Preserve fields at other dotted levels, replace only fields at the current level
      const existingRels = this._getContextRelationships();
      const relData = existingRels.find(r => r.relationshipName === topRelName);
      const existingFields = relData ? relData.fields : [];
      const otherFields = existingFields.filter(f => {
        const fPrefix = f.includes('.') ? f.substring(0, f.lastIndexOf('.')) : '';
        return fPrefix !== dottedPrefix;
      });
      const newDottedFields = fields.map(f => dottedPrefix ? `${dottedPrefix}.${f}` : f);
      this.modelService.setContextRelationshipFields(
        this.activeContextPath, topRelName, [...otherFields, ...newDottedFields]
      );
    } else {
      this.modelService.setContextFields(this.activeContextPath, fields);
    }
  }

  private _getContextRelationships(): Array<{ relationshipName: string; fields: string[] }> {
    if (this.activeContextPath.length === 0) {
      return this.query.relationships || [];
    }
    const sq = this._findSubquery(this.activeContextPath);
    return sq?.relationships || [];
  }

  /* ---- DETAIL PANEL CONTEXT HANDLERS ---- */
  public handleContextWhereSelection(e: CustomEvent): void {
    if (this.activeContextPath.length === 0) {
      this.handleWhereSelection(e);
    } else {
      const ctx = this.modelService.getContextData(this.activeContextPath);
      this.modelService.setContextWhere(this.activeContextPath, {
        ...ctx.where,
        conditions: [...ctx.where.conditions, e.detail.fieldCompareExpr]
      });
    }
  }

  public handleContextAndOrSelection(e: CustomEvent): void {
    if (this.activeContextPath.length === 0) {
      this.handleAndOrSelection(e);
    } else {
      const ctx = this.modelService.getContextData(this.activeContextPath);
      this.modelService.setContextWhere(this.activeContextPath, {
        ...ctx.where,
        andOr: e.detail
      });
    }
  }

  public handleContextWhereRemoved(e: CustomEvent): void {
    if (this.activeContextPath.length === 0) {
      this.handleRemoveWhereCondition(e);
    } else {
      const ctx = this.modelService.getContextData(this.activeContextPath);
      // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access
      const filtered = ctx.where.conditions.filter(c => c.index !== e.detail.index);
      this.modelService.setContextWhere(this.activeContextPath, {
        ...ctx.where,
        conditions: filtered
      });
    }
  }

  public handleContextOrderBySelected(e: CustomEvent): void {
    if (this.activeContextPath.length === 0) {
      this.handleOrderBySelected(e);
    } else {
      const ctx = this.modelService.getContextData(this.activeContextPath);
      this.modelService.setContextOrderBy(this.activeContextPath, [...ctx.orderBy, e.detail]);
    }
  }

  public handleContextOrderByRemoved(e: CustomEvent): void {
    if (this.activeContextPath.length === 0) {
      this.handleOrderByRemoved(e);
    } else {
      const ctx = this.modelService.getContextData(this.activeContextPath);
      // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access
      const filtered = ctx.orderBy.filter(ob => ob.field !== e.detail.field);
      this.modelService.setContextOrderBy(this.activeContextPath, filtered);
    }
  }

  public handleContextLimitChanged(e: CustomEvent): void {
    if (this.activeContextPath.length === 0) {
      this.handleLimitChanged(e);
    } else {
      this.modelService.setContextLimit(this.activeContextPath, e.detail.limit);
    }
  }

  /* ---- MISC HANDLERS ---- */
  public handleDismissNotifications(): void {
    this.dismissNotifications = true;
  }

  public handleSetDefaultOrg(): void {
    const setDefaultOrgEvent: SoqlEditorEvent = { type: MessageType.SET_DEFAULT_ORG };
    this.messageService.sendMessage(setDefaultOrgEvent);
  }

  public get i18n() {
    return messages;
  }

  public get isQueryValid(): boolean {
    return (
      Boolean(this.query.sObject) &&
      (this.query.fields.length > 0 ||
        (this.query.relationships || []).some(r => r.fields.length > 0) ||
        (this.query.subqueries || []).some(s => s.fields.length > 0))
    );
  }

  public handleRunQuery(): void {
    this.isQueryRunning = true;
    const runQueryEvent: SoqlEditorEvent = { type: MessageType.RUN_SOQL_QUERY };
    this.messageService.sendMessage(runQueryEvent);
  }

  public handleGetQueryPlan(): void {
    this.isQueryPlanRunning = true;
    const planEvent: SoqlEditorEvent = { type: MessageType.GET_QUERY_PLAN };
    this.messageService.sendMessage(planEvent);
  }
}
