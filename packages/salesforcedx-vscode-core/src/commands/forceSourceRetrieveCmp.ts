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
import { DirFileNameSelection } from '@salesforce/salesforcedx-utils-vscode/out/src/types';
import { join } from 'path';
import { nls } from '../messages';
import { BrowserNode, NodeType } from '../orgBrowser';
import { TelemetryData } from '../telemetry';
import {
  SfdxCommandlet,
  SfdxCommandletExecutor,
  SfdxWorkspaceChecker
} from './commands';
import {
  AURA_DEFINITION_FILE_EXTS,
  LWC_DEFINITION_FILE_EXTS
} from './templates/metadataTypeConstants';
import { FilePathExistsChecker, GlobStrategyFactory } from './util';
import { SimpleGatherer } from './util';

export class ForceSourceRetrieveExecutor extends SfdxCommandletExecutor<
  DirFileNameSelection
> {
  private typeName: string;
  private componentName: string;

  constructor(typeName: string, componentName: string) {
    super();
    this.typeName = typeName;
    this.componentName = componentName;
  }

  public build(): Command {
    return new SfdxCommandBuilder()
      .withDescription(nls.localize('force_source_retrieve_text'))
      .withArg('force:source:retrieve')
      .withFlag('-m', `${this.typeName}:${this.componentName}`)
      .withLogName('force_source_retrieve')
      .build();
  }

  protected getTelemetryData(): TelemetryData {
    // needs to be updated when implementing support for multiple components/types
    const retrievedTypes: any = [{ type: this.typeName, quantity: 1 }];
    return {
      properties: {
        metadataCount: JSON.stringify(retrievedTypes)
      }
    };
  }
}

const BUNDLE_TYPES = new Set([
  'AuraDefinitionBundle',
  'LightningComponentBundle',
  'WaveTemplateBundle',
  'ExperienceBundle',
  'CustomObject'
]);

export function generateSuffix(
  typeNode: BrowserNode,
  typeName: string
): string[] {
  let suffixes: string[];
  switch (typeName) {
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

export async function forceSourceRetrieveCmp(componentNode: BrowserNode) {
  const typeNode =
    componentNode.parent!.type === NodeType.Folder
      ? componentNode.parent!.parent!
      : componentNode.parent!;
  const typeName = typeNode.fullName;
  const dirName = typeNode.directoryName!;
  const componentName = componentNode.fullName;
  const label =
    componentNode.parent!.type === NodeType.Folder
      ? componentName.substr(componentName.indexOf('/') + 1)
      : componentName;
  const fileExts = generateSuffix(typeNode, typeName);

  const globStrategy = BUNDLE_TYPES.has(typeName)
    ? GlobStrategyFactory.createCheckBundleInAllPackages(...fileExts)
    : GlobStrategyFactory.createCheckFileInAllPackages(...fileExts);

  const commandlet = new SfdxCommandlet(
    new SfdxWorkspaceChecker(),
    new SimpleGatherer<DirFileNameSelection>({
      outputdir: join('main', 'default', dirName),
      fileName: componentName
    }),
    new ForceSourceRetrieveExecutor(typeName, componentName),
    new FilePathExistsChecker(
      globStrategy,
      nls.localize('warning_prompt_cmp_file_overwrite', label)
    )
  );
  await commandlet.run();
}
