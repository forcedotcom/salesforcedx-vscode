/*
 * Copyright (c) 2019, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */

import { LocalComponent } from '@salesforce/salesforcedx-utils-vscode';

/**
 * Provides information for force.source.retrieve.component execution
 */
export interface RetrieveDescriber {
  /**
   * Builds the force:source:retrieve metadata argument
   * @param data optional data to use while building the argument
   * @returns parameter for metadata argument (-m)
   */
  buildMetadataArg(data?: LocalComponent[]): string;

  /**
   * Gather list of components to be retrieved
   * @returns local representations of components
   */
  gatherOutputLocations(): Promise<LocalComponent[]>;
}
