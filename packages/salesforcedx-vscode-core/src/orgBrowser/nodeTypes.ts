/*
 * Copyright (c) 2019, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */
import * as vscode from 'vscode';
import { RetrieveDescriber, RetrieveDescriberFactory, RetrieveMetadataTrigger } from '../commands/retrieveMetadata';
import { nls } from '../messages';
import { MetadataObject } from './metadataType';

export enum NodeType {
  Org = 'org',
  MetadataType = 'type',
  MetadataComponent = 'component',
  MetadataField = 'field',
  EmptyNode = 'empty',
  Folder = 'folder'
}

export class BrowserNode extends vscode.TreeItem implements RetrieveMetadataTrigger {
  public toRefresh: boolean = false;
  public readonly fullName: string;
  public suffix?: string;
  public directoryName?: string;
  public metadataObject?: MetadataObject;
  private _children: BrowserNode[] | undefined;
  private _parent: BrowserNode | undefined;

  constructor(
    label: string,
    public readonly type: NodeType,
    fullName?: string,
    metadataObject?: MetadataObject
  ) {
    super(label);
    this.type = type;
    this.contextValue = type;
    this.fullName = fullName || label;
    this.metadataObject = metadataObject;
    switch (this.type) {
      case NodeType.Org:
        this.collapsibleState = vscode.TreeItemCollapsibleState.Expanded;
        break;
      case NodeType.MetadataComponent:
      case NodeType.MetadataField:
        this.collapsibleState = vscode.TreeItemCollapsibleState.None;
        this.iconPath = vscode.ThemeIcon.File;
        break;
      case NodeType.MetadataType:
        this.collapsibleState = vscode.TreeItemCollapsibleState.Collapsed;
        this.suffix = this.metadataObject!.suffix;
        this.directoryName = this.metadataObject!.directoryName;
        break;
      case NodeType.Folder:
        this.collapsibleState = vscode.TreeItemCollapsibleState.Collapsed;
        this.iconPath = vscode.ThemeIcon.Folder;
        break;
      case NodeType.EmptyNode:
        this.collapsibleState = vscode.TreeItemCollapsibleState.None;
        break;
    }
  }

  public setComponents(fullNames: string[], type: NodeType) {
    this._children = [];
    if (fullNames.length === 0) {
      this._children.push(new BrowserNode(nls.localize('empty_components'), NodeType.EmptyNode));
    }

    fullNames.forEach(fullName => {
      const regex = /^([a-zA-Z0-9]+)__([a-zA-Z0-9]+)__c$/;
      const hasNamespacePrefix = regex.test(fullName);
      const label =
        this.type === NodeType.Folder
          ? fullName.substring(fullName.indexOf('/') + 1)
          : hasNamespacePrefix
            ? fullName.substring(fullName.indexOf('_') + 2)
            : fullName;
      const child = new BrowserNode(label, type, fullName);
      child._parent = this;
      this._children!.push(child);
    });
  }

  public setTypes(metadataObjects: MetadataObject[], type: NodeType) {
    this._children = [];
    if (metadataObjects.length === 0) {
      this._children.push(new BrowserNode(nls.localize('empty_components'), NodeType.EmptyNode));
    }
    metadataObjects.forEach(metadataObject => {
      const child = new BrowserNode(metadataObject.label, type, metadataObject.xmlName, metadataObject);
      child._parent = this;
      this._children!.push(child);
    });
  }

  get parent() {
    return this._parent;
  }

  get children() {
    return this._children;
  }

  public getAssociatedTypeNode(): BrowserNode {
    const parent = this.parent;
    if (parent) {
      switch (parent.type) {
        case NodeType.Folder:
          return parent.parent!;
        case NodeType.MetadataType:
          return parent;
        case NodeType.Org:
          return this;
      }
    }
    throw new Error(`Node of type ${this.type} does not have a parent metadata type node`);
  }

  public describer(): RetrieveDescriber {
    switch (this.type) {
      case NodeType.MetadataType:
        return RetrieveDescriberFactory.createTypeNodeDescriber(this);
      case NodeType.Folder:
      case NodeType.MetadataComponent:
        return RetrieveDescriberFactory.createComponentNodeDescriber(this);
    }
    throw new Error(`Org Browser node type '${this.type}' does not support metadata retrieve`);
  }
}
