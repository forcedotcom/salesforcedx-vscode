/*
 * Copyright (c) 2025, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */

import type { ValueNode } from '@humanwhocodes/momoa';

/**
 * Traverses a JSON AST to find nodes at a given path. Supports wildcards (*) for both arrays and objects.
 */
export const findNodeAtPath = (node: ValueNode, pathSegments: string[]): ValueNode[] => {
  if (pathSegments.length === 0) {
    return [node];
  }

  const [key, ...rest] = pathSegments;

  if (node.type === 'Object') {
    // Wildcard matches all object member values
    if (key === '*') {
      return node.members.flatMap(m => findNodeAtPath(m.value, rest));
    }
    const member = node.members.find(m => m.name.type === 'String' && m.name.value === key);
    return member ? findNodeAtPath(member.value, rest) : [];
  }

  if (node.type === 'Array' && key === '*') {
    return node.elements.flatMap(el => findNodeAtPath(el.value, rest));
  }

  if (node.type === 'Array' && /^\d+$/.test(key)) {
    const element = node.elements[parseInt(key, 10)];
    return element ? findNodeAtPath(element.value, rest) : [];
  }

  return [];
};
