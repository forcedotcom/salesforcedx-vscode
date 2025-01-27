/*
 * Copyright (c) 2025, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */

import { parse, stringify } from 'yaml';
import { nls } from '../../messages';
import { ProcessorInputOutput, ProcessorStep } from './processorStep';

export class CleanupYamlStep implements ProcessorStep {
  process(input: ProcessorInputOutput): Promise<ProcessorInputOutput> {
    const cleanedupYaml = this.cleanupYaml(input.yaml);
    const yamlWithOperationsIds = this.makeSureOperationIdsArePresent(cleanedupYaml);

    return new Promise(resolve => {
      resolve({ ...input, yaml: yamlWithOperationsIds });
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

  private makeSureOperationIdsArePresent = (oasSpec: string): string => {
    const parsed = parse(oasSpec);
    if (!parsed?.paths) {
      throw new Error(nls.localize('error_parsing_yaml'));
    }

    // Add operationId where it's missing
    Object.keys(parsed.paths).forEach(p => {
      Object.keys(parsed.paths[p]).forEach(method => {
        const operation = parsed.paths[p][method];
        if (!operation.operationId) {
          operation.operationId = p.split('/').filter(Boolean).pop(); // Fallback to the last part of the path
        }
      });
    });

    // Convert the modified YAML object back to a string
    return stringify(parsed);
  };
}
