/*
 * Copyright (c) 2019, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */
import {
  Command,
  SfdxCommandBuilder
} from '@salesforce/salesforcedx-utils-vscode/out/src/cli';
import {
  ContinueResponse,
  LocalComponent
} from '@salesforce/salesforcedx-utils-vscode/out/src/types';
import { RetrieveDescriber, RetrieveMetadataTrigger } from '.';
import { nls } from '../../messages';
import { TelemetryData } from '../../telemetry';
import {
  SfdxCommandlet,
  SfdxCommandletExecutor,
  SfdxWorkspaceChecker
} from '../commands';
import { RetrieveComponentOutputGatherer } from '../util/parameterGatherers';
import { OverwriteComponentPrompt } from '../util/postconditionCheckers';

export class ForceSourceRetrieveExecutor extends SfdxCommandletExecutor<
  LocalComponent[]
> {
  private describer: RetrieveDescriber;

  constructor(describer: RetrieveDescriber) {
    super();
    this.describer = describer;
  }

  public build(data?: LocalComponent[]): Command {
    return new SfdxCommandBuilder()
      .withDescription(nls.localize('force_source_retrieve_text'))
      .withLogName('force_source_retrieve')
      .withArg('force:source:retrieve')
      .withArg('-m')
      .withArg(this.describer.buildMetadataArg(data))
      .build();
  }

  protected getTelemetryData(
    success: boolean,
    response: ContinueResponse<LocalComponent[]>
  ): TelemetryData {
    const quantities = this.getNumberOfRetrievedTypes(response.data);
    const rows = Object.keys(quantities).map(type => {
      return { type, quantity: quantities[type] };
    });
    return {
      properties: {
        metadataCount: JSON.stringify(rows)
      }
    };
  }

  private getNumberOfRetrievedTypes(data: LocalComponent[]): any {
    const quantities: { [key: string]: number } = {};
    data.forEach(selection => {
      const current = quantities[selection.type];
      quantities[selection.type] = current ? current + 1 : 1;
    });
    return quantities;
  }
}

export async function forceSourceRetrieveCmp(trigger: RetrieveMetadataTrigger) {
  const retrieveDescriber = trigger.describer();
  const commandlet = new SfdxCommandlet(
    new SfdxWorkspaceChecker(),
    new RetrieveComponentOutputGatherer(retrieveDescriber),
    new ForceSourceRetrieveExecutor(retrieveDescriber),
    new OverwriteComponentPrompt()
  );
  await commandlet.run();
}
