/*
 * Copyright (c) 2025, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */
import { ExtensionProviderService } from '@salesforce/effect-ext-utils';
import * as Effect from 'effect/Effect';
import { XMLParser } from 'fast-xml-parser';
import * as path from 'node:path';
import * as vscode from 'vscode';
import type { URI } from 'vscode-uri';
import { OasValidationFailed } from '../errors';
import { nls } from '../messages/nls';
import { processOasDocument } from '../oas/documentProcessorPipeline/oasProcessor';
import {
  checkIfESRIsDecomposed,
  createProblemTabEntriesForOasDocument,
  isValidRegistrationProviderType,
  parseOASDocFromYaml
} from '../oasUtils';

const ensureValidRegistrationProviderType = Effect.fn('ApexOas.OasChecker.ensureValidRegistrationProviderType')(
  function* (xmlFilePath: string) {
    const api = yield* (yield* ExtensionProviderService).getServicesApi;
    const xmlContent = yield* api.services.FsService.readFile(xmlFilePath).pipe(Effect.catchAll(() => Effect.void));
    if (!xmlContent) {
      return yield* new OasValidationFailed({ message: nls.localize('invalid_file_for_generating_oas_doc') });
    }
    const parser = new XMLParser();
    const jsonObj = parser.parse(xmlContent);
    const registrationProviderType = jsonObj.ExternalServiceRegistration?.registrationProviderType;
    if (
      !isValidRegistrationProviderType(
        typeof registrationProviderType === 'string' ? registrationProviderType : undefined
      )
    ) {
      return yield* new OasValidationFailed({ message: nls.localize('invalid_file_for_generating_oas_doc') });
    }
  }
);

/**
 * Checks if the file path is eligible for OAS validation, failing with OasValidationFailed when not.
 */
const ensureFilePathEligible = Effect.fn('ApexOas.OasChecker.ensureFilePathEligible')(function* (fullPath: string) {
  if (!(fullPath.endsWith('.yaml') || fullPath.endsWith('.externalServiceRegistration-meta.xml'))) {
    return yield* new OasValidationFailed({ message: nls.localize('invalid_file_for_generating_oas_doc') });
  }
  const xmlFilePath = fullPath.endsWith('.xml')
    ? fullPath
    : path.join(
        path.dirname(fullPath),
        `${path.basename(fullPath).split('.')[0]}.externalServiceRegistration-meta.xml`
      );
  yield* ensureValidRegistrationProviderType(xmlFilePath);
});

/**
 * Validates an OpenAPI Document.
 */
export const validateOpenApiDocument = Effect.fn('ApexOas.Command.validateOpenApiDocument')(function* (
  sourceUri: URI | URI[]
) {
  if (Array.isArray(sourceUri)) {
    return yield* new OasValidationFailed({ message: nls.localize('invalid_file_for_generating_oas_doc') });
  }
  const api = yield* (yield* ExtensionProviderService).getServicesApi;
  const fsService = api.services.FsService;
  const fullPath = sourceUri
    ? sourceUri.fsPath
    : yield* api.services.EditorService.getActiveEditorUri().pipe(
        Effect.map(uri => uri.fsPath),
        Effect.catchTag('NoActiveEditorError', () => Effect.succeed(''))
      );

  // Step 1: Validate eligibility
  yield* ensureFilePathEligible(fullPath);

  // Step 2: Extract openAPI document if embedded inside xml
  const openApiDocument = yield* Effect.gen(function* () {
    if (fullPath.endsWith('.xml')) {
      const xmlContent = yield* fsService.readFile(fullPath);
      const parser = new XMLParser();
      const jsonObj = parser.parse(xmlContent);
      const schema: unknown = jsonObj.ExternalServiceRegistration?.schema;
      return typeof schema === 'string' ? schema : undefined;
    }
    return yield* fsService.readFile(fullPath);
  });

  if (!openApiDocument) {
    return yield* new OasValidationFailed({ message: nls.localize('no_oas_doc_in_file') });
  }

  // Step 3: Process the OAS document
  const isESRDecomposed = yield* checkIfESRIsDecomposed();
  const processedOasResult = yield* processOasDocument(parseOASDocFromYaml(openApiDocument), {
    context: undefined,
    eligibleResult: undefined,
    isRevalidation: true
  });

  // Step 4: Report/Refresh problems found
  createProblemTabEntriesForOasDocument(fullPath, processedOasResult, isESRDecomposed);

  // Step 5: Notify Success
  yield* Effect.promise(() =>
    vscode.window.showInformationMessage(nls.localize('check_openapi_doc_succeeded', path.basename(fullPath)))
  );
});
