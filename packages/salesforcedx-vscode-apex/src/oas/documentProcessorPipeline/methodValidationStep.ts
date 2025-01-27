/*
 * Copyright (c) 2025, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */

import * as yaml from 'yaml';
import { ApexClassOASEligibleResponse, OpenAPIDoc } from '../schemas';
import { ProcessorInputOutput, ProcessorStep } from './processorStep';
export class MethodValidationStep implements ProcessorStep {
  process(input: ProcessorInputOutput): Promise<ProcessorInputOutput> {
    const cleanedupYaml = this.validateMethods(input.yaml, input.eligibilityResult);

    return new Promise(resolve => {
      resolve({ ...input, yaml: cleanedupYaml });
    });
  }

  private validateMethods(doc: string, eligibilityResult: ApexClassOASEligibleResponse): string {
    const symbols = eligibilityResult.symbols;
    if (!symbols || symbols.length === 0) {
      throw new Error('No eligible methods found in the class');
    }
    const methodNames = new Set(
      symbols.filter(symbol => symbol.isApexOasEligible).map(symbol => symbol.docSymbol.name)
    );

    let parsed = null;
    try {
      parsed = yaml.parse(doc) as OpenAPIDoc;
    } catch (e) {
      throw new Error('Failed to parse the document as JSON');
    }

    for (const [path, methods] of Object.entries(parsed.paths)) {
      const methodName = path.split('/').pop();
      // make sure all eligible methods are present in the document
      if (!methodName || !methodNames.has(methodName)) {
        throw new Error(`Method ${methodName} is not eligible for OAS generation, but present in the document`);
      }
      methodNames.delete(methodName);
      // only one operation is allowed per path
      if (Object.keys(methods).length !== 1) {
        throw new Error(`Method ${methodName} does not have exactly one operation`);
      }
    }

    if (methodNames.size > 0) {
      throw new Error(
        `Methods ${Array.from(methodNames).join(', ')} are eligible for OAS generation, but missing in the document`
      );
    }
    return doc;
  }
}
