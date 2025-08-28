/*
 * Copyright (c) 2025, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */
import type { MetadataMember } from '@salesforce/source-deploy-retrieve';
import { Effect, Layer, pipe } from 'effect';
import * as vscode from 'vscode';
import { ExtensionProviderServiceLive } from '../services/extensionProvider';
import { MetadataRetrieveService, MetadataRetrieveServiceLive } from '../services/metadataRetrieveService';
import { OrgBrowserNode } from '../tree/orgBrowserNode';

export const retrieveOrgBrowserNode = async (node: OrgBrowserNode): Promise<void> => {
  const target = getRetrieveTarget(node);
  if (!target) return;

  const retrieveEffect = pipe(
    Effect.flatMap(MetadataRetrieveService, svc => svc.retrieve([target], node.kind === 'component')),
    Effect.catchAll(error =>
      Effect.sync(() => {
        vscode.window.showErrorMessage(`Retrieve failed: ${error.message}`);
      })
    )
  );

  await Effect.runPromise(
    Effect.provide(retrieveEffect, Layer.mergeAll(MetadataRetrieveServiceLive, ExtensionProviderServiceLive))
  );
};

const getRetrieveTarget = (node: OrgBrowserNode): MetadataMember | undefined => {
  if (node.kind === 'folderType') {
    // folderType nodes don't have retrieve functionality
    return undefined;
  }
  if (node.kind === 'type') {
    // called retrieve on the entire type
    return { type: node.xmlName, fullName: '*' };
  }

  if (node.kind === 'component' && node.componentName !== undefined) {
    return { type: node.xmlName, fullName: node.componentName };
  }
};
