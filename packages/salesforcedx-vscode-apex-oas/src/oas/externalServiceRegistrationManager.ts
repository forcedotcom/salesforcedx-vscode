/*
 * Copyright (c) 2025, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */

import type { ProcessorInputOutput } from './documentProcessorPipeline/processorStep';
import type { ApexOASInfo, ExternalServiceOperation } from './schemas';
import { ExtensionProviderService } from '@salesforce/effect-ext-utils';
import * as Effect from 'effect/Effect';
import { isNotUndefined } from 'effect/Predicate';
import { XMLBuilder, XMLParser } from 'fast-xml-parser';
import { JSONPath } from 'jsonpath-plus';
import * as path from 'node:path';
import type { OpenAPIV3 } from 'openapi-types';
import * as vscode from 'vscode';
import { URI } from 'vscode-uri';
import { stringify } from 'yaml';
import { EsrPathResolutionFailed, EsrWriteFailed } from '../errors';
import { nls } from '../messages/nls';
import {
  createProblemTabEntriesForOasDocument,
  getCurrentTimestamp,
  hasValidRestAnnotations,
  hasAuraFrameworkCapability
} from '../oasUtils';

export type FullPath = [originalPath: string, newPath: string];

export type EsrContext = {
  isESRDecomposed: boolean;
  oasSpec: OpenAPIV3.Document;
  overwrite: boolean;
  originalPath: string;
  newPath: string;
  providerType: string | undefined;
};

const toEsrWriteFailed = (e: { function: string; filePath: string; cause: { message: string } }) =>
  new EsrWriteFailed({
    message: nls.localize('artifact_failed', `${e.function} failed for ${e.filePath}: ${e.cause.message}`)
  });

/** Type guard to check if an object is an OpenAPI OperationObject */
const isOperationObject = (op: unknown): op is OpenAPIV3.OperationObject =>
  typeof op === 'object' && op !== null && 'operationId' in op;

/**
 * Writes the OAS spec to the YAML file alongside the ESR XML.
 */
export const buildESRYaml = Effect.fn('ApexOas.Esr.buildESRYaml')(function* (esrXmlPath: string, safeOasSpec: string) {
  const api = yield* (yield* ExtensionProviderService).getServicesApi;
  const esrYamlPath = replaceXmlToYaml(esrXmlPath);
  yield* api.services.FsService.writeFile(esrYamlPath, safeOasSpec);
});

/**
 * Determines the provider type based on the annotations in the context.
 * @param context - The context containing class and method details with annotations
 * @returns
 * "ApexRest" if class has RestResource annotation and methods have Http* annotations,
 * "AuraEnabled" if no class annotation and methods have AuraEnabled annotations,
 * or undefined if neither pattern matches
 */
const determineProviderType = (context?: ProcessorInputOutput['context']): string | undefined => {
  if (!context) return undefined;
  // ApexRest: has class RestResource annotation AND at least one Http* method annotation
  if (hasValidRestAnnotations(context)) return 'ApexRest';
  // AuraEnabled: no class annotation AND at least one AuraEnabled method annotation
  if (hasAuraFrameworkCapability(context)) return 'AuraEnabled';
  return undefined;
};

/**
 * Cleans a description string by normalizing newlines and whitespace.
 * @param description The description to clean
 * @returns A cleaned description string
 */
const cleanDescription = (description: string): string =>
  // First normalize newlines to \n and clean up excessive whitespace
  description
    .replaceAll('\r\n', '\n') // Normalize Windows line endings
    .replaceAll('\r', '\n') // Normalize Mac line endings
    .replaceAll(/\n\s*\n/g, '\n') // Replace multiple newlines with single newline
    .replaceAll(/[ \t]+/g, ' ') // Replace multiple spaces/tabs with single space
    .trim();

/**
 * Cleans the OpenAPI document by processing description fields and other string values.
 * @param doc The OpenAPI document to clean
 * @returns A cleaned copy of the document
 */
