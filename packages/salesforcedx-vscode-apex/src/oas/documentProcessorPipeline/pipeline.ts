/*
 * Copyright (c) 2025, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */
import { ProcessorInputOutput, ProcessorStep } from './processorStep';

export class Pipeline {
  private steps: ProcessorStep[] = [];

  constructor(currentStep: ProcessorStep) {
    this.steps.push(currentStep);
  }

  addStep(newStep: ProcessorStep) {
    this.steps.push(newStep);
    return this;
  }

  async execute(input: ProcessorInputOutput) {
    let output: ProcessorInputOutput = input;
    for (const step of this.steps) {
      output = await step.process(output);
    }
    return output;
  }
}
