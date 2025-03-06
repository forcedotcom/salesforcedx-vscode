/*
 * Copyright (c) 2025, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */
import { OpenAPIV3 } from 'openapi-types';
import { ProcessorInputOutput, ProcessorStep } from './processorStep';

const OPERATION_KEYS_ORDER = ['summary', 'description', 'operationId', 'parameters', 'requestBody', 'responses'];
const PATH_KEYS_ORDER = ['description'];

const reorderKeys = (obj: Record<string, any>, keyOrder: string[]): Record<string, any> => {
  if (!obj || typeof obj !== 'object') return obj;

  const orderedEntries = keyOrder.filter(key => key in obj).map(key => [key, obj[key]]);
  const remainingEntries = Object.entries(obj).filter(([key]) => !keyOrder.includes(key));

  return Object.fromEntries([...orderedEntries, ...remainingEntries]);
};

export class OasReorderStep implements ProcessorStep {
  async process(input: ProcessorInputOutput): Promise<ProcessorInputOutput> {
    const oas = input.openAPIDoc;

    for (const path in oas.paths) {
      let pathItem = oas.paths[path] as OpenAPIV3.PathsObject;

      // Reorder operations inside the path object
      for (const method of Object.keys(pathItem) as (keyof typeof pathItem)[]) {
        const operation = pathItem[method];
        if (operation && typeof operation === 'object') {
          pathItem[method] = reorderKeys(operation, OPERATION_KEYS_ORDER) as OpenAPIV3.OperationObject;
        }
      }

      // Reorder the entire path object
      pathItem = reorderKeys(pathItem, PATH_KEYS_ORDER) as OpenAPIV3.PathsObject;
      oas.paths[path] = pathItem;
    }

    return input;
  }
}
