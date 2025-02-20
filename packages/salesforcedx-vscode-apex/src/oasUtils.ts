/*
 * Copyright (c) 2025, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */

import { SfProject } from '@salesforce/core-bundle';
import { extractJsonString, isJsonString, workspaceUtils } from '@salesforce/salesforcedx-utils-vscode';
import { extensionUris } from '@salesforce/salesforcedx-utils-vscode';
import * as fs from 'fs';
import { OpenAPIV3 } from 'openapi-types';
import { join } from 'path';
import * as vscode from 'vscode';
import * as yaml from 'yaml';
import { SF_LOG_LEVEL_SETTING, VSCODE_APEX_EXTENSION_NAME } from './constants';
import { nls } from './messages';
import OasProcessor from './oas/documentProcessorPipeline';
import { ProcessorInputOutput } from './oas/documentProcessorPipeline/processorStep';
import GenerationInteractionLogger from './oas/generationInteractionLogger';
import { ApexClassOASGatherContextResponse, ApexClassOASEligibleResponse } from './oas/schemas';

const DOT_SFDX = '.sfdx';
const TEMPLATES_DIR = join(DOT_SFDX, 'resources', 'templates');

const gil = GenerationInteractionLogger.getInstance();

/**
 * Processes an OAS document.
 * @param {string} oasDoc - The OAS document as a string.
 * @param {ApexClassOASGatherContextResponse} [context] - The context for the OAS document.
 * @param {ApexClassOASEligibleResponse} [eligibleResult] - The eligible result for the OAS document.
 * @param {boolean} [isRevalidation] - Whether the document is being revalidated.
 * @returns {Promise<ProcessorInputOutput>} - The processed OAS document.
 * @throws Will throw an error if the document is invalid for processing.
 */
export const processOasDocument = async (
  oasDoc: string,
  context?: ApexClassOASGatherContextResponse,
  eligibleResult?: ApexClassOASEligibleResponse,
  isRevalidation?: boolean
): Promise<ProcessorInputOutput> => {
  if (isRevalidation || context?.classDetail.annotations.find(a => a.name === 'RestResource')) {
    const parsed = isJsonString(oasDoc) ? parseOASDocFromJson(oasDoc) : parseOASDocFromYaml(oasDoc);

    const oasProcessor = new OasProcessor(parsed, eligibleResult);

    const processResult = await oasProcessor.process();

    return processResult;
  }
  throw nls.localize('invalid_file_for_processing_oas_doc');
};

/**
 * Creates problem tab entries for an OAS document.
 * @param {string} fullPath - The full path to the OAS document.
 * @param {ProcessorInputOutput} processedOasResult - The processed OAS result.
 * @param {boolean} isESRDecomposed - Whether the ESR is decomposed.
 */
export const createProblemTabEntriesForOasDocument = (
  fullPath: string,
  processedOasResult: ProcessorInputOutput,
  isESRDecomposed: boolean
): void => {
  const uri = vscode.Uri.parse(fullPath);
  OasProcessor.diagnosticCollection.clear();

  const adjustErrors = processedOasResult.errors.map(result => {
    // if embedded inside of ESR.xml then position is hardcoded because of `apexActionController.createESRObject`
    const lineAdjustment = isESRDecomposed ? 0 : 4;
    const startCharacterAdjustment = isESRDecomposed ? 0 : 11;
    const range = new vscode.Range(
      result.range.start.line + lineAdjustment,
      result.range.start.character + result.range.start.line <= 1 ? startCharacterAdjustment : 0,
      result.range.end.line + lineAdjustment,
      result.range.end.character + result.range.start.line <= 1 ? startCharacterAdjustment : 0
    );
    return new vscode.Diagnostic(range, result.message, result.severity);
  });

  gil.addDiagnostics(adjustErrors);

  const mulesoftExtension = vscode.extensions.getExtension('salesforce.mule-dx-agentforce-api-component');
  if (!mulesoftExtension?.isActive) {
    OasProcessor.diagnosticCollection.set(uri, adjustErrors);
  }
};

