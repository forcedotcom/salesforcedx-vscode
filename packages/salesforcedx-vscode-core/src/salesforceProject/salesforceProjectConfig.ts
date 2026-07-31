/*
 * Copyright (c) 2026, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */
import { SfProject, SfProjectJson } from '@salesforce/core/project';
import { getServicesApi } from '@salesforce/effect-ext-utils';
import { notificationService, workspaceUtils } from '@salesforce/salesforcedx-utils-vscode';
import { JsonArray } from '@salesforce/ts-types';
import * as Effect from 'effect/Effect';
import * as Layer from 'effect/Layer';
import { isError } from 'effect/Predicate';
import * as path from 'node:path';
import * as vscode from 'vscode';
import { nls } from '../messages';
import { telemetryService } from '../telemetry';

const SFDX_PROJECT_FILE = 'sfdx-project.json';

/** Class representing the local sfdx-project.json file. */
export class SalesforceProjectConfig {
  private static instance: SfProjectJson;

  private static async initializeSalesforceProjectConfig() {
    const isProject = await Effect.runPromise(
      Effect.gen(function* () {
        const api = yield* getServicesApi;
        return yield* api.services.ProjectService.isSalesforceProject().pipe(
          Effect.provide(Layer.succeedContext(api.services.prebuiltServicesDependencies))
        );
      }).pipe(Effect.catchAllCause(() => Effect.succeed(false)))
    );
    if (!SalesforceProjectConfig.instance && isProject) {
      const salesforceProjectPath = workspaceUtils.getRootWorkspacePath();
      try {
        const salesforceProject = await SfProject.resolve(salesforceProjectPath);
        SalesforceProjectConfig.instance = await salesforceProject.retrieveSfProjectJson();
        const fileWatcher = vscode.workspace.createFileSystemWatcher(path.join(salesforceProjectPath, SFDX_PROJECT_FILE));
        fileWatcher.onDidChange(async () => SalesforceProjectConfig.instance.read());
      } catch (error) {
        SalesforceProjectConfig.handleError(error);
        throw error;
      }
    }
  }

  private static handleError(error: unknown) {
    const projectError = isError(error) ? error : new Error(String(error));
    const errorMessage =
      projectError.name === 'JsonParseError'
        ? nls.localize(
            'error_parsing_sfdx_project_file',
            'path' in projectError && typeof projectError.path === 'string' ? projectError.path : SFDX_PROJECT_FILE,
            projectError.message
          )
        : projectError.message;
    notificationService.showErrorMessage(errorMessage);
    telemetryService.sendException('project_config', errorMessage);
  }

  public static async getInstance(): Promise<SfProjectJson> {
    if (!SalesforceProjectConfig.instance) await SalesforceProjectConfig.initializeSalesforceProjectConfig();
    return SalesforceProjectConfig.instance;
  }

  public static async getValue<T extends JsonArray | string | undefined>(key: string): Promise<T> {
    const projectConfig = await SalesforceProjectConfig.getInstance();
    // SfProjectJson stores JSON values, while this legacy API exposes its caller-selected subset.
    // eslint-disable-next-line @typescript-eslint/consistent-type-assertions
    return projectConfig.get(key) as T;
  }
}
