/*
 * Copyright (c) 2025, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */
import * as Effect from 'effect/Effect';
import { JSONPath } from 'jsonpath-plus';
import type { OpenAPIV3 } from 'openapi-types';
import { MethodNotFoundInDocSymbols } from '../../errors';
import { nls } from '../../messages/nls';
import { cleanupGeneratedDoc, parseOASDocFromJson } from '../../oasUtils';
import { ApexOASMethodDetail, httpMethodMap } from '../schemas';

export const formatUrlPath = (parametersInPath: string[], urlMapping: string): string => {
  const base = urlMapping.replace(/\/$|\/\*$/, '').trim();
  const updatedPath = [base, ...parametersInPath.map(p => `{${p}}`)].join('/');
  return updatedPath !== '' ? updatedPath : '/';
};

export const extractParametersInPath = (oas: OpenAPIV3.Document): string[] =>
  JSONPath<OpenAPIV3.ParameterObject[]>({ path: '$..parameters[?(@.in=="path")]', json: oas })
    .toSorted((param1, param2) => (param1.required === param2.required ? 0 : param1.required ? -1 : 1))
    .map(param => param.name);

export const excludeNon2xxResponses = (oas: OpenAPIV3.Document) => {
  JSONPath({
    path: '$.paths.*.*.responses',
    json: oas,
    callback: operation => {
      Object.keys(operation)
        .filter(statusCode => !statusCode.startsWith('2'))
        .forEach(statusCode => {
          delete operation[statusCode];
        });
    }
  });
};

// This check is compromised for TDX http deliverables
/** side effect: mutates the input OAS document */
export const excludeUnrelatedMethods = Effect.fn('ApexOas.Format.excludeUnrelatedMethods')(function* (
  oas: OpenAPIV3.Document,
  methodName: string,
  methodsContextMap: Map<string, ApexOASMethodDetail>
) {
  const httpMethod = yield* getMethodTypeFromAnnotation(methodName, methodsContextMap);

  JSONPath({
    path: '$.paths.*', // Access each method under each path
    json: oas,
    callback: (operation, _type, _fullPath) => {
      Object.keys(operation)
        .filter(method => method !== httpMethod)
        .forEach(method => {
          delete operation[method];
        });
    }
  });
});

export const getMethodTypeFromAnnotation = Effect.fn('ApexOas.Format.getMethodTypeFromAnnotation')(function* (
  methodName: string,
  methodsContextMap: Map<string, ApexOASMethodDetail>
) {
  const methodContext = methodsContextMap.get(methodName);
  const httpMethodAnnotation = methodContext?.annotations.find(a => Object.keys(httpMethodMap).includes(a.name));
  return httpMethodAnnotation
    ? httpMethodMap[httpMethodAnnotation.name]
    : yield* new MethodNotFoundInDocSymbols({
        message: nls.localize('method_not_found_in_doc_symbols', methodName)
      });
});

export const updateOperationIds = (oas: OpenAPIV3.Document, methodName: string) => {
  JSONPath({
    path: '$.paths.*.*',
    json: oas,
    callback: operation => {
      if (operation) {
        operation.operationId = methodName;
      }
    }
  });
};

export const combineYamlByMethod = Effect.fn('ApexOas.Format.combineYamlByMethod')(function* (
  docs: readonly string[],
  className: string
) {
  const combined: OpenAPIV3.Document = {
    openapi: '3.0.0',
    servers: [
      {
        url: '/services/apexrest/'
      }
    ],

    info: {
      title: className,
      version: '1.0.0',
      description: `This is auto-generated OpenAPI v3 spec for ${className}.`
    },
    paths: {}
  };

  yield* Effect.forEach(docs, doc =>
    Effect.gen(function* () {
      const cleanedOASDoc = yield* cleanupGeneratedDoc(doc);
      const parsed = parseOASDocFromJson(cleanedOASDoc);

      // Merge paths
      if (parsed.paths) {
        Object.entries(parsed.paths).forEach(([path, methods]) => {
          combined.paths[path] ??= {};
          Object.assign(combined.paths[path], methods);
        });
      }
      // Merge components
      if (parsed.components?.schemas && combined.components?.schemas) {
        Object.entries(parsed.components.schemas).forEach(([schema, definition]) => {
          combined.components!.schemas![schema] ??= definition;
        });
      }
    })
  );

  return JSON.stringify(combined);
});
