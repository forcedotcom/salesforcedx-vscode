/*
 * Copyright (c) 2019, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */
import { TelemetryData } from '@salesforce/salesforcedx-utils-vscode/out/src';
import {
  CliCommandExecutor,
  Command,
  CommandOutput,
  SfdxCommandBuilder
} from '@salesforce/salesforcedx-utils-vscode/out/src/cli';
import {
  ContinueResponse,
  LocalComponent
} from '@salesforce/salesforcedx-utils-vscode/out/src/types';
import {
  ComponentSet,
  RetrieveResult,
  SourceComponent
} from '@salesforce/source-deploy-retrieve';
import { SourceRetrieveResult } from '@salesforce/source-deploy-retrieve/lib/src/client/types';
import { ComponentLike } from '@salesforce/source-deploy-retrieve/lib/src/common/types';
import * as path from 'path';
import * as vscode from 'vscode';
import { RetrieveDescriber, RetrieveMetadataTrigger } from '.';
import { channelService } from '../../channels';
import { nls } from '../../messages';
import { SfdxPackageDirectories } from '../../sfdxProject';
import { telemetryService } from '../../telemetry';
import { getRootWorkspacePath, MetadataDictionary } from '../../util';
import { RetrieveCommand } from '../baseDeployRetrieve';
import {
  SfdxCommandlet,
  SfdxCommandletExecutor,
  SfdxWorkspaceChecker,
  useBetaDeployRetrieve
} from '../util';
import { RetrieveComponentOutputGatherer } from '../util/parameterGatherers';
import { OverwriteComponentPrompt } from '../util/postconditionCheckers';

export class ForceSourceRetrieveExecutor extends SfdxCommandletExecutor<
  LocalComponent[]
> {
  private describer: RetrieveDescriber;
  private openAfterRetrieve: boolean = false;
  constructor(
    describer: RetrieveDescriber,
    openAfterRetrieve: boolean = false
  ) {
    super();
    this.describer = describer;
    this.openAfterRetrieve = openAfterRetrieve;
  }

  public build(data?: LocalComponent[]): Command {
    return new SfdxCommandBuilder()
      .withDescription(nls.localize('force_source_retrieve_text'))
      .withLogName('force_source_retrieve')
      .withArg('force:source:retrieve')
      .withJson()
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

  public async execute(response: any): Promise<void> {
    const cancellationTokenSource = new vscode.CancellationTokenSource();
    const cancellationToken = cancellationTokenSource.token;
    const execution = await new CliCommandExecutor(this.build(response.data), {
      cwd: getRootWorkspacePath()
    }).execute(cancellationToken);
    this.attachExecution(execution, cancellationTokenSource, cancellationToken);
    const result = await new CommandOutput().getCmdResult(execution);
    let resultJson: any;
    try {
      resultJson = JSON.parse(result);
    } catch (error) {
      channelService.appendLine(
        nls.localize('force_org_open_default_scratch_org_container_error')
      );
      telemetryService.sendException(
        'force_org_open_container',
        `There was an error when parsing the org open response ${error}`
      );
    }

    if (resultJson.status === 0 && this.openAfterRetrieve) {
      const extensions = MetadataDictionary.getInfo(
        resultJson.result.inboundFiles[0].type
      )?.extensions;

      const filesToOpen = [];
      if (extensions) {
        for (const ext of extensions) {
          const tmpFile = resultJson.result.inboundFiles.find(
            ({ filePath }: { filePath: string }) => filePath.endsWith(ext)
          );
          filesToOpen.push(path.join(getRootWorkspacePath(), tmpFile.filePath));
        }
      } else {
        const tmpFile = resultJson.result.inboundFiles.find(
          ({ filePath }: { filePath: string }) => filePath.endsWith('-meta.xml')
        );
        filesToOpen.push(path.join(getRootWorkspacePath(), tmpFile.filePath));
      }

      for (const file of filesToOpen) {
        const showOptions: vscode.TextDocumentShowOptions = {
          preview: false
        };
        const document = await vscode.workspace.openTextDocument(file);
        vscode.window.showTextDocument(document, showOptions);
      }
    }
  }
}
export class LibraryRetrieveSourcePathExecutor extends RetrieveCommand<
  LocalComponent[]
> {
  private openAfterRetrieve: boolean;

  constructor(openAfterRetrieve = false) {
    super(
      nls.localize('force_source_retrieve_text'),
      'force_source_retrieve_beta'
    );
    this.openAfterRetrieve = openAfterRetrieve;
  }

  protected async getComponents(
    response: ContinueResponse<LocalComponent[]>
  ): Promise<ComponentSet> {
    const filter = new ComponentSet(
      response.data.map(lc => ({ fullName: lc.fileName, type: lc.type }))
    );
    const packageDirs = await SfdxPackageDirectories.getPackageDirectoryFullPaths();
    for (const dir of packageDirs) {
      filter.resolveSourceComponents(dir, { filter });
    }
    return filter;
  }

  protected async postOperation(
    result: RetrieveResult | SourceRetrieveResult | undefined
  ) {
    await super.postOperation(result);

    // assumes opening only one component
    if (result && this.openAfterRetrieve) {
      let componentToOpen: SourceComponent | undefined;

      if (result instanceof RetrieveResult) {
        componentToOpen = result.components.getSourceComponents().first();
      } else {
        componentToOpen = result.successes[0]?.component;
      }

      if (componentToOpen) {
        const dirPath =
          (await SfdxPackageDirectories.getDefaultPackageDir()) || '';
        const defaultOutput = path.join(getRootWorkspacePath(), dirPath);
        const compSet = ComponentSet.fromSource(defaultOutput);
        await this.openResources(this.findResources(componentToOpen, compSet));
      }
    }
  }

  private findResources(
    filter: ComponentLike,
    compSet?: ComponentSet
  ): string[] {
    if (compSet && compSet.size > 0) {
      const oneComp = compSet.getSourceComponents(filter).first();

      const filesToOpen = [];
      if (oneComp) {
        if (oneComp.xml) {
          filesToOpen.push(oneComp.xml);
        }

        for (const filePath of oneComp.walkContent()) {
          filesToOpen.push(filePath);
        }
      }
      return filesToOpen;
    }
    return [];
  }

  private async openResources(filesToOpen: string[]): Promise<void> {
    for (const file of filesToOpen) {
      const showOptions: vscode.TextDocumentShowOptions = {
        preview: false
      };
      const document = await vscode.workspace.openTextDocument(file);
      vscode.window.showTextDocument(document, showOptions);
    }
  }
}

export async function forceSourceRetrieveCmp(
  trigger: RetrieveMetadataTrigger,
  openAfterRetrieve: boolean = false
) {
  const useBeta = useBetaDeployRetrieve([]);
  const retrieveDescriber = trigger.describer();
  const commandlet = new SfdxCommandlet(
    new SfdxWorkspaceChecker(),
    new RetrieveComponentOutputGatherer(retrieveDescriber),
    useBeta
      ? new LibraryRetrieveSourcePathExecutor(openAfterRetrieve)
      : new ForceSourceRetrieveExecutor(retrieveDescriber, openAfterRetrieve),
    new OverwriteComponentPrompt()
  );
  await commandlet.run();
}
