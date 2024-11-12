/*
 * Copyright (c) 2020, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */
import * as vscode from 'vscode';
import { ConflictFile, ConflictGroupNode, ConflictNode } from './conflictNode';

export class ConflictOutlineProvider implements vscode.TreeDataProvider<ConflictNode> {
  private root: ConflictGroupNode | null;
  private emptyLabel?: string;

  private internalOnDidChangeTreeData: vscode.EventEmitter<ConflictNode | undefined> = new vscode.EventEmitter<
    ConflictNode | undefined
  >();
  public readonly onDidChangeTreeData: vscode.Event<ConflictNode | undefined> = this.internalOnDidChangeTreeData.event;

  public constructor() {
    this.root = null;
  }

  public onViewChange() {
    this.internalOnDidChangeTreeData.fire(undefined);
  }

  public async refresh(node?: ConflictNode): Promise<void> {
    this.internalOnDidChangeTreeData.fire(node);
  }

  public reset(rootLabel: string, conflicts: ConflictFile[], emptyLabel?: string) {
    this.emptyLabel = emptyLabel;
    this.root = this.createConflictRoot(rootLabel, conflicts);
  }

  public getRevealNode(): ConflictNode | null {
    return this.root;
  }

  public getTreeItem(element: ConflictNode): vscode.TreeItem {
    if (element) {
      return element as vscode.TreeItem;
    }
    if (this.root) {
      return this.root as vscode.TreeItem;
    }
    return { label: 'EMPTY' };
  }

  public getChildren(element?: ConflictNode): ConflictNode[] {
    if (element) {
      return element.children;
    }
    if (this.root) {
      return [this.root];
    }
    return [];
  }

  public getParent(element: ConflictNode) {
    return element.parent;
  }

  private createConflictRoot(rootLabel: string, conflicts: ConflictFile[]): ConflictGroupNode {
    const orgRoot = new ConflictGroupNode(rootLabel, this.emptyLabel);
    orgRoot.id = 'ROOT-NODE';
    orgRoot.addChildren(conflicts);
    return orgRoot;
  }
}
