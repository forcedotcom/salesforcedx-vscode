/*
 * Copyright (c) 2025, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */
import { OpenAPIV3 } from 'openapi-types';
import * as vscode from 'vscode';
import { ApexClassOASEligibleResponse, ApexClassOASGatherContextResponse } from '../schemas';

export interface ProcessorInputOutput {
  openAPIDoc: OpenAPIV3.Document;
  errors: vscode.Diagnostic[];
  readonly eligibilityResult?: ApexClassOASEligibleResponse;
}

export interface ProcessorStep {
  process(input: ProcessorInputOutput): Promise<ProcessorInputOutput>;
}