const cleanOasDocument = (doc: OpenAPIV3.Document): OpenAPIV3.Document => {
  const cleaned: OpenAPIV3.Document = JSON.parse(JSON.stringify(doc)); // Deep clone the document

  // Clean all description fields in the document
  const descriptionPaths = [
    '$.info.description',
    '$.paths[*][*].description',
    '$.paths[*].description',
    '$.paths[*][*].responses[*].description',
    '$.paths[*][*].parameters[*].description',
    '$.paths[*][*].requestBody.description',
    '$.components.schemas[*].description'
  ];
  descriptionPaths.forEach(jsonPath => {
    const items = JSONPath<{ description: string }[]>({ path: jsonPath, json: cleaned });
    items.forEach(item => {
      if (item && typeof item === 'object' && item.description) {
        item.description = cleanDescription(item.description);
      }
    });
  });
  return cleaned;
};

/**
 * Handles the scenario where an ESR file already exists.
 * @returns A string indicating the user's choice: 'overwrite', 'merge', or 'cancel'.
 */
export const handleExistingESR = async (): Promise<string> =>
  (await vscode.window.showWarningMessage(
    nls.localize('file_exists'),
    { modal: true },
    nls.localize('overwrite'),
    nls.localize('merge')
  )) ?? 'cancel';

export const getFolderForArtifact = Effect.fn('ApexOas.Esr.getFolderForArtifact')(function* () {
  const api = yield* (yield* ExtensionProviderService).getServicesApi;
  const registryAccess = yield* api.services.MetadataRegistryService.getRegistryAccess().pipe(
    Effect.mapError(
      cause => new EsrPathResolutionFailed({ message: `${nls.localize('registry_access_failed')}: ${String(cause)}` })
    )
  );
  const esrDefaultDirectoryName = yield* Effect.try({
    try: () => registryAccess.getTypeByName('ExternalServiceRegistration').directoryName,
    catch: cause =>
      new EsrPathResolutionFailed({ message: `${nls.localize('registry_access_failed')}: ${String(cause)}` })
  });
  if (!esrDefaultDirectoryName) return undefined;
  const workspaceInfo = yield* api.services.WorkspaceService.getWorkspaceInfoOrThrow().pipe(
    Effect.mapError(
      cause => new EsrPathResolutionFailed({ message: `${nls.localize('no_folder_selected')}: ${String(cause)}` })
    )
  );
  const defaultESRFolder = path.join(workspaceInfo.fsPath, 'force-app', 'main', 'default', esrDefaultDirectoryName);
  const folderUri = yield* Effect.promise(async () =>
    vscode.window.showInputBox({
      prompt: nls.localize('select_folder_for_oas'),
      value: defaultESRFolder
    })
  );
  return folderUri ? path.resolve(folderUri) : undefined;
});

/**
 * Checks if the ESR file already exists and prompts the user on what to do.
 * @param filename
 * @returns Promise<[string, string, boolean]> - [className.externalServiceRegistration-meta.xml, the file name of the generated ESR, a boolean indicating if the file already exists]
 */
export const pathExists = Effect.fn('ApexOas.Esr.pathExists')(function* (filename: string) {
  const api = yield* (yield* ExtensionProviderService).getServicesApi;
  const fsService = api.services.FsService;
  // Step 1: Prompt for Folder
  const folder = yield* getFolderForArtifact();
  if (!folder) {
    return yield* new EsrPathResolutionFailed({ message: nls.localize('no_folder_selected') });
  }
  // Step 2: Verify folder exists and if not create it
  yield* fsService
    .createDirectory(folder)
    .pipe(Effect.mapError(cause => new EsrPathResolutionFailed({ message: String(cause) })));

  // Step 3: Check if File Exists
  const fullPath = path.join(folder, filename);
  const exists = yield* fsService.fileOrFolderExists(fullPath);
  if (exists) {
    const whatToDo = yield* Effect.promise(() => handleExistingESR());
    if (whatToDo === 'cancel') {
      return yield* new EsrPathResolutionFailed({ message: nls.localize('operation_cancelled') });
    }
    if (whatToDo === nls.localize('merge')) {
      const currentTimestamp = getCurrentTimestamp();
      const namePart = path.basename(filename, '.externalServiceRegistration-meta.xml');
      const newFileName = `${namePart}_${currentTimestamp}.externalServiceRegistration-meta.xml`;
      const workspaceInfo = yield* api.services.WorkspaceService.getWorkspaceInfoOrThrow().pipe(
        Effect.mapError(cause => new EsrPathResolutionFailed({ message: String(cause) }))
      );
      const esrFilesForMergeFolder = path.join(workspaceInfo.fsPath, 'esr_files_for_merge');
      yield* fsService
        .createDirectory(esrFilesForMergeFolder)
        .pipe(Effect.mapError(cause => new EsrPathResolutionFailed({ message: String(cause) })));
      const newFullPath = path.join(esrFilesForMergeFolder, newFileName);
      const mergeResult: FullPath = [fullPath, newFullPath];
      return mergeResult;
    }
  }
  const result: FullPath = [fullPath, fullPath];
  return result;
});

