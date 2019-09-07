/*
 * Copyright (c) 2019, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */
import { DirFileNameSelection } from '@salesforce/salesforcedx-utils-vscode/out/src/types';
export { RetrieveDescriberFactory } from './describers';
export { forceSourceRetrieveCmp } from './forceSourceRetrieveCmp';

/**
 * Provides information for force.source.retrieve.component execution
 */
export interface RetrieveDescriber {
  /**
   * Reducer for building the force:source:retrieve metadata argument
   * @returns parameter for metadata argument (-m)
   */
  buildMetadataArg(): string;

  /**
   * Gather list of file output locations
   */
  gatherOutputLocations(): DirFileNameSelection[];
}

/**
 * An object capable of triggering the force:source:retrieve metadata command
 */
export interface RetrieveMetadataTrigger {
  /**
   * The RetrieveDescriber to use for the retrieve execution
   */
  describer(): RetrieveDescriber;
}

export type SelectionAndType = DirFileNameSelection & { type: string };
