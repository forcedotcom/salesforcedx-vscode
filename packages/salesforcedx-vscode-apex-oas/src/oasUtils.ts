/*
 * Copyright (c) 2026, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */
/* eslint-disable @typescript-eslint/consistent-type-assertions */

import { ExtensionProviderService } from '@salesforce/effect-ext-utils';
import * as Effect from 'effect/Effect';
import { isNotUndefined } from 'effect/Predicate';
import * as Runtime from 'effect/Runtime';
import type { OpenAPIV3 } from 'openapi-types';
import * as vscode from 'vscode';
import { URI } from 'vscode-uri';
import { parse as yamlParse } from 'yaml';
import { oasDiagnosticCollection, type ProcessorInputOutput } from './oas/documentProcessorPipeline/processorStep';

/** Reports a step message into an active progress notification. */
export type ProgressReporter = (message: string) => Effect.Effect<void>;

/**
 * Runs `body` inside a non-cancellable VS Code progress notification, giving it a `report` callback to update
 * the notification message per step. Without this, long operations show no sign of
 * life between the folder prompt and the final toast. The notification closes when the Effect settles.
 * @param title - The notification title shown for the whole operation.
 * @param body - Receives `report` and returns the Effect to run; its message updates the notification.
 * @param location - Where to show the progress (toast vs status bar); defaults to a toast notification.
 */
export const withSteppedProgress = <A, E, R>(
  title: string,
  body: (report: ProgressReporter) => Effect.Effect<A, E, R>,
  location: vscode.ProgressLocation = vscode.ProgressLocation.Notification
) =>
  Effect.runtime<R>().pipe(
    Effect.flatMap(runtime =>
      Effect.async<A, E>(resume => {
        void vscode.window.withProgress({ location, title, cancellable: false }, progress => {
          const report: ProgressReporter = message => Effect.sync(() => progress.report({ message }));
          return Runtime.runPromiseExit(runtime)(body(report)).then(exit => {
            resume(exit._tag === 'Success' ? Effect.succeed(exit.value) : Effect.failCause(exit.cause));
          });
        });
      })
    )
  );

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
 * Validates if a registration provider type is one of the allowed values.
 * @param {string | undefined} providerType - The provider type to validate.
 * @returns {boolean} - True if the provider type is valid, false otherwise.
 */
export const isValidRegistrationProviderType = (providerType: string | undefined): boolean => {
  const validProviderTypes = ['Custom', 'AuraEnabled'];
  return isNotUndefined(providerType) && validProviderTypes.includes(providerType);
};
