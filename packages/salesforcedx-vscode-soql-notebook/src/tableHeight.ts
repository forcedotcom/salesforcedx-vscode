/*
 * Copyright (c) 2026, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */

export const TABLE_MAX_HEIGHT_PX = 280;

export const measuredTableHeight = ({
  headerHeight,
  rowsHeight,
  footerHeight,
  maxHeight = TABLE_MAX_HEIGHT_PX
}: {
  headerHeight: number;
  rowsHeight: number;
  footerHeight: number;
  maxHeight?: number;
}): number => Math.min(Math.max(headerHeight, 0) + Math.max(rowsHeight, 0) + Math.max(footerHeight, 0), maxHeight);
