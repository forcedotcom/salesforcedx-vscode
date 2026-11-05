/*
 * Copyright (c) 2026, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */
/* eslint-disable @typescript-eslint/consistent-type-assertions */

import { ExtensionProviderService } from '@salesforce/effect-ext-utils';
import * as Clock from 'effect/Clock';
import * as Effect from 'effect/Effect';
import { isNotUndefined } from 'effect/Predicate';
import type { OpenAPIV3 } from 'openapi-types';
import * as vscode from 'vscode';
import { URI } from 'vscode-uri';
import { parse as yamlParse } from 'yaml';
import { OasDocumentParseFailed } from './errors';
import { type ProcessorInputOutput } from './oas/documentProcessorPipeline/processorStep';
import { OasDiagnosticsService } from './services/oasDiagnosticsService';

/**
 * Creates problem tab entries for an OAS document.
 * @param {string} fullPath - The full path to the OAS document.
 * @param {ProcessorInputOutput} processedOasResult - The processed OAS result.
 * @param {boolean} isESRDecomposed - Whether the ESR is decomposed.
 */
export const createProblemTabEntriesForOasDocument = Effect.fn('ApexOas.Diagnostics.createProblemTabEntries')(
  function* (fullPath: string, processedOasResult: ProcessorInputOutput, isESRDecomposed: boolean) {
    const uri = URI.file(fullPath);

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
      yield* OasDiagnosticsService.replace(uri, adjustErrors);
    }
  }
);

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
 * Parses an OAS document from a JSON string.
 * @param {string} doc - The JSON string representing the OAS document.
 * @returns {OpenAPIV3.Document} - The parsed OAS document.
 */
export const parseOASDocFromJson = Effect.fn('ApexOas.parseJson')(function* (doc: string) {
  return yield* Effect.try({
    try: () => JSON.parse(doc) as OpenAPIV3.Document,
    catch: cause => new OasDocumentParseFailed({ message: 'Generated OAS document is not valid JSON', cause })
  });
});

/**
 * Parses an OAS document from a YAML string.
 * @param {string} doc - The YAML string representing the OAS document.
 * @returns {OpenAPIV3.Document} - The parsed OAS document.
 */
export const parseOASDocFromYaml = Effect.fn('ApexOas.parseYaml')(function* (doc: string) {
  return yield* Effect.try({
    try: () => yamlParse(doc) as OpenAPIV3.Document,
    catch: cause => new OasDocumentParseFailed({ message: 'OAS document is not valid YAML', cause })
  });
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

export const getCurrentTimestamp = Effect.fn('ApexOas.getCurrentTimestamp')(function* () {
  const now = new Date(yield* Clock.currentTimeMillis);
  const month = String(now.getMonth() + 1).padStart(2, '0');
  const day = String(now.getDate()).padStart(2, '0');
  const year = now.getFullYear();
  const hours = String(now.getHours()).padStart(2, '0');
  const minutes = String(now.getMinutes()).padStart(2, '0');
  const seconds = String(now.getSeconds()).padStart(2, '0');
  const formattedDate = `${month}${day}${year}_${hours}${minutes}${seconds}`;
  return formattedDate;
});

/**
 * Validates if a registration provider type is one of the allowed values.
 * @param {string | undefined} providerType - The provider type to validate.
 * @returns {boolean} - True if the provider type is valid, false otherwise.
 */
export const isValidRegistrationProviderType = (providerType: string | undefined): boolean => {
  const validProviderTypes = ['Custom', 'AuraEnabled'];
  return isNotUndefined(providerType) && validProviderTypes.includes(providerType);
};
