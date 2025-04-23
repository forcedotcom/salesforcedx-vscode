/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See OSSREADME.json in the project root for license information.
 *--------------------------------------------------------------------------------------------*/
'use strict';

import { Node, parse } from '../../src/parser/htmlParser';

describe('HTML Parser', () => {
  const toJSON = (node: Node) => ({
    tag: node.tag,
    start: node.start,
    end: node.end,
    endTagStart: node.endTagStart,
    closed: node.closed,
    children: node.children.map(toJSON)
  });

  const assertDocument = (input: string, expected: any) => {
    const document = parse(input);
    expect(document.roots.map(toJSON)).toEqual(expected);
  };

  test('Simple', () => {
    assertDocument('<html></html>', [
      {
        tag: 'html',
        start: 0,
        end: 13,
        endTagStart: 6,
        closed: true,
        children: []
      }
    ]);
    assertDocument('<html><body></body></html>', [
      {
        tag: 'html',
        start: 0,
        end: 26,
        endTagStart: 19,
        closed: true,
        children: [
          {
            tag: 'body',
            start: 6,
            end: 19,
            endTagStart: 12,
            closed: true,
            children: []
          }
        ]
      }
    ]);
    assertDocument('<html><head></head><body></body></html>', [
      {
        tag: 'html',
        start: 0,
        end: 39,
        endTagStart: 32,
        closed: true,
        children: [
          {
            tag: 'head',
            start: 6,
            end: 19,
            endTagStart: 12,
            closed: true,
            children: []
          },
          {
            tag: 'body',
            start: 19,
            end: 32,
            endTagStart: 25,
            closed: true,
            children: []
          }
        ]
      }
    ]);
  });

  test('SelfClose', () => {
    assertDocument('<br/>', [
      {
        tag: 'br',
        start: 0,
        end: 5,
        endTagStart: undefined,
        closed: true,
        children: []
      }
    ]);
    assertDocument('<div><br/><span></span></div>', [
      {
        tag: 'div',
        start: 0,
        end: 29,
        endTagStart: 23,
        closed: true,
        children: [
          {
            tag: 'br',
            start: 5,
            end: 10,
            endTagStart: undefined,
            closed: true,
            children: []
          },
          {
            tag: 'span',
            start: 10,
            end: 23,
            endTagStart: 16,
            closed: true,
            children: []
          }
        ]
      }
    ]);
  });

  test('EmptyTag', () => {
    assertDocument('<meta>', [
      {
        tag: 'meta',
        start: 0,
        end: 6,
        endTagStart: undefined,
        closed: true,
        children: []
      }
    ]);
  });

  test('MissingTags', () => {
    assertDocument('</meta>', []);
    assertDocument('<div></div></div>', [
      {
        tag: 'div',
        start: 0,
        end: 11,
        endTagStart: 5,
        closed: true,
        children: []
      }
    ]);
  });
});