export const extractInfoProperties = (oasSpec: OpenAPIV3.Document): ApexOASInfo => ({
  description: oasSpec.info?.description ?? ''
});

export const getOperationsFromYaml = (oasSpec: OpenAPIV3.Document): ExternalServiceOperation[] =>
  Object.entries(oasSpec.paths ?? {})
    .flatMap(([, pathItem]) => {
      if (!pathItem || typeof pathItem !== 'object') return [];
      return Object.entries(pathItem).map(([, operation]) =>
        isOperationObject(operation) && operation.operationId
          ? { name: operation.operationId, active: true }
          : undefined
      );
    })
    .filter(isNotUndefined);

export const createESRObject = (
  ctx: EsrContext,
  description: string,
  className: string,
  safeOasSpec: string,
  _operations: ExternalServiceOperation[]
) => ({
  '?xml': { '@_version': '1.0', '@_encoding': 'UTF-8' },
  ExternalServiceRegistration: {
    '@_xmlns': 'http://soap.sforce.com/2006/04/metadata',
    description,
    label: className,
    ...(ctx.isESRDecomposed ? {} : { schema: safeOasSpec }),
    schemaType: 'OpenApi3',
    schemaUploadFileExtension: 'yaml',
    schemaUploadFileName: `${className.toLowerCase()}_openapi`,
    registrationProviderAsset: className,
    registrationProviderType: ctx.providerType
  }
});

/**
 * Builds the ESR XML content.
 * @param existingContent - The existing XML content, if any.
 */
export const buildESRXml = Effect.fn('ApexOas.Esr.buildESRXml')(function* (
  ctx: EsrContext,
  existingContent: string | undefined
) {
  const baseName = path.basename(ctx.newPath).split('.')[0];
  const className = ctx.newPath.includes('esr_files_for_merge')
    ? // The class name is the part before the second to last underscore
      baseName.split('_').slice(0, -2).join('_')
    : baseName;
  const { description } = extractInfoProperties(ctx.oasSpec);
  const operations = getOperationsFromYaml(ctx.oasSpec);
  // Clean the OpenAPI document before stringifying
  const cleanedOasSpec = cleanOasDocument(ctx.oasSpec);
  const safeOasSpec = stringify(cleanedOasSpec, null, {
    singleQuote: false, // Disable single quotes entirely
    doubleQuotedAsJSON: false,
    lineWidth: 80 // Wrap at 80 characters
  });
  const parser = new XMLParser({ ignoreAttributes: false });
  const esrObject = createESRObject(ctx, description, className, safeOasSpec, operations);

  const resolveExisting = Effect.gen(function* () {
    const parsed = parser.parse(existingContent!);
    if (ctx.isESRDecomposed) {
      yield* buildESRYaml(ctx.newPath, safeOasSpec);
      return { ...esrObject, ExternalServiceRegistration: { ...esrObject.ExternalServiceRegistration, operations } };
    }
    if (parsed.ExternalServiceRegistration?.schema) {
      return {
        ...parsed,
        ExternalServiceRegistration: { ...parsed.ExternalServiceRegistration, schema: safeOasSpec, operations }
      };
    }
    return { ...esrObject, ExternalServiceRegistration: { ...esrObject.ExternalServiceRegistration, operations } };
  });

  const resolveNew = Effect.gen(function* () {
    if (ctx.isESRDecomposed) yield* buildESRYaml(ctx.newPath, safeOasSpec);
    return esrObject;
  });

  const jsonObj = yield* existingContent ? resolveExisting : resolveNew;
  const builder = new XMLBuilder({ ignoreAttributes: false, format: true, processEntities: false });
  return builder.build(jsonObj);
});

