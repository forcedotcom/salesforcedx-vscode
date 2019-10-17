import { SObjectCategory } from '@salesforce/salesforcedx-sobjects-faux-generator/out/src/describe';
import {
  CliCommandExecutor,
  CommandOutput,
  SfdxCommandBuilder
} from '@salesforce/salesforcedx-utils-vscode/out/src/cli';
import { extractJsonObject } from '@salesforce/salesforcedx-utils-vscode/out/src/helpers';
import { basename } from 'path';
import { extensions, workspace } from 'vscode';

const {
  getRootWorkspacePath,
  SfdxPackageDirectories
} = extensions.getExtension('salesforce.salesforcedx-vscode-core')!.exports;

export interface SObjectCollector {
  getObjectNames(): Promise<Set<string>>;
}

export class SchemaList implements SObjectCollector {
  private category: SObjectCategory;
  public constructor(
    category:
      | SObjectCategory.CUSTOM
      | SObjectCategory.STANDARD
      | SObjectCategory.ALL
  ) {
    this.category = category;
  }

  public async getObjectNames(): Promise<Set<string>> {
    const command = new SfdxCommandBuilder()
      .withArg('force:schema:sobject:list')
      .withFlag('--sobjecttypecategory', this.category)
      .withJson()
      .build();
    const execution = new CliCommandExecutor(command, {
      cwd: getRootWorkspacePath()
    }).execute();
    const result = await new CommandOutput().getCmdResult(execution);
    return new Set(extractJsonObject(result).result);
  }
}

export class ProjectObjects implements SObjectCollector {
  public async getObjectNames() {
    const packageDirectories = await SfdxPackageDirectories.getPackageDirectoryPaths();
    const foundFiles = await workspace.findFiles(
      `{${packageDirectories.join(',')}}/**/objects/*/*.object-meta.xml`
    );
    const objectNames = foundFiles.map(
      file => basename(file.fsPath).split('.')[0]
    );
    return new Set<string>(objectNames);
  }
}
