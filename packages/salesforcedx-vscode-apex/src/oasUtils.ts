/*
 * Copyright (c) 2025, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */
/* eslint-disable @typescript-eslint/consistent-type-assertions */

import { extensionUris, getJsonCandidate, identifyJsonTypeInString } from '@salesforce/salesforcedx-utils-vscode';
import * as fs from 'node:fs';
import * as path from 'node:path';
import type { OpenAPIV3 } from 'openapi-types';
import * as vscode from 'vscode';
import { URI } from 'vscode-uri';
import { parse as yamlParse } from 'yaml';
import { SF_LOG_LEVEL_SETTING, VSCODE_APEX_EXTENSION_NAME } from './constants';
import { getVscodeCoreExtension } from './coreExtensionUtils';
import OasProcessor from './oas/documentProcessorPipeline';
import { ProcessorInputOutput } from './oas/documentProcessorPipeline/processorStep';
import GenerationInteractionLogger from './oas/generationInteractionLogger';
import { ApexClassOASEligibleResponse, ApexClassOASGatherContextResponse } from './oas/schemas';
import { retrieveAAClassRestAnnotations, retrieveAAMethodRestAnnotations } from './settings';

const DOT_SFDX = '.sfdx';
const TEMPLATES_DIR = path.join(DOT_SFDX, 'resources', 'templates');

const gil = GenerationInteractionLogger.getInstance();

/**
 * Processes an OAS document from a YAML string.
 * @param {string} oasDoc - The OAS document as a YAML string.
 * @param {object} [options] - Options for processing the OAS document.
 * @param {ApexClassOASGatherContextResponse} [options.context] - The context for the OAS document.
 * @param {ApexClassOASEligibleResponse} [options.eligibleResult] - The eligible result for the OAS document.
 * @param {boolean} [options.isRevalidation] - Whether the document is being revalidated.
 * @param {string} [options.betaInfo] - Beta information for the document.
 * @returns {Promise<ProcessorInputOutput>} - The processed OAS document.
 */
export const processOasDocumentFromYaml = async (
  oasDoc: string,
  options?: {
    context?: ApexClassOASGatherContextResponse;
    eligibleResult?: ApexClassOASEligibleResponse;
    isRevalidation?: boolean;
    betaInfo?: string;
  }
): Promise<ProcessorInputOutput> => processOasDocument(JSON.stringify(parseOASDocFromYaml(oasDoc)), options);

/**
 * Processes an OAS document.
 * @param {string} oasDoc - The OAS document as a string.
 * @param {object} [options] - Options for processing the OAS document.
 * @param {ApexClassOASGatherContextResponse} [options.context] - The context for the OAS document.
 * @param {ApexClassOASEligibleResponse} [options.eligibleResult] - The eligible result for the OAS document.
 * @param {boolean} [options.isRevalidation] - Whether the document is being revalidated.
 * @param {string} [options.betaInfo] - Beta information for the document.
 * @returns {Promise<ProcessorInputOutput>} - The processed OAS document.
 * @throws Will throw an error if the document is invalid for processing.
 */
export const processOasDocument = async (
  oasDoc: string,
  options?: {
    context?: ApexClassOASGatherContextResponse;
    eligibleResult?: ApexClassOASEligibleResponse;
    isRevalidation?: boolean;
    betaInfo?: string;
  }
): Promise<ProcessorInputOutput> => {
  const parsed = parseOASDocFromJson(oasDoc);

  const oasProcessor = new OasProcessor(parsed, options);

  const processResult = await oasProcessor.process();

  return processResult;
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
  const uri = URI.file(fullPath);
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
  const vscodeCoreExtension = await getVscodeCoreExtension();
  const sfdxProjectJson = await vscodeCoreExtension.exports.services.SalesforceProjectConfig.getInstance();

  if (sfdxProjectJson?.getContents().sourceBehaviorOptions?.includes('decomposeExternalServiceRegistrationBeta')) {
    return true;
  }

  return false;
};

/**
 * Cleans up a generated document by extracting the JSON string.
 * @param {string} doc - The document to clean up.
 * @returns {string} - The cleaned-up JSON string.
 * @throws Will throw an error if the document is not a valid JSON object.
 */
