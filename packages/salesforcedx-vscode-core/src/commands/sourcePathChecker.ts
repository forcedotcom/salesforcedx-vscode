/*
 * Copyright (c) 2023, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */
import {
  CancelResponse,
  ContinueResponse,
  PostconditionChecker
} from '@salesforce/salesforcedx-utils-vscode';
import { channelService } from '../channels';
import { nls } from '../messages';
import { notificationService } from '../notifications';
import { SfdxPackageDirectories } from '../sfdxProject';
import { telemetryService } from '../telemetry';

export class SourcePathChecker implements PostconditionChecker<string[]> {
  public async check(
    inputs: ContinueResponse<string[]> | CancelResponse
  ): Promise<ContinueResponse<string[]> | CancelResponse> {
    if (inputs.type === 'CONTINUE') {
      const sourcePaths = inputs.data;
      try {
        for (const sourcePath of sourcePaths) {
          const isInSfdxPackageDirectory = await SfdxPackageDirectories.isInPackageDirectory(
            sourcePath
          );

          if (!isInSfdxPackageDirectory) {
            throw nls.localize(
              'error_source_path_not_in_package_directory_text'
            );
          }
        }

        return inputs;
      } catch (error) {
        telemetryService.sendException(
          'force_source_retrieve_with_sourcepath',
          `Error while parsing package directories. ${error.message}`
        );
      }

      const errorMessage = nls.localize(
        'error_source_path_not_in_package_directory_text'
      );
      telemetryService.sendException(
        'force_source_retrieve_with_sourcepath',
        errorMessage
      );
      notificationService.showErrorMessage(errorMessage);
      channelService.appendLine(errorMessage);
      channelService.showChannelOutput();
    }
    return { type: 'CANCEL' };
  }
}
