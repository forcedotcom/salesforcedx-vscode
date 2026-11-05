/*
 * Copyright (c) 2026, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */

import { ExtensionProviderService, annotateRootSpan } from '@salesforce/effect-ext-utils';
import * as Data from 'effect/Data';
import * as Effect from 'effect/Effect';
import * as path from 'node:path';
import type { URI } from 'vscode-uri';
import { messages } from '../messages/i18n';
import { nls } from '../messages/nls';
import { processOasDocument } from '../oas/documentProcessorPipeline/oasProcessor';
import { generateEsrMD, pathExists } from '../oas/externalServiceRegistrationManager';
import { createAuraEnabledStrategy } from '../oas/generationStrategy/json/auraEnabledStrategy';
import { checkIfESRIsDecomposed, parseOASDocFromJson, summarizeDiagnostics, withSteppedProgress } from '../oasUtils';
import { type ProgressAndSuccessCommandKey } from '../utils/notificationMode';
import { analyzeMetadata, ClassNotEligible } from './metadataOrchestrator';

const COMMAND: ProgressAndSuccessCommandKey = messages.create_openapi_doc_class;

/** REST annotation-based OAS generation has been retired. @ExportTaggedError */
export class RestOASGenerationRetired extends Data.TaggedError('RestOASGenerationRetired')<{
  readonly message: string;
}> {}

/**
 * Creates an OpenAPI Document.
 */
export const createApexAction = Effect.fn('ApexOas.Command.createApexAction')(function* (sourceUri: URI | URI[]) {
  const api = yield* (yield* ExtensionProviderService).getServicesApi;
  const notificationMode = yield* api.services.NotificationModeService;

  // Step 1: Gather current source metadata and qualify AuraEnabled generation.
  const analysis = yield* analyzeMetadata(sourceUri);
  const className = path.basename(analysis.source.resourceUri.fsPath, '.cls');
  if (analysis.qualification.framework === 'restUnsupported') {
    return yield* new RestOASGenerationRetired({ message: nls.localize('rest_oas_gen_retired') });
  }
  if (analysis.qualification.framework === 'invalid') {
    return yield* new ClassNotEligible({
      message: nls.localize(
        'apex_class_not_valid_detail',
        className,
        qualificationReason(analysis.qualification.reason)
      )
    });
  }
  const qualification = analysis.qualification;

  // Step 3-4: AuraEnabled is the sole supported OAS generation framework.
  const strategy = yield* Effect.promise(() => createAuraEnabledStrategy(analysis.source.classContext));

  // Step 5: Determine filename
  const name = className;
  const openApiFileName = `${name}.externalServiceRegistration-meta.xml`;

  // Step 6: Check if the file already exists
  const fullPath = yield* pathExists(openApiFileName);

  // Steps 7-9 run inside a progress notification so the user sees activity between the folder prompt and final toast.
  const progressLocation = yield* notificationMode.getProgressLocation(COMMAND);
  const processedOasResult = yield* withSteppedProgress(
    nls.localize('generating_oas_progress_title', name),
    report =>
      Effect.gen(function* () {
        // Step 7: Use the strategy to generate the OAS
        yield* report(nls.localize('generating_oas_progress_generating'));
        const openApiDocument = yield* strategy.generateOAS();

        // Step 8: Process the OAS document
        yield* report(nls.localize('generating_oas_progress_processing'));
        const result = yield* processOasDocument(parseOASDocFromJson(openApiDocument), {
          eligibleMethodNames: qualification.methods.map(method => method.name),
          isRevalidation: false
        });

        // Step 9: Write OpenAPI Document to File
        yield* report(nls.localize('generating_oas_progress_writing'));
        yield* checkIfESRIsDecomposed().pipe(
          Effect.flatMap(isDecomposed => generateEsrMD(isDecomposed, result, fullPath))
        );
        return result;
      }),
    progressLocation
  );

  // Step 11: Gather metrics
  const overwrite = fullPath[0] === fullPath[1];
  const [errors, warnings, infos, hints, total] = summarizeDiagnostics(processedOasResult.errors);

  yield* annotateRootSpan({
    overwrite,
    documentTtlProblems: total,
    documentErrors: errors,
    documentWarnings: warnings,
    documentInfo: infos,
    documentHints: hints,
    command: 'SFDX: Create OpenAPI Document from This Class'
  });

  // Step 12: Notify Success — overwrite means user replaced the original ESR; otherwise a merge file was emitted alongside
  const message = overwrite
    ? nls.localize('openapi_doc_created', 'class', name)
    : nls.localize(
        'openapi_doc_created_merge',
        'class',
        path.basename(fullPath[1], '.externalServiceRegistration-meta.xml'),
        name
      );
  yield* notificationMode.showSuccessNotification(COMMAND, message);
});

const qualificationReason = (reason: 'classAnnotationsBlockAura' | 'noEligibleMethods') =>
  ({
    classAnnotationsBlockAura: 'its @AuraEnabled methods are blocked by class-level annotations',
    noEligibleMethods: 'it has no methods annotated for OpenAPI generation'
  })[reason];
