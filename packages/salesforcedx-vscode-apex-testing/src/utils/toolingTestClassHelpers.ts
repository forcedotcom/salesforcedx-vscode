/*
 * Copyright (c) 2026, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */

import type { ToolingTestClass } from '../testDiscovery/schemas';
import * as Option from 'effect/Option';

/**
 * Builds a full class name from a ToolingTestClass, including namespace prefix if present
 */
export const getFullClassName = (cls: ToolingTestClass): string =>
  Option.match(cls.namespacePrefix, { onNone: () => cls.name, onSome: ns => `${ns}.${cls.name}` });

/**
 * Checks if a ToolingTestClass is a Flow test (Flow tests have namespacePrefix starting with 'FlowTesting')
 */
export const isFlowTest = (cls: ToolingTestClass): boolean =>
  Option.exists(cls.namespacePrefix, ns => ns.startsWith('FlowTesting'));
