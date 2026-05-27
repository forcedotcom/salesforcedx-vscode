/*
 * Copyright (c) 2025, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */
/* eslint-disable @typescript-eslint/consistent-type-assertions */

import { ExtensionProviderService, getJsonCandidate, identifyJsonTypeInString } from '@salesforce/effect-ext-utils';
import * as Effect from 'effect/Effect';
import * as path from 'node:path';
import type { OpenAPIV3 } from 'openapi-types';
import type { ApexClassOASGatherContextResponse } from 'salesforcedx-vscode-apex';
import * as vscode from 'vscode';
import { URI } from 'vscode-uri';
import { parse as yamlParse } from 'yaml';
import { SF_LOG_LEVEL_SETTING, VSCODE_APEX_EXTENSION_NAME } from './constants';
import { ApexExtensionUnavailable, InvalidJsonDocument } from './errors';
import { oasDiagnosticCollection, ProcessorInputOutput } from './oas/documentProcessorPipeline/processorStep';
import { AA_CLASS_REST_ANNOTATIONS } from './settings';

const AA_METHOD_REST_ANNOTATIONS = new Set(['HttpGet', 'HttpPost', 'HttpPut', 'HttpPatch', 'HttpDelete']);

const DOT_SFDX = '.sfdx';

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
  oasDiagnosticCollection.clear();

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

  const mulesoftExtension = vscode.extensions.getExtension('salesforce.mule-dx-agentforce-api-component');
  if (!mulesoftExtension?.isActive) {
    oasDiagnosticCollection.set(uri, adjustErrors);
  }
};

/**
 * Detects ESR decomposition by inspecting the SDR registry's ExternalServiceRegistration type.
 * When `decomposeExternalServiceRegistrationBeta` preset is enabled (via sfdx-project.json
 * sourceBehaviorOptions), the registry entry gains `children` and `strategies.decomposition === 'topLevel'`.
 * Source: node_modules/@salesforce/source-deploy-retrieve/.../decomposeExternalServiceRegistrationBeta.json
 */
export const checkIfESRIsDecomposed = Effect.fn('ApexOas.checkIfESRIsDecomposed')(function* () {
  const api = yield* (yield* ExtensionProviderService).getServicesApi;
  const registryAccess = yield* api.services.MetadataRegistryService.getRegistryAccess();
  return yield* Effect.try(() => {
    const esrType = registryAccess.getTypeByName('ExternalServiceRegistration');
    return Boolean(esrType.children) || esrType.strategies?.decomposition === 'topLevel';
  }).pipe(Effect.catchAll(() => Effect.succeed(false)));
});

/**
 * Strips markdown code fences from a string if present.
 * @param {string} doc - The document that may contain markdown code fences.
 * @returns {string} - The document without markdown code fences.
 */
const stripMarkdownCodeFences = (doc: string): string => {
  // Remove markdown code fences like ```json ... ``` or ``` ... ```
  const markdownPattern = /^```(?:json)?\s*\n?([\s\S]*?)\n?```\s*$/;
  const match = doc.match(markdownPattern);
  return match ? match[1].trim() : doc;
};

/**
 * Cleans up a generated document by extracting the JSON string.
 * @param {string} doc - The document to clean up.
 * @returns Effect yielding the cleaned-up JSON string, or InvalidJsonDocument if not a valid JSON object.
 */
export const cleanupGeneratedDoc = Effect.fn('ApexOas.cleanupGeneratedDoc')(function* (doc: string) {
  // First, strip markdown code fences if present
  const strippedDoc = stripMarkdownCodeFences(doc);
  const jsonCandidate = identifyJsonTypeInString(strippedDoc) === 'object' ? getJsonCandidate(strippedDoc) : undefined;
  return jsonCandidate ?? (yield* new InvalidJsonDocument({ message: 'The document is not a valid JSON object.' }));
});

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

type EjsTemplateKey = keyof typeof PROMPT_TEMPLATES;

/**
 * Copies the contents of a directory recursively.
 * @param {string} src - The source directory.
 * @param {string} dest - The destination directory.
 */
