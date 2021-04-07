/*
 * Copyright (c) 2020, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */
import { getRelativeProjectPath } from '@salesforce/salesforcedx-utils-vscode/out/src';
import { MetadataComponent } from '@salesforce/source-deploy-retrieve';
import { SfdxPackageDirectories } from '../../sfdxProject';

/**
 * Reformats errors thrown by beta deploy/retrieve logic.
 *
 * @param e Error to reformat
 * @returns A newly formatted error
 */
export async function formatException(e: Error): Promise<Error> {
  const formattedException = new Error('Unknown Exception');
  formattedException.name = e.name;

  if (e.name === 'TypeInferenceError') {
    const projectPath = getRelativeProjectPath(
      e.message.slice(0, e.message.lastIndexOf(':')),
      await SfdxPackageDirectories.getPackageDirectoryPaths()
    );
    formattedException.message = `${projectPath}: Could not infer metadata type`;
  }

  return formattedException;
}

export function createComponentCount(components: Iterable<MetadataComponent>) {
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
