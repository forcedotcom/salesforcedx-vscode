/*
 * Copyright (c) 2025, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */

import type { OpenAPIV3 } from 'openapi-types';
import * as vscode from 'vscode';
import { ApexClassOASEligibleResponse, ApexClassOASGatherContextResponse } from '../schemas';
import { BetaInfoInjectionStep } from './betaInfoInjectionStep';
import { MethodValidationStep } from './methodValidationStep';
import { OasReorderStep } from './oasReorderStep';
import { OasValidationStep } from './oasValidationStep';
import { Pipeline } from './pipeline';
import { ProcessorInputOutput } from './processorStep';
import { PropertyCorrectionStep } from './propertyCorrectionStep';
import { ReconcileDuplicateSemanticPathsStep } from './reconcileDuplicateSemanticPathsStep';

type ProcessOasDocumentOptions = {
  context?: ApexClassOASGatherContextResponse;
  eligibleResult?: ApexClassOASEligibleResponse;
  isRevalidation?: boolean;
  betaInfo?: string;
};

export class OasProcessor {
  private document: OpenAPIV3.Document;
  private options?: ProcessOasDocumentOptions;
  public static diagnosticCollection: vscode.DiagnosticCollection =
    vscode.languages.createDiagnosticCollection('OAS Validations');
  constructor(document: OpenAPIV3.Document, options?: ProcessOasDocumentOptions) {
    this.document = document;
    this.options = options;
  }

  public async process(): Promise<ProcessorInputOutput> {
    const pipeline = !this.options?.isRevalidation
      ? new Pipeline(new PropertyCorrectionStep())
          .addStep(new BetaInfoInjectionStep(this.options?.betaInfo))
          .addStep(new ReconcileDuplicateSemanticPathsStep())
          .addStep(new MethodValidationStep())
          .addStep(new OasValidationStep())
          .addStep(new OasReorderStep())
      : new Pipeline(new ReconcileDuplicateSemanticPathsStep())
          .addStep(new MethodValidationStep())
          .addStep(new OasValidationStep())
          .addStep(new OasReorderStep());

    console.log('Executing pipeline with input:');
    console.log('document: ', this.document);
    const output = await pipeline.execute({
      openAPIDoc: this.document,
      errors: [],
      eligibilityResult: this.options?.eligibleResult,
      context: this.options?.context
    });
    console.log('Pipeline output:', output);
    return output;
  }
}
