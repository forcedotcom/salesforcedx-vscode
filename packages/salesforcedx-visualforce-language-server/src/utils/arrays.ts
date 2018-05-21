/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See OSSREADME.json in the project root for license information.
 *--------------------------------------------------------------------------------------------*/
'use strict';

export function pushAll<T>(to: T[], from: T[]) {
  if (from) {
    // tslint:disable-next-line:prefer-for-of
    for (let i = 0; i < from.length; i++) {
      to.push(from[i]);
    }
  }
}
