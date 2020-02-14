/*
 * Copyright (c) 2019, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */
import { AttributeInfo, TagInfo } from '@salesforce/lightning-lsp-common';
import {
  isUnknown,
  WorkspaceType
} from '@salesforce/lightning-lsp-common/lib/shared';
import { paramCase } from 'change-case';
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

function createAttribute(attr: AttributeInfo, lwc: boolean) {
  const attributeStringUri = attr.location && attr.location.uri;
  const attributeUri = attributeStringUri
    ? Uri.parse(attributeStringUri)
    : undefined;
  const attributeRange = (attr.location && attr.location.range) || undefined;
  const openAttributeCommand = attributeUri
    ? {
        command: 'salesforce-open-component',
        title: '',
        arguments: [attributeUri, attributeRange]
      }
    : undefined;
  let name = attr.name;
  if (lwc) {
    name = paramCase(name);
  }
  return new LwcNode(
    name,
    attr.detail || '',
    NodeType.Attribute,
    TreeItemCollapsibleState.None,
    attributeUri,
    openAttributeCommand
  );
}
function createMethod(method: any /*ClassMember*/, uri: string | undefined) {
  const attributeUri = uri ? Uri.parse(uri) : undefined;
  let attributeRange = null;
  if (method.loc) {
    attributeRange = new Range(
      new Position(method.loc.start.line, method.loc.start.column),
      new Position(method.loc.end.line, method.loc.end.column)
    );
  }
  const openAttributeCommand = attributeUri
    ? {
        command: 'salesforce-open-component',
        title: '',
        arguments: [attributeUri, attributeRange]
      }
    : undefined;
  const name = method.name + '()';

  return new LwcNode(
    name,
    '',
    NodeType.Method,
    TreeItemCollapsibleState.None,
    attributeUri,
    openAttributeCommand
  );
}
function createNamespace(ns: string) {
  return new LwcNode(
    ns,
    '',
    NodeType.Namespace,
    TreeItemCollapsibleState.Collapsed
  );
}
function createComponent(value: TagInfo) {
  const hasChildren = value.attributes.length > 0;
  const uriString = value.location && value.location.uri;
  const uri = uriString ? Uri.parse(uriString) : undefined;
  const componentType = value.lwc ? NodeType.WebComponent : NodeType.Component;
  const openCmd = uri
    ? {
        command: 'salesforce-open-component',
        title: '',
        arguments: [uri]
      }
    : undefined;
  return new LwcNode(
    value.name || '',
    value.documentation || '',
    componentType,
    hasChildren
      ? TreeItemCollapsibleState.Collapsed
      : TreeItemCollapsibleState.None,
    uri,
    openCmd
  );
}
async function loadNamespaces(
  client: LanguageClient,
  workspaceType: WorkspaceType
) {
  if (!loadNamespacesPromise) {
    loadNamespacesPromise = client
      .onReady()
      .then(() => client.sendRequest('salesforce/listComponents', {}))
      .then((data: any) => {
        const tags: Map<string, TagInfo> = new Map(JSON.parse(data));

        const unknown = isUnknown(workspaceType);
        if (unknown) {
          // if we're unknown, check to see if we have any aura custom components
          // if we dont', we want to filter all aura components
          const hasCustomComponent = [...tags.values()].find(
            (e: any) => e.type === NodeType.Component && e.file
          );
          const hasCustomWebComponent = [...tags.values()].find(
            (e: any) => e.type === NodeType.WebComponent && e.file
          );
          if (!hasCustomComponent) {
            for (const [k, v] of tags) {
              if (!v.lwc && v.namespace !== 'lightning') {
                tags.delete(k);
              } else if (!hasCustomWebComponent) {
                tags.delete(k);
              }
            }
          }
        }

        let namespaces: Map<string, LwcNode> = new Map();

        for (const key of tags.keys()) {
          // safety
          if (key) {
            const value = tags.get(key);
            if (value) {
              const ns = key.split(':')[0];

              const cmp = createComponent(value);

              let node = namespaces.get(ns);
              if (!node) {
                node = createNamespace(ns);
                namespaces.set(ns, node);
              }
              node.children.push(cmp);

              for (const attr of value.attributes) {
                cmp.children.push(createAttribute(attr, value.lwc));
              }
              const methods =
                (value.methods &&
                  value.methods.filter(m => m.decorator === 'api')) ||
                [];

              for (const method of methods) {
                cmp.children.push(
                  createMethod(method, value.location && value.location.uri)
                );
              }
            }
          }
        }

        namespaces = new Map(
          [...namespaces].sort((a, b) => (a[0] > b[0] ? 1 : -1))
        );

        if (namespaces.size === 0) {
          return new Map<string, LwcNode>([
            [
              'none',
              new LwcNode(
                'No components found',
                '',
                NodeType.Info,
                TreeItemCollapsibleState.None
              )
            ]
          ]);
        }
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

  constructor(
    public client: LanguageClient,
    public context: ExtensionContext,
    private workspaceType: WorkspaceType
  ) {
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
      commands.executeCommand('vscode.open', uri).then(() => {
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
    });
  }

  public async getChildren(node?: LwcNode): Promise<LwcNode[]> {
    if (node) {
      const sorted = node.children.sort((a, b) =>
        (a.label || '') < (b.label || '') ? -1 : 1
      );
      return Promise.resolve(sorted);
    } else {
      return [
        ...(await loadNamespaces(this.client, this.workspaceType)).values()
      ];
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
