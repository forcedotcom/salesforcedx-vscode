/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See OSSREADME.json in the project root for license information.
 *--------------------------------------------------------------------------------------------*/
'use strict';

export const pushAll = <T>(to: T[], from: T[]) => {
  if (from) {
    to.push(...from);
  }
};
