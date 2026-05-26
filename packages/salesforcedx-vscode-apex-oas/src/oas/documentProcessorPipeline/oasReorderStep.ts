/*
 * Copyright (c) 2025, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */

/* eslint-disable @typescript-eslint/consistent-type-assertions, @typescript-eslint/no-explicit-any -- generic key-reordering helpers operate on heterogeneous OpenAPI nodes */

import type { ProcessorInputOutput } from './processorStep';
import * as Effect from 'effect/Effect';
import type { OpenAPIV3 } from 'openapi-types';

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

const reorderOperation = (operation: OpenAPIV3.OperationObject): Record<string, any> => {
  const requestBody = operation.requestBody as OpenAPIV3.RequestBodyObject | undefined;
  const reorderedRequestBody =
    requestBody && typeof requestBody === 'object'
      ? (reorderKeys(requestBody, REQUEST_BODY_KEYS_ORDER) as OpenAPIV3.RequestBodyObject)
      : requestBody;
  const withReorderedRequestBody = reorderedRequestBody
    ? { ...operation, requestBody: reorderedRequestBody }
    : operation;
  return reorderKeys(withReorderedRequestBody as Record<string, any>, OPERATION_KEYS_ORDER);
};

const reorderPathItem = (pathItem: OpenAPIV3.PathItemObject): OpenAPIV3.PathItemObject => {
  const reorderedMethods = Object.fromEntries(
    Object.entries(pathItem).map(([method, operation]) =>
      operation && typeof operation === 'object'
        ? [method, reorderOperation(operation as OpenAPIV3.OperationObject)]
        : [method, operation]
    )
  );
  return reorderKeys(reorderedMethods, PATH_KEYS_ORDER) as OpenAPIV3.PathItemObject;
};

export const oasReorderStep = Effect.fn('ApexOas.Process.oasReorder')(function* (input: ProcessorInputOutput) {
  const oas = input.openAPIDoc;
  const reorderedInfo = reorderKeys(oas.info, INFO_KEYS_ORDER) as OpenAPIV3.InfoObject;
  const reorderedPaths = Object.fromEntries(
    Object.entries(oas.paths).map(([path, pathItem]) =>
      pathItem ? [path, reorderPathItem(pathItem)] : [path, pathItem]
    )
  );
  return { ...input, openAPIDoc: { ...oas, info: reorderedInfo, paths: reorderedPaths } };
});
