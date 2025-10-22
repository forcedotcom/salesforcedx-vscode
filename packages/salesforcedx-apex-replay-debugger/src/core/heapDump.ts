/*
 * Copyright (c) 2018, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */
import { ApexExecutionOverlayResultCommandSuccess } from '../commands';

export type ApexHeapDump = {
  className: string;
  namespace: string;
  line: number;
  heapDumpId: string;
  overlaySuccessResult?: ApexExecutionOverlayResultCommandSuccess;
};

export const stringifyHeapDump = (heapDump: ApexHeapDump): string =>
  `HeapDumpId: ${heapDump.heapDumpId}, ClassName: ${heapDump.className}, Namespace: ${heapDump.namespace}, Line: ${heapDump.line}`;
