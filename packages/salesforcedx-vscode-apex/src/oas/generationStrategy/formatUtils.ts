/*
 * Copyright (c) 2025, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */
import { JSONPath } from 'jsonpath-plus';
import { OpenAPIV3 } from 'openapi-types';
import { nls } from '../../messages';
import { cleanupGeneratedDoc, parseOASDocFromJson } from '../../oasUtils';
import { ApexOASMethodDetail, HttpRequestMethod, httpMethodMap, OpenAPIDoc } from '../schemas';

export const formatUrlPath = (parametersInPath: string[], urlMapping: string): string => {
  let updatedPath = urlMapping.replace(/\/$|\/\*$/, '').trim() || '';
  parametersInPath.forEach(parameter => {
    updatedPath += `/{${parameter}}`;
  });
  return updatedPath !== '' ? updatedPath : '/';
};

export const extractParametersInPath = (oas: OpenAPIV3.Document): string[] =>
  JSONPath<OpenAPIV3.ParameterObject[]>({ path: '$..parameters[?(@.in=="path")]', json: oas })
    .sort((param1, param2) => (param1.required === param2.required ? 0 : param1.required ? -1 : 1))
    .map(param => param.name);

export const excludeNon2xxResponses = (oas: OpenAPIV3.Document) => {
  JSONPath({
    path: '$.paths.*.*.responses',
    json: oas,
    callback: operation => {
      for (const [statusCode] of Object.entries(operation)) {
        if (!statusCode.startsWith('2')) {
          delete operation[statusCode];
        }
      }
    }
  });
};

// This check is compromised for TDX http deliverables
export const excludeUnrelatedMethods = (
  oas: OpenAPIV3.Document,
  methodName: string,
  methodsContextMap: Map<string, ApexOASMethodDetail>
) => {
  const httpMethod = getMethodTypeFromAnnotation(methodName, methodsContextMap);

  JSONPath({
    path: '$.paths.*', // Access each method under each path
    json: oas,
    callback: (operation, type, fullPath) => {
      for (const [method] of Object.entries(operation)) {
        if (method !== httpMethod) {
          delete operation[method];
        }
      }
    }
  });
};

export const getMethodTypeFromAnnotation = (
  methodName: string,
  methodsContextMap: Map<string, ApexOASMethodDetail>
): HttpRequestMethod => {
  const methodContext = methodsContextMap.get(methodName);
  if (methodContext) {
    const httpMethodAnnotation = methodContext.annotations.find(annotation =>
      ['HttpGet', 'HttpPost', 'HttpPut', 'HttpPatch', 'HttpDelete'].includes(annotation.name)
    );
    if (httpMethodAnnotation) {
      return httpMethodMap.get(httpMethodAnnotation.name) as HttpRequestMethod;
    }
  }
  throw new Error(nls.localize('method_not_found_in_doc_symbols', methodName));
};

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

export const combineYamlByMethod = (docs: string[], className: string) => {
  const combined: OpenAPIDoc = {
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

  for (const doc of docs) {
    try {
      const cleanedOASDoc = cleanupGeneratedDoc(doc);
      const parsed = parseOASDocFromJson(cleanedOASDoc);

      // Merge paths
      if (parsed.paths) {
        for (const [path, methods] of Object.entries(parsed.paths)) {
          if (!combined.paths[path]) {
            combined.paths[path] = {};
          }
          Object.assign(combined.paths[path], methods);
        }
      }
      // Merge components
      if (parsed.components?.schemas) {
        for (const [schema, definition] of Object.entries(parsed.components.schemas)) {
          if (!combined.components!.schemas![schema]) {
            combined.components!.schemas![schema] = definition as Record<string, any>;
          }
        }
      }
    } catch (e) {
      console.debug(e);
      throw e;
    }
  }

  return JSON.stringify(combined);
};
