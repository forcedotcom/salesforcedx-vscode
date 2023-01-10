/*
 * Copyright (c) 2020, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */
import { getRootWorkspacePath } from '@salesforce/salesforcedx-utils-vscode';
import { MetadataComponent } from '@salesforce/source-deploy-retrieve';
/**
 * Reformats errors thrown by beta deploy/retrieve logic.
 *
 * @param e Error to reformat
 * @returns A newly formatted error
 */
export function formatException(e: Error): Error {
  e.message = e.message.replace(getRootWorkspacePath(), '');
  return e;
}

export function createComponentCount(components: Iterable<MetadataComponent>) {
  console.log('components: ' + components);
  // tslint:disable-next-line:no-debugger
  debugger;
  const quantities: { [type: string]: number } = {};
  for (const component of components) {
    const { name: typeName } = component.type;
    const typeCount = quantities[typeName];
    quantities[typeName] = typeCount ? typeCount + 1 : 1;
  }
  return Object.keys(quantities).map(type => ({
    type,
    quantity: quantities[type]
  }));
}
