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
  WithType[]
> {
  public build(data: WithType[]): Command {
    const builder = new SfdxCommandBuilder()
      .withDescription(nls.localize('force_source_retrieve_text'))
      .withLogName('force_source_retrieve')
      .withArg('force:source:retrieve')
      .withArg('-m');

    const arg = data.reduce((acc, current, index) => {
      let a = acc + `${current.type}:${current.fileName}`;
      if (index < data.length - 1) {
        a += ',';
      }
      return a;
    }, '');
    builder.withArg(arg);

    return builder.build();
  }

  // protected getTelemetryData(
  //   success: boolean,
  //   response: ContinueResponse<WithType[]>
  // ): TelemetryData {
  //   const retrievedTypes: any = {};
  //   retrievedTypes[this.typeName] = 1;
  //   return {
  //     properties: {
  //       'org-browser/retrievedTypes': JSON.stringify(retrievedTypes)
  //     }
  //   };
  // }
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

export async function forceSourceRetrieveCmp(node: BrowserNode) {
  const typeNode = getTypeNode(node);
  const typeName = typeNode.fullName;
  const componentName = node.fullName;
  const label =
    node.parent!.type === NodeType.Folder
      ? componentName.substr(componentName.indexOf('/') + 1)
      : componentName;
  const fileExts = generateSuffix(typeNode, typeName);

  const globStrategy = BUNDLE_TYPES.has(typeName)
    ? GlobStrategyFactory.createCheckBundleInAllPackages(...fileExts)
    : GlobStrategyFactory.createCheckFileInAllPackages(...fileExts);

  const commandlet = new SfdxCommandlet(
    new SfdxWorkspaceChecker(),
    new RetrieveComponentGatherer(node),
    new ForceSourceRetrieveExecutor(),
    new FilePathExistsChecker(
      globStrategy,
      nls.localize('warning_prompt_cmp_file_overwrite', label)
    )
  );
  await commandlet.run();
}

type WithType = DirFileNameSelection & { type?: string };

class RetrieveComponentGatherer implements ParametersGatherer<WithType[]> {
  private node: BrowserNode;

  constructor(node: BrowserNode) {
    this.node = node;
  }

  public async gather(): Promise<
    CancelResponse | ContinueResponse<WithType[]>
  > {
    let toRetrieve: WithType[] = [];
    if (this.node.type === NodeType.MetadataType) {
      toRetrieve = this.node.children!.map(child => this.buildOutput(child));
    } else {
      toRetrieve.push(this.buildOutput(this.node));
    }
    return { type: 'CONTINUE', data: toRetrieve };
  }

  private buildOutput(component: BrowserNode): WithType {
    const typeNode = getTypeNode(component);
    return {
      outputdir: join('main', 'default', typeNode.directoryName!),
      fileName: component.fullName,
      type: typeNode.fullName
    };
  }
}

function getTypeNode(node: BrowserNode) {
  switch (node.parent!.type) {
    case NodeType.Folder:
      return node.parent!.parent!;
    case NodeType.MetadataType:
      return node.parent!;
    default:
      return node;
  }
}
