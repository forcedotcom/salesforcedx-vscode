/*
 * Copyright (c) 2019, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */

import {
  CliCommandExecutor,
  Command,
  CommandOutput,
  SfdxCommandBuilder
} from '@salesforce/salesforcedx-utils-vscode/out/src/cli';
import * as fs from 'fs';
import { SfdxCommandletExecutor } from '../commands';
import { getRootWorkspacePath } from '../util';

export class ForceListMetadataExecutor extends SfdxCommandletExecutor<string> {
  private metadataType: string;
  private defaultUsernameOrAlias: string;
  private folder?: string;

  public constructor(
    metadataType: string,
    defaultUsernameOrAlias: string,
    folder?: string
  ) {
    super();
    this.metadataType = metadataType;
    this.defaultUsernameOrAlias = defaultUsernameOrAlias;
    this.folder = folder;
  }

  public build(data: {}): Command {
    const builder = new SfdxCommandBuilder()
      .withArg('force:mdapi:listmetadata')
      .withFlag('-m', this.metadataType)
      .withFlag('-u', this.defaultUsernameOrAlias)
      .withLogName('force_list_metadata')
      .withJson();

    if (this.folder) {
      builder.withFlag('--folder', this.folder);
    }

    return builder.build();
  }
}

export async function forceListMetadata(
  metadataType: string,
  defaultUsernameOrAlias: string,
  outputPath: string,
  folder?: string
): Promise<string> {
  const execution = new CliCommandExecutor(
    new ForceListMetadataExecutor(
      metadataType,
      defaultUsernameOrAlias,
      folder
    ).build({}),
    { cwd: getRootWorkspacePath() }
  ).execute();

  const cmdOutput = new CommandOutput();
  const result = await cmdOutput.getCmdResult(execution);
  fs.writeFileSync(outputPath, result);
  return result;
}
