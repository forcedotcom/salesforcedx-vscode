/*
 * Copyright (c) 2025, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */

import { OpenAPIV3 } from 'openapi-types';
import { ProcessorInputOutput, ProcessorStep } from './processorStep';

export class MissingPropertiesInjectorStep implements ProcessorStep {
  process(input: ProcessorInputOutput): Promise<ProcessorInputOutput> {
    const yamlWithOperationsIds = this.makeSureOperationIdsArePresent(input.yaml);

    return new Promise(resolve => {
      resolve({ ...input, yaml: yamlWithOperationsIds });
    });
  }

  private makeSureOperationIdsArePresent = (oasSpec: OpenAPIV3.Document): OpenAPIV3.Document => {
    if (!oasSpec?.paths) {
      return oasSpec;
    }

    // Add operationId where it's missing
    Object.entries(oasSpec.paths).forEach(([path, pathItem]) => {
      if (pathItem) {
        Object.entries(pathItem).forEach(([method, operation]) => {
          if (!(operation as OpenAPIV3.OperationObject).operationId) {
            (operation as OpenAPIV3.OperationObject).operationId = path.split('/').filter(Boolean).pop(); // Fallback to the last part of the path
          }
        });
      }
    });

    // Convert the modified YAML object back to a string
    return oasSpec;
  };
}
