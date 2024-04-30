/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See OSSREADME.json in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import { findFirst } from '../utils/arrays';
import { createScanner, TokenType } from './htmlScanner';
import { isEmptyElement } from './htmlTags';

export class Node {
  public tag: string;
  public closed: boolean;
  public endTagStart: number;
  public attributes: { [name: string]: string };
  public get attributeNames(): string[] {
    return Object.keys(this.attributes);
  }
  constructor(
    public start: number,
    public end: number,
    public children: Node[],
    public parent: Node
  ) {}
  public isSameTag(tagInLowerCase: string) {
    return (
      this.tag &&
      tagInLowerCase &&
      this.tag.length === tagInLowerCase.length &&
      this.tag.toLowerCase() === tagInLowerCase
    );
  }
  public get firstChild(): Node {
    return this.children[0];
  }
  public get lastChild(): Node {
    return this.children.length
      ? this.children[this.children.length - 1]
      : void 0;
  }

  public findNodeBefore(offset: number): Node {
    const idx = findFirst(this.children, c => offset <= c.start) - 1;
    if (idx >= 0) {
      const child = this.children[idx];
      if (offset > child.start) {
        if (offset < child.end) {
          return child.findNodeBefore(offset);
        }
        const lastChild = child.lastChild;
        if (lastChild && lastChild.end === child.end) {
          return child.findNodeBefore(offset);
        }
        return child;
      }
    }
    return this;
  }

  public findNodeAt(offset: number): Node {
    const idx = findFirst(this.children, c => offset <= c.start) - 1;
    if (idx >= 0) {
      const child = this.children[idx];
      if (offset > child.start && offset <= child.end) {
        return child.findNodeAt(offset);
      }
    }
    return this;
  }
}

export type HTMLDocument = {
  roots: Node[];
  findNodeBefore(offset: number): Node;
  findNodeAt(offset: number): Node;
};

export function parse(text: string): HTMLDocument {
  const scanner = createScanner(text);

  const htmlDocument = new Node(0, text.length, [], null);
  let curr = htmlDocument;
  let endTagStart = -1;
  let pendingAttribute: string = null;
  let token = scanner.scan();
  let attributes: { [name: string]: string };

  while (token !== TokenType.EOS) {
    switch (token) {
      case TokenType.StartTagOpen:
        const child = new Node(scanner.getTokenOffset(), text.length, [], curr);
        curr.children.push(child);
        curr = child;
        break;
      case TokenType.StartTag:
        curr.tag = scanner.getTokenText();
        break;
      case TokenType.StartTagClose:
        curr.end = scanner.getTokenEnd(); // might be later set to end tag position
        if (isEmptyElement(curr.tag) && curr !== htmlDocument) {
          curr.closed = true;
          curr = curr.parent;
        }
        break;
      case TokenType.EndTagOpen:
        endTagStart = scanner.getTokenOffset();
        break;
      case TokenType.EndTag:
        const closeTag = scanner.getTokenText().toLowerCase();
        while (!curr.isSameTag(closeTag) && curr !== htmlDocument) {
          curr.end = endTagStart;
          curr.closed = false;
          curr = curr.parent;
        }
        if (curr !== htmlDocument) {
          curr.closed = true;
          curr.endTagStart = endTagStart;
        }
        break;
      case TokenType.StartTagSelfClose:
        if (curr !== htmlDocument) {
          curr.closed = true;
          curr.end = scanner.getTokenEnd();
          curr = curr.parent;
        }
        break;
      case TokenType.EndTagClose:
        if (curr !== htmlDocument) {
          curr.end = scanner.getTokenEnd();
          curr = curr.parent;
        }
        break;
      case TokenType.AttributeName:
        pendingAttribute = scanner.getTokenText();
        attributes = curr.attributes;
        if (!attributes) {
          curr.attributes = attributes = {};
        }
        attributes[pendingAttribute] = null; // Support valueless attributes such as 'checked'
        break;
      case TokenType.AttributeValue:
        const value = scanner.getTokenText();
        if (attributes && pendingAttribute) {
          attributes[pendingAttribute] = value;
          pendingAttribute = null;
        }
        break;
    }
    token = scanner.scan();
  }
  while (curr !== htmlDocument) {
    curr.end = text.length;
    curr.closed = false;
    curr = curr.parent;
  }
  return {
    roots: htmlDocument.children,
    findNodeBefore: htmlDocument.findNodeBefore.bind(htmlDocument),
    findNodeAt: htmlDocument.findNodeAt.bind(htmlDocument)
  };
}
