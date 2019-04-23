/*
 * Copyright (c) 2019, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */
import {
  commands,
  Event,
  EventEmitter,
  ExtensionContext,
  Position,
  Range,
  Selection,
  TreeDataProvider,
  TreeItemCollapsibleState,
  Uri,
  window
} from 'vscode';
import { LanguageClient, NotificationType } from 'vscode-languageclient';
import { LwcNode, NodeType } from './lwc-node';

interface TagParams {
  taginfo: any;
}

const tagAdded: NotificationType<TagParams, void> = new NotificationType<
  TagParams,
  void
>('salesforce/tagAdded');
const tagDeleted: NotificationType<string, void> = new NotificationType<
  string,
  void
>('salesforce/tagDeleted');
const tagsCleared: NotificationType<void, void> = new NotificationType<
  void,
  void
>('salesforce/tagsCleared');

let loadNamespacesPromise: Promise<Map<string, LwcNode>> | null;

async function loadNamespaces(client: LanguageClient) {
  if (!loadNamespacesPromise) {
    loadNamespacesPromise = client
      .onReady()
      .then(() => client.sendRequest('salesforce/listComponents', {}))
      .then((data: any) => {
        let namespaces: Map<string, LwcNode> = new Map();

        const tags: Map<string, any> = new Map(JSON.parse(data));
        for (const key of tags.keys()) {
          // safety
          if (!key) {
            continue;
          }
          const value = tags.get(key);
          const ns = key.split(':')[0];
          let node = namespaces.get(ns);
          if (!node) {
            node = new LwcNode(
              ns,
              '',
              NodeType.Namespace,
              TreeItemCollapsibleState.Collapsed
            );
            namespaces.set(ns, node);
          }
          const hasChildren = value.attributes.length > 0;
          const uriString = value.location && value.location.uri;
          const uri = uriString ? Uri.parse(uriString) : undefined;
          const componentType = value.lwc
            ? NodeType.WebComponent
            : NodeType.Component;
          const openCmd = uri
            ? {
                command: 'salesforce-open-component',
                title: '',
                arguments: [uri]
              }
            : undefined;
          const cmp = new LwcNode(
            key,
            value.documentation,
            componentType,
            hasChildren
              ? TreeItemCollapsibleState.Collapsed
              : TreeItemCollapsibleState.None,
            uri,
            openCmd
          );

          node.children.push(cmp);

          for (const attr of value.attributes) {
            const attributeStringUri = attr.location && attr.location.uri;
            const attributeUri = attributeStringUri
              ? Uri.parse(attributeStringUri)
              : undefined;
            const attributeRange =
              (attr.location && attr.location.range) || undefined;
            const openAttributeCommand = attributeUri
              ? {
                  command: 'salesforce-open-component',
                  title: '',
                  arguments: [attributeUri, attributeRange]
                }
              : undefined;
            cmp.children.push(
              new LwcNode(
                attr.name,
                attr.detail,
                NodeType.Attribute,
                TreeItemCollapsibleState.None,
                attributeUri,
                openAttributeCommand
              )
            );
          }
        }

        namespaces = new Map(
          [...namespaces].sort((a, b) => (a[0] > b[0] ? 1 : -1))
        );

        return namespaces;
      })
      .catch(err => {
        console.error('Could not request lwc/listComponents', err);
        return new Map();
      });
  }
  return loadNamespacesPromise;
}
function debounce(fn: any, wait: number) {
  return function _debounce() {
    // @ts-ignore
    if (!_debounce.pending) {
      // @ts-ignore
      _debounce.pending = true;
      setTimeout(() => {
        fn();
        // @ts-ignore
        _debounce.pending = false;
      }, wait);
    }
  };
}

export class ComponentTreeProvider implements TreeDataProvider<LwcNode> {
  public readonly onDidChangeTreeData: Event<LwcNode | undefined>;

  private internalOnDidChangeTreeData: EventEmitter<
    LwcNode | undefined
  > = new EventEmitter<LwcNode | undefined>();
  private namespaces: Map<string, LwcNode> = new Map();
  private refreshTree = debounce(this.fullRefresh.bind(this), 1000);

  constructor(public client: LanguageClient, public context: ExtensionContext) {
    this.onDidChangeTreeData = this.internalOnDidChangeTreeData.event;
    this.client = client;
    this.context = context;

    client
      .onReady()
      .then(() => {
        this.client.onNotification(tagAdded, this.refreshTree);
        this.client.onNotification(tagDeleted, this.refreshTree);
        this.client.onNotification(tagsCleared, this.refreshTree);
      })
      .catch();

    commands.registerCommand('salesforce-open-component', (uri, range) => {
      commands.executeCommand('vscode.open', uri);
      if (range) {
        if (window.activeTextEditor) {
          window.activeTextEditor.selection = new Selection(
            new Position(range.start.line, range.start.character),
            new Position(range.end.line, range.end.character)
          );
          const revealRange = new Range(
            new Position(range.start.line, range.start.character),
            new Position(range.end.line, range.end.character)
          );
          window.activeTextEditor.revealRange(revealRange);
        }
      }
    });
  }

  public async getChildren(node?: LwcNode): Promise<LwcNode[]> {
    if (node) {
      const sorted = node.children.sort((a, b) =>
        (a.label || '') < (b.label || '') ? -1 : 1
      );
      return Promise.resolve(sorted);
    } else {
      return [...(await loadNamespaces(this.client)).values()];
    }
  }

  public getTreeItem(node: LwcNode): LwcNode {
    return node;
  }
  private fullRefresh(params: TagParams) {
    // TODO the nuclear option
    loadNamespacesPromise = null;
    this.internalOnDidChangeTreeData.fire();
  }
}
