/*
 *  Copyright (c) 2026, salesforce.com, inc.
 *  All rights reserved.
 *  Licensed under the BSD 3-Clause license.
 *  For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 *
 */

import { LightningElement, api, track } from 'lwc';
import { messages } from 'querybuilder/messages';

export type TreeNode = {
  id: string;
  label: string;
  type: 'root' | 'parentRel' | 'childSubquery' | 'field';
  depth: number;
  isExpanded: boolean;
  isSelected: boolean;
  isChecked?: boolean;
  hasContent?: boolean;
  contextPath: string[];
  relPath?: string[];
  isLoading?: boolean;
  hasChildren: boolean;
};

export default class SchemaTree extends LightningElement {
  @api public visibleNodes: TreeNode[] = [];
  @api public activeContextPath: string[] = [];

  @track private focusedIndex = 0;

  public get i18n() {
    return messages;
  }

  public get nodes(): Array<TreeNode & { cssClass: string; indent: string; showChevron: boolean; showCheckbox: boolean }> {
    return this.visibleNodes.map((node, index) => ({
      ...node,
      cssClass: this.nodeClass(node, index),
      indent: `padding-left: ${node.depth * 16 + 4}px`,
      showChevron: node.hasChildren,
      showCheckbox: node.type === 'field'
    }));
  }

  private nodeClass(node: TreeNode, index: number): string {
    const classes = ['tree-node'];
    if (node.isSelected) classes.push('tree-node--selected');
    if (node.hasContent) classes.push('tree-node--has-content');
    if (index === this.focusedIndex) classes.push('tree-node--focused');
    return classes.join(' ');
  }

  private pathsEqual(a: string[], b: string[]): boolean {
    return a.length === b.length && a.every((v, i) => v === b[i]);
  }

  public handleNodeClick(e: Event): void {
    const target = e.currentTarget as HTMLElement;
    const nodeId = target.dataset.nodeId;
    const node = this.visibleNodes.find(n => n.id === nodeId);
    if (!node) return;

    this.focusedIndex = this.visibleNodes.indexOf(node);

    this.dispatchEvent(new CustomEvent('tree__nodeselect', {
      detail: { contextPath: node.contextPath, relPath: node.relPath || [] }
    }));
  }

  public handleCheckboxClick(e: Event): void {
    e.stopPropagation();
    const target = e.currentTarget as HTMLInputElement;
    const nodeId = target.dataset.nodeId;
    const node = this.visibleNodes.find(n => n.id === nodeId);
    if (!node) return;

    this.dispatchEvent(new CustomEvent('tree__fieldtoggle', {
      detail: { contextPath: node.contextPath, field: node.label, checked: target.checked }
    }));
  }

  public handleChevronClick(e: Event): void {
    e.stopPropagation();
    const target = e.currentTarget as HTMLElement;
    const nodeId = target.dataset.nodeId;
    const node = this.visibleNodes.find(n => n.id === nodeId);
    if (!node) return;

    this.dispatchEvent(new CustomEvent('tree__nodeexpand', {
      detail: { nodeId: node.id, contextPath: node.contextPath, expanded: !node.isExpanded }
    }));
  }

  public handleKeyDown(e: KeyboardEvent): void {
    const { key } = e;
    if (key === 'ArrowDown') {
      e.preventDefault();
      this.focusedIndex = Math.min(this.focusedIndex + 1, this.visibleNodes.length - 1);
    } else if (key === 'ArrowUp') {
      e.preventDefault();
      this.focusedIndex = Math.max(this.focusedIndex - 1, 0);
    } else if (key === 'ArrowRight') {
      e.preventDefault();
      const node = this.visibleNodes[this.focusedIndex];
      if (node?.hasChildren && !node.isExpanded) {
        this.dispatchEvent(new CustomEvent('tree__nodeexpand', {
          detail: { nodeId: node.id, contextPath: node.contextPath, expanded: true }
        }));
      }
    } else if (key === 'ArrowLeft') {
      e.preventDefault();
      const node = this.visibleNodes[this.focusedIndex];
      if (node?.hasChildren && node.isExpanded) {
        this.dispatchEvent(new CustomEvent('tree__nodeexpand', {
          detail: { nodeId: node.id, contextPath: node.contextPath, expanded: false }
        }));
      }
    } else if (key === 'Enter' || key === ' ') {
      e.preventDefault();
      const node = this.visibleNodes[this.focusedIndex];
      if (!node) return;
      if (node.type === 'field') {
        this.dispatchEvent(new CustomEvent('tree__fieldtoggle', {
          detail: { contextPath: node.contextPath, field: node.label, checked: !node.isChecked }
        }));
      } else {
        if (node.type === 'root' || node.type === 'childSubquery') {
          this.dispatchEvent(new CustomEvent('tree__nodeselect', {
            detail: { contextPath: node.contextPath }
          }));
        }
        if (node.hasChildren) {
          this.dispatchEvent(new CustomEvent('tree__nodeexpand', {
            detail: { nodeId: node.id, contextPath: node.contextPath, expanded: !node.isExpanded }
          }));
        }
      }
    }
  }
}