/**
 * Writes the updated content to a file and opens it in the editor.
 * If the ESR is decomposed, it also opens the corresponding YAML file.
 */
const writeAndOpenEsrFile = Effect.fn('ApexOas.Esr.writeAndOpenEsrFile')(function* (
  ctx: EsrContext,
  updatedContent: string
) {
  const api = yield* (yield* ExtensionProviderService).getServicesApi;
  yield* api.services.FsService.writeFile(ctx.newPath, updatedContent);
  yield* api.services.FsService.showTextDocument(ctx.newPath);
  if (ctx.isESRDecomposed) {
    yield* api.services.FsService.showTextDocument(replaceXmlToYaml(ctx.newPath));
  }
});

/**
 * Opens a diff editor for the original and new ESR files.
 */
const displayFileDifferences = Effect.fn('ApexOas.Esr.displayFileDifferences')(function* (ctx: EsrContext) {
  if (!ctx.overwrite) {
    yield* openDiffFile(ctx.originalPath, ctx.newPath, 'Manual Diff of ESR XML Files');

    // If sfdx-project.json contains decomposeExternalServiceRegistrationBeta, also open a diff for the YAML OAS docs
    if (ctx.isESRDecomposed) {
      yield* openDiffFile(
        replaceXmlToYaml(ctx.originalPath),
        replaceXmlToYaml(ctx.newPath),
        'Manual Diff of ESR YAML Files'
      );
    }
  }
});

/**
 * Generates the External Service Registration metadata, writes the ESR XML/YAML files, opens diffs when needed,
 * and surfaces document diagnostics.
 */
export const generateEsrMD = Effect.fn('ApexOas.Esr.generateEsrMD')(function* (
  isESRDecomposed: boolean,
  processedOasResult: ProcessorInputOutput,
  fullPath: FullPath
) {
  const ctx: EsrContext = {
    isESRDecomposed,
    oasSpec: processedOasResult.openAPIDoc,
    overwrite: fullPath[0] === fullPath[1],
    originalPath: fullPath[0],
    newPath: fullPath[1],
    providerType: determineProviderType(processedOasResult.context)
  };

  const api = yield* (yield* ExtensionProviderService).getServicesApi;
  const fsService = api.services.FsService;
  const exists = yield* fsService.fileOrFolderExists(ctx.newPath);
  const existingContent = yield* (exists ? fsService.readFile(ctx.newPath) : Effect.succeed(undefined)).pipe(
    Effect.catchTag('FsServiceError', toEsrWriteFailed)
  );
  //Step 1: Build the content of the ESR Xml file
  const updatedContent = yield* buildESRXml(ctx, existingContent).pipe(
    Effect.catchTag('FsServiceError', toEsrWriteFailed)
  );
  //Step 2: Write OpenAPI Document to File
  yield* writeAndOpenEsrFile(ctx, updatedContent).pipe(Effect.catchTag('FsServiceError', toEsrWriteFailed));
  // Step 3: If the user chose to merge, open a diff between the original and new ESR files
  yield* displayFileDifferences(ctx);

  // Step: 4 Create entries in problems tab for generated file
  createProblemTabEntriesForOasDocument(
    ctx.isESRDecomposed ? replaceXmlToYaml(ctx.newPath) : ctx.newPath,
    processedOasResult,
    ctx.isESRDecomposed
  );
});

export const replaceXmlToYaml = (filePath: string): string =>
  filePath.replace('.externalServiceRegistration-meta.xml', '.yaml');

const openDiffFile = Effect.fn('ApexOas.Esr.openDiffFile')(function* (
  filepath1: string,
  filepath2: string,
  diffWindowName: string
) {
  yield* Effect.promise(() =>
    Promise.resolve(
      vscode.commands.executeCommand('vscode.diff', URI.file(filepath1), URI.file(filepath2), diffWindowName)
    )
  );
});
