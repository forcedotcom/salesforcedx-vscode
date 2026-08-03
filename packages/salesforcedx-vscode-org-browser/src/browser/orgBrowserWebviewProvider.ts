/*
 * Copyright (c) 2026, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */

import * as Cause from 'effect/Cause';
import * as Effect from 'effect/Effect';
import * as Either from 'effect/Either';
import * as Layer from 'effect/Layer';
import * as vscode from 'vscode';
import { URI, Utils } from 'vscode-uri';
import { retrieveMembersEffect } from '../commands/retrieveMetadata';
import { TREE_VIEW_ID } from '../constants';
import { nls } from '../messages';
import { buildAllServicesLayer, getOrgBrowserRuntime } from '../services/extensionProvider';
import { makeFilterState } from './filter';
import { makeLiveOrgBrowserModel } from './orgBrowserModel';
import {
  decodeOrgBrowserWebviewMessage,
  isCurrentOrgBrowserMessage,
  type OrgBrowserFilterState,
  type OrgBrowserHostMessage,
  type OrgBrowserNode,
  type OrgBrowserViewState,
  type OrgBrowserWebviewMessage
} from './protocol';

const VIEW_STATE_KEY = 'orgBrowser.webviewState';
type OrgBrowserServices = Layer.Layer.Success<ReturnType<typeof buildAllServicesLayer>>;
const labels = {
  local: nls.localize('webview_local'),
  org: nls.localize('webview_org'),
  filter: nls.localize('webview_filter'),
  filterPlaceholder: nls.localize('webview_filter_placeholder'),
  clearFilter: nls.localize('webview_clear_filter'),
  refresh: nls.localize('webview_refresh'),
  refreshAll: nls.localize('webview_refresh_all'),
  retrieve: nls.localize('webview_retrieve'),
  collapseAll: nls.localize('webview_collapse_all'),
  loading: nls.localize('webview_loading'),
  empty: nls.localize('webview_empty'),
  filteredEmpty: nls.localize('webview_filtered_empty'),
  presenceEmpty: nls.localize('webview_presence_empty'),
  tree: nls.localize('webview_tree'),
  controls: nls.localize('webview_controls'),
  presenceBoth: nls.localize('webview_presence_both'),
  presenceLocal: nls.localize('webview_presence_local'),
  presenceOrg: nls.localize('webview_presence_org')
} as const;

export const createOrgBrowserWebviewHtml = (
  cspSource: string,
  scriptUri: URI,
  styleUri: URI,
  scriptNonce: string
): string => `<!doctype html>
<html lang="en">
  <head>
    <meta charset="UTF-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1.0" />
    <meta http-equiv="Content-Security-Policy" content="default-src 'none'; img-src ${cspSource}; style-src ${cspSource} 'unsafe-inline'; script-src 'nonce-${scriptNonce}';" />
    <link rel="stylesheet" href="${styleUri.toString()}" />
    <title>Salesforce Org Browser</title>
  </head>
  <body><main id="main"></main><script nonce="${scriptNonce}" src="${scriptUri.toString()}"></script></body>
</html>`;

const nonce = (): string => {
  const bytes = new Uint8Array(24);
  globalThis.crypto.getRandomValues(bytes);
  return Array.from(bytes, byte => byte.toString(16).padStart(2, '0')).join('');
};

const beginViewProgress = (): (() => void) => {
  const { promise, resolve } = Promise.withResolvers<void>();
  void vscode.window.withProgress({ location: { viewId: TREE_VIEW_ID } }, () => promise);
  return resolve;
};

export class OrgBrowserWebviewProvider implements vscode.WebviewViewProvider, vscode.Disposable {
  private view: vscode.WebviewView | undefined;
  private readonly disposables: vscode.Disposable[] = [];
  private readonly nodes = new Map<string, OrgBrowserNode>();
  private generation = 0;
  private requestId = 0;
  private initialLoadStarted = false;
  private catalogRefreshInFlight = false;
  private catalogRefreshPending = false;
  private model: ReturnType<typeof makeLiveOrgBrowserModel>;

