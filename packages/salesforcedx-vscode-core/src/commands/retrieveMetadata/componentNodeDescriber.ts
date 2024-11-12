/*
 * Copyright (c) 2019, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */
import { LocalComponent } from '@salesforce/salesforcedx-utils-vscode';
import { NodeDescriber } from './nodeDescriber';

export class ComponentNodeDescriber extends NodeDescriber {
  public buildMetadataArg(): string {
    return `${this.node.getAssociatedTypeNode().fullName}:${this.node.fullName}`;
  }

  public gatherOutputLocations(): Promise<LocalComponent[]> {
    return Promise.resolve(this.buildOutput(this.node));
  }
}
