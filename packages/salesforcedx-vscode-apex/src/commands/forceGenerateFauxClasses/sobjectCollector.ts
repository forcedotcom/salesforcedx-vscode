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

export class SObjectCollector {
  public static async getSObjects(category: SObjectCategory) {
    switch (category) {
      case SObjectCategory.ALL:
      case SObjectCategory.CUSTOM:
      case SObjectCategory.STANDARD:
        return await this.getSObjectInOrg(category);
      case SObjectCategory.PROJECT:
        return Array.from(await this.getSObjectsInProject());
    }
  }

  private static async getSObjectInOrg(
    category: SObjectCategory
  ): Promise<string[]> {
    const command = new SfdxCommandBuilder()
      .withArg('force:schema:sobject:list')
      .withFlag('--sobjecttypecategory', category)
      .withJson()
      .build();
    const execution = new CliCommandExecutor(command, {
      cwd: getRootWorkspacePath()
    }).execute();
    const result = await new CommandOutput().getCmdResult(execution);
    return extractJsonObject(result).result as string[];
  }

  private static async getSObjectsInProject(): Promise<string[]> {
    const packageDirectories = await SfdxPackageDirectories.getPackageDirectoryPaths();
    const foundFiles = await workspace.findFiles(
      `{${packageDirectories.join(',')}}/**/objects/*/*.object-meta.xml`
    );
    const objectNames = foundFiles.map(
      file => basename(file.fsPath).split('.')[0]
    );
    return Array.from(new Set<string>(objectNames));
  }
}
