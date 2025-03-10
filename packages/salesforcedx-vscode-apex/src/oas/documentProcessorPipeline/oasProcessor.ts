/*
 * Copyright (c) 2025, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */

import { OpenAPIV3 } from 'openapi-types';
import * as vscode from 'vscode';
import { ApexClassOASEligibleResponse } from '../schemas';
import { MethodValidationStep } from './methodValidationStep';
import { OasReorderStep } from './oasReorderStep';
import { OasValidationStep } from './oasValidationStep';
import { Pipeline } from './pipeline';
import { ProcessorInputOutput } from './processorStep';
import { PropertyCorrectionStep } from './propertyCorrectionStep';
import { ReconcileDuplicateSemanticPathsStep } from './reconcileDuplicateSemanticPathsStep';

export class OasProcessor {
  private document: OpenAPIV3.Document;
  private eligibilityResult?: ApexClassOASEligibleResponse;
  static diagnosticCollection: vscode.DiagnosticCollection =
    vscode.languages.createDiagnosticCollection('OAS Validations');
  constructor(document: OpenAPIV3.Document, eligibilityResult?: ApexClassOASEligibleResponse) {
    this.document = document;
    this.eligibilityResult = eligibilityResult;
  }

  async process(doCorrections = false): Promise<ProcessorInputOutput> {
    const pipeline = doCorrections
      ? new Pipeline(new PropertyCorrectionStep())
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
      eligibilityResult: this.eligibilityResult
    });
    console.log('Pipeline output:', output);
    return output;
  }
}
