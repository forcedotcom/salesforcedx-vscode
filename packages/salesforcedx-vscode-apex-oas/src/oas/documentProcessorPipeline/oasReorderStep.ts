/*
 * Copyright (c) 2025, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */

/* eslint-disable @typescript-eslint/consistent-type-assertions */

import type { OpenAPIV3 } from 'openapi-types';
import { ProcessorInputOutput, ProcessorStep } from './processorStep';

const REQUEST_BODY_KEYS_ORDER = ['description', 'required', 'content'];
const OPERATION_KEYS_ORDER = ['summary', 'description', 'operationId', 'parameters', 'requestBody', 'responses'];
const PATH_KEYS_ORDER = ['description'];
const INFO_KEYS_ORDER = ['title', 'version', 'description'];

const reorderKeys = (obj: Record<string, any>, keyOrder: string[]): Record<string, any> => {
  if (!obj || typeof obj !== 'object') return obj;
  const orderedEntries = keyOrder.filter(key => key in obj).map(key => [key, obj[key]]);
  const remainingEntries = Object.entries(obj).filter(([key]) => !keyOrder.includes(key));

  return Object.fromEntries([...orderedEntries, ...remainingEntries]);
};

export class OasReorderStep implements ProcessorStep {
  // OOPS: is async to satisfy the interface.
  // eslint-disable-next-line @typescript-eslint/require-await
  public async process(input: ProcessorInputOutput): Promise<ProcessorInputOutput> {
    const oas = input.openAPIDoc;

    // Reorder info section in top level
    const infoSection = oas.info;
    oas.info = reorderKeys(infoSection, INFO_KEYS_ORDER) as OpenAPIV3.InfoObject;

    oas.paths = Object.fromEntries(
      Object.entries(oas.paths).map(([path, pathItem]) => {
        if (!pathItem) return [path, pathItem];
        const pathObj: Record<string, any> = pathItem;
        Object.entries(pathObj).map(([method, operation]) => {
          if (operation && typeof operation === 'object') {
            const requestBody = (operation as OpenAPIV3.OperationObject).requestBody as OpenAPIV3.RequestBodyObject;
            // Reorder request body inside the operation object
            if (requestBody && typeof requestBody === 'object') {
              (operation as OpenAPIV3.OperationObject).requestBody = reorderKeys(
                requestBody,
                REQUEST_BODY_KEYS_ORDER
              ) as OpenAPIV3.RequestBodyObject;
            }
            // Reorder operations inside the path object
            pathObj[method] = reorderKeys(operation, OPERATION_KEYS_ORDER);
          }
        });
        // Reorder the entire path object
        return [path, reorderKeys(pathObj, PATH_KEYS_ORDER) as OpenAPIV3.PathsObject];
      })
    );

    return input;
  }
}