/**
 * Reads sfdx-project.json and checks if decomposeExternalServiceRegistrationBeta is enabled.
 * @returns {Promise<boolean>} - True if sfdx-project.json contains decomposeExternalServiceRegistrationBeta.
 */
export const checkIfESRIsDecomposed = async (): Promise<boolean> => {
  const projectPath = workspaceUtils.getRootWorkspacePath();
  const sfProject = await SfProject.resolve(projectPath);
  const sfdxProjectJson = sfProject.getSfProjectJson();
  if (sfdxProjectJson.getContents().sourceBehaviorOptions?.includes('decomposeExternalServiceRegistrationBeta')) {
    return true;
  }

  return false;
};

/**
 * Cleans up a generated document by extracting the JSON string.
 * @param {string} doc - The document to clean up.
 * @returns {string} - The cleaned-up JSON string.
 */
export const cleanupGeneratedDoc = (doc: string): string => {
  return extractJsonString(doc);
};

/**
 * Parses an OAS document from a JSON string.
 * @param {string} doc - The JSON string representing the OAS document.
 * @returns {OpenAPIV3.Document} - The parsed OAS document.
 */
export const parseOASDocFromJson = (doc: string): OpenAPIV3.Document => {
  return JSON.parse(doc) as OpenAPIV3.Document;
};

/**
 * Parses an OAS document from a YAML string.
 * @param {string} doc - The YAML string representing the OAS document.
 * @returns {OpenAPIV3.Document} - The parsed OAS document.
 */
export const parseOASDocFromYaml = (doc: string): OpenAPIV3.Document => {
  return yaml.parse(doc) as OpenAPIV3.Document;
};

const PROMPT_TEMPLATES = {
  METHOD_BY_METHOD: join('resources', 'templates', 'methodByMethod.ejs')
};

export type ejsTemplateKey = keyof typeof PROMPT_TEMPLATES;

export enum EjsTemplatesEnum {
  METHOD_BY_METHOD = 'METHOD_BY_METHOD'
}

export enum EjsTemplateKeys {
  METHOD_BY_METHOD = 'METHOD_BY_METHOD'
}

const copyDirectorySync = (src: string, dest: string) => {
  if (!fs.existsSync(dest)) {
    fs.mkdirSync(dest, { recursive: true });
  }

  const entries = fs.readdirSync(src, { withFileTypes: true });

  for (const entry of entries) {
    const srcPath = join(src, entry.name);
    const destPath = join(dest, entry.name);

    if (entry.isDirectory()) {
      copyDirectorySync(srcPath, destPath);
    } else {
      fs.copyFileSync(srcPath, destPath);
    }
  }
};

const resolveTemplateDir = (): vscode.Uri => {
  const logLevel = vscode.workspace.getConfiguration().get(SF_LOG_LEVEL_SETTING, 'fatal');
  const extensionDir = extensionUris.extensionUri(VSCODE_APEX_EXTENSION_NAME);
  if (logLevel !== 'fatal') {
    if (!fs.existsSync(TEMPLATES_DIR)) {
      fs.mkdirSync(TEMPLATES_DIR, { recursive: true });
      // copy contents of extensionDir to TEMPLATES_DIR
      copyDirectorySync(join(extensionDir.fsPath, 'resources', 'templates'), TEMPLATES_DIR);
    }
    return vscode.Uri.file(join(process.cwd(), DOT_SFDX));
  }
  return extensionDir;
};

/**
 * Helper functions for EJS templates.
 */
export const ejsTemplateHelpers = {
  /**
   * Gets the template path for a given key.
   * @param {ejsTemplateKey} key - The key for the template.
   * @returns {vscode.Uri} - The URI of the template path.
   */
  getTemplatePath: (key: ejsTemplateKey): vscode.Uri => {
    const baseExtensionPath = resolveTemplateDir();
    return vscode.Uri.file(join(baseExtensionPath.fsPath, PROMPT_TEMPLATES[key]));
  }
};
