/*
 * Copyright (c) 2026, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */

import type { TemplateCreateOutcome } from './metadata';
import type { CreateOutput } from '@salesforce/templates';

/**
 * Maps a @salesforce/templates CreateOutput to owned TemplateCreateOutcome format.
 *
 * @param output - CreateOutput from @salesforce/templates TemplateService.create()
 */
export const toTemplateCreateOutcome = (output: CreateOutput): TemplateCreateOutcome => ({
  outputDir: output.outputDir,
  created: output.created,
  rawOutput: output.rawOutput
});