const copyDirectory = Effect.fn('ApexOas.Templates.copyDirectory')(function* (src: string, dest: string) {
  const api = yield* (yield* ExtensionProviderService).getServicesApi;
  const fsService = api.services.FsService;
  // eslint-disable-next-line functional/no-let -- iterative BFS avoids recursive Effect.fn R-channel poisoning
  let queue: readonly (readonly [string, string])[] = [[src, dest] as const];
  // eslint-disable-next-line functional/no-loop-statements -- iterative BFS replaces recursion that poisons TS R-channel inference
  while (queue.length > 0) {
    const next: (readonly [string, string])[] = [];
    yield* Effect.forEach(
      queue,
      ([s, d]) =>
        Effect.gen(function* () {
          yield* fsService.createDirectory(d);
          const entries = yield* fsService.readDirectoryWithTypes(s);
          yield* Effect.forEach(
            entries,
            entry => {
              const name = path.basename(entry.uri.fsPath);
              const srcPath = path.join(s, name);
              const destPath = path.join(d, name);
              if (entry.type === vscode.FileType.Directory) {
                next.push([srcPath, destPath] as const);
                return Effect.void;
              }
              return fsService
                .readFile(srcPath)
                .pipe(Effect.flatMap(content => fsService.writeFile(destPath, content)));
            },
            { concurrency: 'unbounded', discard: true }
          );
        }),
      { concurrency: 'unbounded', discard: true }
    );
    queue = next;
  }
});

/**
 * Resolves the template directory URI.
 * @returns {Promise<URI>} - The URI of the template directory.
 */
const resolveTemplateDir = Effect.fn('ApexOas.Templates.resolveTemplateDir')(function* () {
  const logLevel = vscode.workspace.getConfiguration().get(SF_LOG_LEVEL_SETTING, 'fatal');
  const ext = vscode.extensions.getExtension(VSCODE_APEX_EXTENSION_NAME);
  if (!ext) {
    return yield* new ApexExtensionUnavailable({
      message: `Unable to find extension ${VSCODE_APEX_EXTENSION_NAME}`
    });
  }
  const extensionDir = ext.extensionUri;
  if (logLevel !== 'fatal') {
    const api = yield* (yield* ExtensionProviderService).getServicesApi;
    const workspaceInfo = yield* api.services.WorkspaceService.getWorkspaceInfoOrThrow();
    const templatesDir = path.join(workspaceInfo.fsPath, DOT_SFDX, 'resources', 'templates');
    // copy contents of extensionDir to TEMPLATES_DIR
    yield* copyDirectory(path.join(extensionDir.fsPath, 'resources', 'templates'), templatesDir);
    return URI.file(path.join(workspaceInfo.fsPath, DOT_SFDX));
  }
  return extensionDir;
});

/**
 * Gets the template path for a given key.
 * @param {EjsTemplateKey} key - The key for the template.
 * @returns {Promise<URI>} - The URI of the template path.
 */
export const getTemplatePath = Effect.fn('ApexOas.Templates.getTemplatePath')(function* (key: EjsTemplateKey) {
  const baseExtensionPath = yield* resolveTemplateDir();
  return URI.file(path.join(baseExtensionPath.fsPath, PROMPT_TEMPLATES[key]));
});

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
const hasRestResourceAnnotation = (context: ApexClassOASGatherContextResponse): boolean =>
  context.classDetail.annotations.some(a => AA_CLASS_REST_ANNOTATIONS.includes(a.name));

/**
 * Checks if any method has HTTP REST annotations.
 * @param {ApexClassOASGatherContextResponse} context - The context containing method details.
 * @returns {boolean} - True if any method has HTTP REST annotations.
 */
const hasHttpRestAnnotations = (context: ApexClassOASGatherContextResponse): boolean =>
  context.methods.some(method =>
    method.annotations.some(annotation => AA_METHOD_REST_ANNOTATIONS.has(annotation.name))
  );

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
const hasAuraEnabledMethods = (context: ApexClassOASGatherContextResponse): boolean =>
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
