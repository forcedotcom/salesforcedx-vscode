/*
 * Copyright (c) 2025, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */

import { ProcessorInputOutput, ProcessorStep } from './processorStep';

export class CleanupYamlStep implements ProcessorStep {
  process(input: ProcessorInputOutput): Promise<ProcessorInputOutput> {
    const cleanedupYaml = this.cleanupYaml(input.yaml);

    return new Promise(resolve => {
      resolve({ ...input, yaml: cleanedupYaml });
    });
  }

  private cleanupYaml(doc: string): string {
    // Remove the first line of the document
    const openApiIndex = doc.indexOf('openapi');
    if (openApiIndex === -1) {
      throw new Error('Could not find openapi line in document:\n' + doc);
    }
    return doc
      .substring(openApiIndex)
      .split('\n')
      .filter(line => !/^```$/.test(line))
      .join('\n');
  }
}
