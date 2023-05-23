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
      const dedupe = new Set<string>(); // filter dupes caused by cli bug. See buildOutput in parent class
      data.forEach(c => dedupe.add(`${c.type}:${c.fileName}`));
      if (dedupe.size < this.node.children!.length) {
        return Array.from(dedupe).reduce((acc, current, index) => {
          acc += current;
          if (index < dedupe.size - 1) {
            acc += ',';
          }
          return acc;
        }, '');
      }
    }
    return this.node.fullName;
  }

  public async gatherOutputLocations(): Promise<LocalComponent[]> {
    await orgBrowser.refreshAndExpand(this.node);
    const components = [];
    for (const child of this.node.children!) {
      components.push(...(await this.buildOutput(child)));
    }
    return components;
  }
}