  constructor(
    private readonly context: vscode.ExtensionContext,
    initialFilter: OrgBrowserFilterState
  ) {
    this.model = makeLiveOrgBrowserModel(initialFilter);
  }

  public resolveWebviewView(webviewView: vscode.WebviewView): void {
    this.view = webviewView;
    this.initialLoadStarted = false;
    const assets = Utils.joinPath(this.context.extensionUri, 'dist', 'org-browser-ui');
    webviewView.webview.options = { enableScripts: true, localResourceRoots: [assets] };
    webviewView.webview.html = createOrgBrowserWebviewHtml(
      webviewView.webview.cspSource,
      webviewView.webview.asWebviewUri(Utils.joinPath(assets, 'app.js')),
      webviewView.webview.asWebviewUri(Utils.joinPath(assets, 'app.css')),
      nonce()
    );
    this.disposables.push(
      webviewView.webview.onDidReceiveMessage(message => this.run(this.handleMessage(message))),
      webviewView.onDidDispose(() => {
        if (this.view === webviewView) this.view = undefined;
      })
    );
  }

  public refreshFromCatalog(): void {
    if (!this.view) return;
    if (this.catalogRefreshInFlight) {
      this.catalogRefreshPending = true;
      return;
    }
    this.catalogRefreshInFlight = true;
    this.run(this.initialize().pipe(Effect.ensuring(Effect.sync(() => this.completeCatalogRefresh()))));
  }

  public collapseAll(): void {
    this.post({ type: 'collapseAll' });
  }

  public focusFilter(): void {
    this.post({ type: 'focusFilter' });
  }

  public refresh(nodeId?: string): void {
    this.requestId += 1;
    this.run(
      this.dispatch({
        type: 'refresh',
        generation: this.generation,
        requestId: this.requestId,
        ...(nodeId ? { nodeId } : {})
      })
    );
  }

  public retrieve(nodeId: string): void {
    this.requestId += 1;
    this.run(this.dispatch({ type: 'retrieve', generation: this.generation, requestId: this.requestId, nodeId }));
  }

  public setLocalPresence(showLocal: boolean): void {
    const current = this.model.getFilter();
    this.requestId += 1;
    this.run(this.setFilter(showLocal, current.showOrg, current.text, this.requestId));
  }

  public setOrgPresence(showOrg: boolean): void {
    const current = this.model.getFilter();
    this.requestId += 1;
    this.run(this.setFilter(current.showLocal, showOrg, current.text, this.requestId));
  }

  public dispose(): void {
    this.disposables.splice(0).forEach(disposable => disposable.dispose());
    this.view = undefined;
  }

  private completeCatalogRefresh(): void {
    if (this.catalogRefreshPending) {
      this.catalogRefreshPending = false;
      this.run(this.initialize().pipe(Effect.ensuring(Effect.sync(() => this.completeCatalogRefresh()))));
      return;
    }
    this.catalogRefreshInFlight = false;
  }

  private run<A, E, R extends OrgBrowserServices>(effect: Effect.Effect<A, E, R>): void {
    getOrgBrowserRuntime().runFork(
      effect.pipe(
        Effect.catchAllCause(cause => Effect.sync(() => this.post({ type: 'error', message: Cause.pretty(cause) })))
      )
    );
  }

  private post(message: OrgBrowserHostMessage): void {
    void this.view?.webview.postMessage(message);
  }

  // Effect.fn supplies the provider-operation span while retaining this provider instance.
  // eslint-disable-next-line unicorn/consistent-function-scoping
  private initialize = Effect.fn('OrgBrowserWebviewProvider.initialize')(function* (this: OrgBrowserWebviewProvider) {
    const orgId = yield* this.model.getActiveOrgId();
    if (!orgId) return;
    const roots = yield* this.model.getRoots();
    this.nodes.clear();
    roots.forEach(node => this.nodes.set(node.id, node));
    this.generation += 1;
    const states = this.context.workspaceState.get<Record<string, OrgBrowserViewState>>(VIEW_STATE_KEY) ?? {};
    const viewState = states[orgId];
    this.post({
      type: 'initialize',
      generation: this.generation,
      orgId,
      labels,
      filter: this.model.getFilter(),
      roots,
      ...(viewState ? { viewState } : {})
    });
  });

