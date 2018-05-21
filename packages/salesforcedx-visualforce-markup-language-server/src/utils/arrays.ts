/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See OSSREADME.json in the project root for license information.
 *--------------------------------------------------------------------------------------------*/
'use strict';

/**
 * Takes a sorted array and a function p. The array is sorted in such a way that all elements where p(x) is false
 * are located before all elements where p(x) is true.
 * @returns the least x for which p(x) is true or array.length if no element fullfills the given function.
 */
export function findFirst<T>(array: T[], p: (x: T) => boolean): number {
  let low = 0;
  let high = array.length;
  if (high === 0) {
    return 0; // no children
  }
  while (low < high) {
    const mid = Math.floor((low + high) / 2);
    if (p(array[mid])) {
      high = mid;
    } else {
      low = mid + 1;
    }
  }
  return low;
}

export function binarySearch<T>(
  array: T[],
  key: T,
  comparator: (op1: T, op2: T) => number
): number {
  let low = 0;
  let high = array.length - 1;

  while (low <= high) {
    // tslint:disable-next-line:no-bitwise
    const mid = ((low + high) / 2) | 0;
    const comp = comparator(array[mid], key);
    if (comp < 0) {
      low = mid + 1;
    } else if (comp > 0) {
      high = mid - 1;
    } else {
      return mid;
    }
  }
  return -(low + 1);
}
