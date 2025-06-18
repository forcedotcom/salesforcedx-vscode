/*
 * Copyright (c) 2025, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */
import { notificationService, readFile, WorkspaceContextUtil } from '@salesforce/salesforcedx-utils-vscode';
import { XMLParser } from 'fast-xml-parser';
import * as path from 'node:path';
import * as vscode from 'vscode';
import { URI } from 'vscode-uri';
import { nls } from '../messages';
import { checkIfESRIsDecomposed, createProblemTabEntriesForOasDocument, processOasDocumentFromYaml } from '../oasUtils';
import { getTelemetryService } from '../telemetry/telemetry';

// This class runs the validation and correction logic on Oas Documents
class OasDocumentChecker {
  private isESRDecomposed: boolean = false;
  private static _instance: OasDocumentChecker;

  private constructor() {}

  public static get Instance() {
    // Do you need arguments? Make it a regular static method instead.
    return this._instance || (this._instance = new this());
  }

  public async initialize(extensionContext: vscode.ExtensionContext) {
    await WorkspaceContextUtil.getInstance().initialize(extensionContext);
    this.isESRDecomposed = await checkIfESRIsDecomposed();
  }

  /**
   * Validates an OpenAPI Document.
   * @param isClass - Indicates if the action is for a class or a method.
   */
  public validateOasDocument = async (sourceUri: URI | URI[]): Promise<void> => {
    try {
      await vscode.window.withProgress(
        {
          location: vscode.ProgressLocation.Notification,
          title: 'SFDX: Running validations on OAS Document',
          cancellable: true
        },
        async () => {
          if (Array.isArray(sourceUri)) {
            throw nls.localize('invalid_file_for_generating_oas_doc');
          }

          const fullPath = sourceUri ? sourceUri.fsPath : vscode.window.activeTextEditor?.document.uri.fsPath || '';

          // Step 1: Validate eligibility
          if (!(await this.isFilePathEligible(fullPath))) {
            throw nls.localize('invalid_file_for_generating_oas_doc');
          }
          // Step 2: Extract openAPI document if embedded inside xml
          let openApiDocument: string;
          if (fullPath.endsWith('.xml')) {
            const xmlContent = await readFile(fullPath);
            const parser = new XMLParser();
            const jsonObj = parser.parse(xmlContent);
            openApiDocument = jsonObj.ExternalServiceRegistration?.schema;
            if (!openApiDocument) {
              throw nls.localize('no_oas_doc_in_file');
            }
          } else {
            openApiDocument = await readFile(fullPath);
          }
          // Step 3: Process the OAS document
          const processedOasResult = await processOasDocumentFromYaml(openApiDocument, undefined, undefined, true);

          // Step 4: Report/Refresh problems found
          createProblemTabEntriesForOasDocument(fullPath, processedOasResult, this.isESRDecomposed);

          const telemetryService = await getTelemetryService();
          // Step 5: Notify Success
          notificationService.showInformationMessage(
            nls.localize('check_openapi_doc_succeeded', path.basename(fullPath))
          );
          telemetryService.sendEventData('OasValidationSucceeded');
        }
      );
    } catch (error: any) {
      void this.handleError(error, 'OasValidationFailed');
    }
  };

  /**
   * Handles errors by showing a notification and sending telemetry data.
   * @param error - The error to handle.
   * @param telemetryEvent - The telemetry event name.
   */
  private handleError = async (error: any, telemetryEvent: string): Promise<void> => {
    const telemetryService = await getTelemetryService();
    const errorMessage = error instanceof Error ? error.message : String(error);
    notificationService.showErrorMessage(`${nls.localize('check_openapi_doc_failed')}: ${errorMessage}`);
    telemetryService.sendException(telemetryEvent, errorMessage);
  };

  /**
   * Checks if the file path is eligible for OAS validation.
   */
  private async isFilePathEligible(fullPath: string): Promise<boolean> {
    // check if yaml or xml, else return false
    if (!(fullPath.endsWith('.yaml') || fullPath.endsWith('.externalServiceRegistration-meta.xml'))) {
      return false;
    }

    // if xml, check registrationProviderType to be ApexRest
    if (fullPath.endsWith('.xml')) {
      const xmlContent = await readFile(fullPath);
      const parser = new XMLParser();
      const jsonObj = parser.parse(xmlContent);
      const registrationProviderType = jsonObj.ExternalServiceRegistration?.registrationProviderType;
      if (registrationProviderType === 'Custom' || registrationProviderType === 'ApexRest') {
        return true;
      }
    }

    // if yaml, find the associated xml and look for registrationProviderType to be ApexRest
    if (fullPath.endsWith('.yaml')) {
      // check folder in which the file is present
      const className = path.basename(fullPath).split('.')[0];
      const dirName = path.dirname(fullPath);
      const associatedXmlFileName = `${className}.externalServiceRegistration-meta.xml`;

      const xmlContent = await readFile(path.join(dirName, associatedXmlFileName));
      const parser = new XMLParser();
      const jsonObj = parser.parse(xmlContent);
      const registrationProviderType = jsonObj.ExternalServiceRegistration?.registrationProviderType;
      if (registrationProviderType === 'Custom' || registrationProviderType === 'ApexRest') {
        return true;
      }
    }

    return false;
  }
}

export const validateOpenApiDocument = async (sourceUri: URI | URI[]): Promise<void> => {
  const oasDocumentChecker = OasDocumentChecker.Instance;
  await oasDocumentChecker.validateOasDocument(sourceUri);
};