export const cleanupGeneratedDoc = (doc: string): string => {
  if (identifyJsonTypeInString(doc) === 'object') {
    const jsonCandidate = getJsonCandidate(doc);
    if (jsonCandidate) {
      return jsonCandidate;
    }
  }
  throw new Error('The document is not a valid JSON object.');
};

/**
 * Parses an OAS document from a JSON string.
 * @param {string} doc - The JSON string representing the OAS document.
 * @returns {OpenAPIV3.Document} - The parsed OAS document.
 */
export const parseOASDocFromJson = (doc: string): OpenAPIV3.Document => JSON.parse(doc) as OpenAPIV3.Document;

/**
 * Parses an OAS document from a YAML string.
 * @param {string} doc - The YAML string representing the OAS document.
 * @returns {OpenAPIV3.Document} - The parsed OAS document.
 */
export const parseOASDocFromYaml = (doc: string): OpenAPIV3.Document => yamlParse(doc) as OpenAPIV3.Document;

const PROMPT_TEMPLATES = {
  METHOD_BY_METHOD: path.join('resources', 'templates', 'methodByMethod.ejs')
};

export type ejsTemplateKey = keyof typeof PROMPT_TEMPLATES;

export enum EjsTemplatesEnum {
  METHOD_BY_METHOD = 'METHOD_BY_METHOD'
}

export enum EjsTemplateKeys {
  METHOD_BY_METHOD = 'METHOD_BY_METHOD'
}

/**
 * Copies the contents of a directory recursively.
 * @param {string} src - The source directory.
 * @param {string} dest - The destination directory.
 */
const copyDirectorySync = (src: string, dest: string) => {
  if (!fs.existsSync(dest)) {
    fs.mkdirSync(dest, { recursive: true });
  }

  const entries = fs.readdirSync(src, { withFileTypes: true });

  for (const entry of entries) {
    const srcPath = path.join(src, entry.name);
    const destPath = path.join(dest, entry.name);

    if (entry.isDirectory()) {
      copyDirectorySync(srcPath, destPath);
    } else {
      fs.copyFileSync(srcPath, destPath);
    }
  }
};

/**
 * Resolves the template directory URI.
 * @returns {URI} - The URI of the template directory.
 */
