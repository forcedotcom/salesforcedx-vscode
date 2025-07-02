/*
 * Copyright (c) 2019, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */
import { LocalComponent } from '@salesforce/salesforcedx-utils-vscode';
import { orgBrowser } from '../../orgBrowser';
import { NodeDescriber } from './nodeDescriber';

export class TypeNodeDescriber extends NodeDescriber {
  public buildMetadataArg(data?: LocalComponent[]): string {
    if (data) {
      const dedupe = new Set<string>(data.map(c => `${c.type}:${c.fileName}`)); // filter dupes caused by cli bug. See buildOutput in parent class
      if (dedupe.size < this.node.children!.length) {
        return Array.from(dedupe).join(',');
      }
    }
    return this.node.fullName;
  }

  public async gatherOutputLocations(): Promise<LocalComponent[]> {
    await orgBrowser.refreshAndExpand(this.node);
    return (await Promise.all(this.node.children!.map(async child => this.buildOutput(child)))).flat();
  }
}