  // Effect.fn supplies the protocol-handling span while retaining this provider instance.
  private handleMessage = Effect.fn('OrgBrowserWebviewProvider.handleMessage')(function* (
    this: OrgBrowserWebviewProvider,
    input: unknown
  ) {
    const decoded = decodeOrgBrowserWebviewMessage(input);
    if (Either.isLeft(decoded)) {
      yield* Effect.logWarning('Invalid webview message', { input, error: decoded.left });
      return;
    }
    yield* this.dispatch(decoded.right);
  });

  private dispatch = Effect.fn('OrgBrowserWebviewProvider.dispatch')(function* (
    this: OrgBrowserWebviewProvider,
    message: OrgBrowserWebviewMessage
  ) {
    if (!isCurrentOrgBrowserMessage(message, this.generation)) return;
    switch (message.type) {
      case 'ready':
        this.post({ type: 'configure', labels });
        this.post({ type: 'loading', requestId: 0, loading: true });
        return;
      case 'requestInitialData':
        if (this.initialLoadStarted) return;
        this.initialLoadStarted = true;
        yield* this.initialize().pipe(
          Effect.ensuring(Effect.sync(() => this.post({ type: 'loading', requestId: 0, loading: false })))
        );
        return;
      case 'expand': {
        const requestGeneration = this.generation;
        const node = this.nodes.get(message.nodeId);
        if (!node) return;
        this.post({ type: 'loading', requestId: message.requestId, nodeId: node.id, loading: true });
        const children = yield* this.model.getChildren(node);
        if (requestGeneration !== this.generation) return;
        children.forEach(child => this.nodes.set(child.id, child));
        this.post({
          type: 'children',
          generation: requestGeneration,
          requestId: message.requestId,
          parentId: node.id,
          nodes: children
        });
        this.post({ type: 'loading', requestId: message.requestId, nodeId: node.id, loading: false });
        return;
      }
      case 'setFilter':
        yield* this.setFilter(message.showLocal, message.showOrg, message.text, message.requestId);
        return;
      case 'refresh': {
        const node = message.nodeId ? this.nodes.get(message.nodeId) : undefined;
        const completeProgress = beginViewProgress();
        yield* Effect.gen(this, function* () {
          this.post({
            type: 'loading',
            requestId: message.requestId,
            ...(node ? { nodeId: node.id } : {}),
            loading: true
          });
          yield* this.model.refresh(node);
          yield* this.initialize();
          this.post({
            type: 'loading',
            requestId: message.requestId,
            ...(node ? { nodeId: node.id } : {}),
            loading: false
          });
        }).pipe(Effect.ensuring(Effect.sync(completeProgress)));
        return;
      }
      case 'retrieve': {
        const node = this.nodes.get(message.nodeId);
        if (!node) return;
        const members = yield* this.model.getRetrieveMembers(node);
        yield* retrieveMembersEffect([...members]);
        yield* this.initialize();
        return;
      }
      case 'setViewState': {
        const states = this.context.workspaceState.get<Record<string, OrgBrowserViewState>>(VIEW_STATE_KEY) ?? {};
        yield* Effect.promise(() =>
          this.context.workspaceState.update(VIEW_STATE_KEY, { ...states, [message.orgId]: message.state })
        );
      }
    }
  });

  private setFilter = Effect.fn('OrgBrowserWebviewProvider.setFilter')(function* (
    this: OrgBrowserWebviewProvider,
    showLocal: boolean,
    showOrg: boolean,
    text: string,
    _requestId: number
  ) {
    const filter = makeFilterState(showLocal, showOrg, text);
    this.model.setFilter(filter);
    // Write filter state atomically to avoid partial state during concurrent updates
    const filterState = {
      showLocal,
      showOrg,
      typeFilter: filter.typeFilter,
      componentFilter: filter.componentFilter,
      typeIsRegex: filter.typeIsRegex,
      componentIsRegex: filter.componentIsRegex
    };
    yield* Effect.promise(() => this.context.workspaceState.update('orgBrowser.filterState', filterState));
    yield* this.initialize();
  });
}
