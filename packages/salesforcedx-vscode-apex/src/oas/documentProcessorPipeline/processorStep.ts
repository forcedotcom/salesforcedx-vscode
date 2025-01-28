/*
 * Copyright (c) 2025, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */

import { ISpectralDiagnostic } from '@stoplight/spectral-core';
import { ApexClassOASEligibleResponse, ApexClassOASGatherContextResponse } from '../schemas';

export interface ProcessorInputOutput {
  yaml: string;
  errors?: ISpectralDiagnostic[];
  eligibilityResult: ApexClassOASEligibleResponse;
  context: ApexClassOASGatherContextResponse;
}

export interface ProcessorStep {
  process(input: ProcessorInputOutput): Promise<ProcessorInputOutput>;
}