const resolveTemplateDir = (): URI => {
  const logLevel = vscode.workspace.getConfiguration().get(SF_LOG_LEVEL_SETTING, 'fatal');
  const extensionDir = extensionUris.extensionUri(VSCODE_APEX_EXTENSION_NAME);
  if (logLevel !== 'fatal') {
    if (!fs.existsSync(TEMPLATES_DIR)) {
      fs.mkdirSync(TEMPLATES_DIR, { recursive: true });
      // copy contents of extensionDir to TEMPLATES_DIR
      copyDirectorySync(path.join(extensionDir.fsPath, 'resources', 'templates'), TEMPLATES_DIR);
    }
    return URI.file(path.join(process.cwd(), DOT_SFDX));
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
   * @returns {URI} - The URI of the template path.
   */
  getTemplatePath: (key: ejsTemplateKey): URI => {
    const baseExtensionPath = resolveTemplateDir();
    return URI.file(path.join(baseExtensionPath.fsPath, PROMPT_TEMPLATES[key]));
  }
};

/**
 * Summarizes diagnostics by severity.
 * @param {vscode.Diagnostic[]} diagnostics - The diagnostics to summarize.
 * @returns {number[]} - An array with counts of diagnostics by severity.
 */
export const summarizeDiagnostics = (diagnostics: vscode.Diagnostic[]): number[] =>
  diagnostics.reduce(
    (acc, cur) => {
      acc[cur.severity] += 1;
      acc[acc.length - 1] += 1; // [error, warning, info, hint, total]
      return acc;
    },
    [0, 0, 0, 0, 0]
  );

export const getCurrentTimestamp = (): string => {
  const now = new Date();
  const month = String(now.getMonth() + 1).padStart(2, '0');
  const day = String(now.getDate()).padStart(2, '0');
  const year = now.getFullYear();
  const hours = String(now.getHours()).padStart(2, '0');
  const minutes = String(now.getMinutes()).padStart(2, '0');
  const seconds = String(now.getSeconds()).padStart(2, '0');
  const formattedDate = `${month}${day}${year}_${hours}${minutes}${seconds}`;
  return formattedDate;
};

/**
 * Checks if a class has RestResource annotation.
 * @param {ApexClassOASGatherContextResponse} context - The context containing class details.
 * @returns {boolean} - True if the class has RestResource annotation.
 */
export const hasRestResourceAnnotation = (context: ApexClassOASGatherContextResponse): boolean => {
  const validClassAnnotations = retrieveAAClassRestAnnotations();
  return context.classDetail.annotations.some(a => validClassAnnotations.includes(a.name));
};

/**
 * Checks if any method has HTTP REST annotations.
 * @param {ApexClassOASGatherContextResponse} context - The context containing method details.
 * @returns {boolean} - True if any method has HTTP REST annotations.
 */
export const hasHttpRestAnnotations = (context: ApexClassOASGatherContextResponse): boolean => {
  const validMethodAnnotations = retrieveAAMethodRestAnnotations();
  return context.methods.some(method =>
    method.annotations.some(annotation => validMethodAnnotations.includes(annotation.name))
  );
};

/**
 * Checks if a class has valid REST annotations.
 * @param {ApexClassOASGatherContextResponse} context - The context containing class and method details.
 * @returns {boolean} - True if the class has valid REST annotations.
 */
export const hasValidRestAnnotations = (context: ApexClassOASGatherContextResponse): boolean =>
  // Check for class-level RestResource annotation and at least one method with HTTP REST annotation
  hasRestResourceAnnotation(context) && hasHttpRestAnnotations(context);

/**
 * Checks if a class has no annotations.
 * @param {ApexClassOASGatherContextResponse} context - The context containing class details.
 * @returns {boolean} - True if the class has no annotations.
 */
export const hasNoClassAnnotations = (context: ApexClassOASGatherContextResponse): boolean =>
  context.classDetail.annotations.length === 0;

/**
 * Checks if any method has AuraEnabled annotations.
 * @param {ApexClassOASGatherContextResponse} context - The context containing method details.
 * @returns {boolean} - True if any method has AuraEnabled annotation.
 */
export const hasAuraEnabledMethods = (context: ApexClassOASGatherContextResponse): boolean =>
  context.methods.some(method => method.annotations.some(annotation => annotation.name === 'AuraEnabled'));

/**
 * Checks if any method has AuraEnabled annotations and the class has no annotations.
 * @param {ApexClassOASGatherContextResponse} context - The context containing class and method details.
 * @returns {boolean} - True if the class has no annotations and any method has AuraEnabled annotation.
 */
export const hasAuraFrameworkCapability = (context: ApexClassOASGatherContextResponse): boolean =>
  // Check for no class annotations AND at least one method with AuraEnabled annotation
  hasNoClassAnnotations(context) && hasAuraEnabledMethods(context);

/**
 * Validates if a registration provider type is one of the allowed values.
 * @param {string | undefined} providerType - The provider type to validate.
 * @returns {boolean} - True if the provider type is valid, false otherwise.
 */
export const isValidRegistrationProviderType = (providerType: string | undefined): boolean => {
  const validProviderTypes = ['Custom', 'ApexRest', 'AuraEnabled'];
  return providerType !== undefined && validProviderTypes.includes(providerType);
};

/**
 * Checks if a class mixes Apex Rest and AuraEnabled frameworks (which is invalid).
 * @param {ApexClassOASGatherContextResponse} context - The context containing class and method details.
 * @returns {boolean} - True if the class mixes both frameworks (invalid case).
 */
export const hasMixedFrameworks = (context: ApexClassOASGatherContextResponse): boolean => {
  const hasRestResource = hasRestResourceAnnotation(context);
  const hasHttpAnnotations = hasHttpRestAnnotations(context);
  const hasAuraMethods = hasAuraEnabledMethods(context);

  // Invalid case: (RestResource OR Http annotations) AND AuraEnabled methods
  return (hasRestResource || hasHttpAnnotations) && hasAuraMethods;
};
