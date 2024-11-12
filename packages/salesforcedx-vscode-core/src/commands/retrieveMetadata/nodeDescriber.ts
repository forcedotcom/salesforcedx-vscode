/*
 * Copyright (c) 2019, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */
import { LocalComponent } from '@salesforce/salesforcedx-utils-vscode';
import { join } from 'path';
import { BrowserNode } from '../../orgBrowser';
import { SalesforcePackageDirectories } from '../../salesforceProject';
import { RetrieveDescriber } from '.';

export abstract class NodeDescriber implements RetrieveDescriber {
  protected node: BrowserNode;

  constructor(node: BrowserNode) {
    this.node = node;
  }

  public abstract buildMetadataArg(): string;

  public abstract gatherOutputLocations(): Promise<LocalComponent[]>;

  protected async buildOutput(node: BrowserNode): Promise<LocalComponent[]> {
    const typeNode = node.getAssociatedTypeNode();
    // TODO: Only create one cmp when cli bug (W-6558000) fixed
    const packageDirectories = await SalesforcePackageDirectories.getPackageDirectoryPaths();
    return packageDirectories.map(directory => ({
      fileName: node.fullName,
      outputdir: join(directory, 'main', 'default', typeNode.directoryName!),
      type: typeNode.fullName,
      suffix: typeNode.suffix
    }));
  }
}
