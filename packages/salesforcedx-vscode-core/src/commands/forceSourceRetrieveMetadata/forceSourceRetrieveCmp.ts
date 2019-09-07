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
  CancelResponse,
  ContinueResponse,
  DirFileNameSelection,
  ParametersGatherer
} from '@salesforce/salesforcedx-utils-vscode/out/src/types';
import {
  RetrieveDescriber,
  RetrieveMetadataTrigger,
  SelectionAndType
} from '.';
import { nls } from '../../messages';
import { BrowserNode } from '../../orgBrowser';
import { TelemetryData } from '../../telemetry';
import {
  SfdxCommandlet,
  SfdxCommandletExecutor,
  SfdxWorkspaceChecker
} from '../commands';
import {
  AURA_DEFINITION_FILE_EXTS,
  LWC_DEFINITION_FILE_EXTS
} from '../templates/metadataTypeConstants';
import { FilePathExistsChecker, GlobStrategyFactory } from '../util';
import { RetrieveComponentOutputGatherer } from '../util/parameterGatherers';

const BUNDLE_TYPES = new Set([
  'AuraDefinitionBundle',
  'CustomObject',
  'ExperienceBundle',
  'LightningComponentBundle',
  'WaveTemplateBundle'
]);

export class ForceSourceRetrieveExecutor extends SfdxCommandletExecutor<
  SelectionAndType[]
> {
  private describer: RetrieveDescriber;

  constructor(describer: RetrieveDescriber) {
    super();
    this.describer = describer;
  }

  public build(): Command {
    return new SfdxCommandBuilder()
      .withDescription(nls.localize('force_source_retrieve_text'))
      .withLogName('force_source_retrieve')
      .withArg('force:source:retrieve')
      .withArg('-m')
      .withArg(this.describer.buildMetadataArg())
      .build();
  }

  protected getTelemetryData(
    success: boolean,
    response: ContinueResponse<SelectionAndType[]>
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

  private getNumberOfRetrievedTypes(data: SelectionAndType[]): any {
    const quantities: { [key: string]: number } = {};
    data.forEach(selection => {
      quantities[selection.type] = quantities[selection.type]
        ? quantities[selection.type] + 1
        : 1;
    });
    return quantities;
  }
}

export async function forceSourceRetrieveCmp(trigger: RetrieveMetadataTrigger) {
  const typeNode = ((trigger as unknown) as BrowserNode).getAssociatedTypeNode();
  const fileExts = generateSuffix(typeNode);
  const globStrategy = BUNDLE_TYPES.has(typeNode.fullName)
    ? GlobStrategyFactory.createCheckBundleInAllPackages(...fileExts)
    : GlobStrategyFactory.createCheckFileInAllPackages(...fileExts);
  const retrieveDescriber = trigger.describer();

  const commandlet = new SfdxCommandlet(
    new SfdxWorkspaceChecker(),
    new RetrieveComponentOutputGatherer(retrieveDescriber),
    new ForceSourceRetrieveExecutor(retrieveDescriber),
    new FilePathExistsChecker(
      globStrategy,
      nls.localize('warning_prompt_cmp_file_overwrite', 'somethin')
    )
  );
  await commandlet.run();
}

export function generateSuffix(typeNode: BrowserNode): string[] {
  let suffixes: string[];
  switch (typeNode.fullName) {
    case 'LightningComponentBundle':
      suffixes = LWC_DEFINITION_FILE_EXTS;
      break;
    case 'AuraDefinitionBundle':
      suffixes = AURA_DEFINITION_FILE_EXTS;
      break;
    default:
      suffixes = [`.${typeNode.suffix!}`];
  }
  return suffixes.map(suffix => `${suffix!}-meta.xml`);
}
