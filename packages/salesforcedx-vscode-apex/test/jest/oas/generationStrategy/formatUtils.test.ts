/*
 * Copyright (c) 2025, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */
import { nls } from '../../../../src/messages';
import {
  combineYamlByMethod,
  excludeNon2xxResponses,
  excludeUnrelatedMethods,
  extractParametersInPath,
  formatUrlPath,
  getMethodTypeFromAnnotation,
  updateOperationIds
} from '../../../../src/oas/generationStrategy/formatUtils';
import { ApexOASMethodDetail } from '../../../../src/oas/schemas';

describe('formatUrlPath', () => {
  it('should format the URL path correctly with parameters', () => {
    const parametersInPath = ['param1', 'param2'];
    const urlMapping = '/api/resource/';
    const result = formatUrlPath(parametersInPath, urlMapping);
    expect(result).toBe('/api/resource/{param1}/{param2}');
  });

  it('should format the URL path correctly without trailing slash or asterisk', () => {
    const parametersInPath = ['param1'];
    const urlMapping = '/api/resource';
    const result = formatUrlPath(parametersInPath, urlMapping);
    expect(result).toBe('/api/resource/{param1}');
  });

  it('should return root path if urlMapping is empty', () => {
    const parametersInPath: string[] = [];
    const urlMapping = '';
    const result = formatUrlPath(parametersInPath, urlMapping);
    expect(result).toBe('/');
  });

  it('should handle urlMapping with only asterisk', () => {
    const parametersInPath = ['param1'];
    const urlMapping = '/*';
    const result = formatUrlPath(parametersInPath, urlMapping);
    expect(result).toBe('/{param1}');
  });

  it('should handle urlMapping with only slash', () => {
    const parametersInPath = ['param1'];
    const urlMapping = '/';
    const result = formatUrlPath(parametersInPath, urlMapping);
    expect(result).toBe('/{param1}');
  });

  it('should handle urlMapping with only slash without params', () => {
    const urlMapping = '/';
    const result = formatUrlPath([], urlMapping);
    expect(result).toBe('/');
  });
});

describe('extractParametersInPath', () => {
  it('should extract parameters in path correctly', () => {
    // Mock OpenAPIV3.Document
    const oas = {
      paths: {
        '/api/resource/{param1}/{param2}': {
          get: {
            parameters: [
              { name: 'param1', in: 'path', required: true },
              { name: 'param2', in: 'path', required: true }
            ]
          }
        }
      }
    } as any;

    const result = extractParametersInPath(oas);
    expect(result).toEqual(['param1', 'param2']);
  });

  it('should sort parameters correctly', () => {
    // Mock OpenAPIV3.Document
    const oas = {
      paths: {
        '/api/resource/{param1}/{param2}': {
          get: {
            parameters: [
              { name: 'param1', in: 'path', required: false },
              { name: 'param2', in: 'path', required: true }
            ]
          }
        }
      }
    } as any;

    const result = extractParametersInPath(oas);
    expect(result).toEqual(['param2', 'param1']);
  });

  it('should return empty array if no parameters in path', () => {
    // Mock OpenAPIV3.Document
    const oas = {
      paths: {
        '/api/resource': {
          get: {}
        }
      }
    } as any;

    const result = extractParametersInPath(oas);
    expect(result).toEqual([]);
  });

  it('should handle invalid OAS structure gracefully', () => {
    // Mock OpenAPIV3.Document
    const oas = {
      paths: {}
    } as any;

    const result = extractParametersInPath(oas);
    expect(result).toEqual([]);
  });
});

describe('excludeNon2xxResponses', () => {
  it('should exclude non-2xx responses', () => {
    // Mock OpenAPIV3.Document
    const oas = {
      paths: {
        '/api/resource': {
          get: {
            responses: {
              200: { description: 'OK' },
              404: { description: 'Not Found' },
              500: { description: 'Internal Server Error' }
            }
          }
        }
      }
    } as any;

    excludeNon2xxResponses(oas);
    expect(oas.paths['/api/resource'].get.responses).toEqual({
      200: { description: 'OK' }
    });
  });

  it('should handle empty responses gracefully', () => {
    // Mock OpenAPIV3.Document
    const oas = {
      paths: {
        '/api/resource': {
          get: {}
        }
      }
    } as any;

    excludeNon2xxResponses(oas);
    expect(oas.paths['/api/resource'].get.responses).toBe(undefined);
  });

  it('should handle invalid OAS structure gracefully', () => {
    // Mock OpenAPIV3.Document
    const oas = {
      paths: {}
    } as any;

    excludeNon2xxResponses(oas);
    expect(oas.paths).toEqual({});
  });
});

describe('getMethodTypeFromAnnotation', () => {
  it('should return the correct HTTP method for a valid annotation', () => {
    const methodName = 'HttpGet';
    const methodsContextMap = new Map<string, ApexOASMethodDetail>([
      [
        methodName,
        {
          annotations: [{ name: 'HttpGet' }]
        } as ApexOASMethodDetail
      ]
    ]);

    const result = getMethodTypeFromAnnotation(methodName, methodsContextMap);
    expect(result).toBe('get');
  });

  it('should throw an error for an invalid annotation', () => {
    const methodName = 'InvalidMethod';
    const methodsContextMap = new Map<string, ApexOASMethodDetail>([
      [
        methodName,
        {
          annotations: [{ name: 'InvalidAnnotation' }]
        } as ApexOASMethodDetail
      ]
    ]);

    expect(() => getMethodTypeFromAnnotation(methodName, methodsContextMap)).toThrowError(
      nls.localize('method_not_found_in_doc_symbols', methodName)
    );
  });
});

describe('excludeUnrelatedMethods', () => {
  it('should exclude unrelated methods', () => {
    // Mock OpenAPIV3.Document
    const oas = {
      paths: {
        '/api/resource': {
          get: {},
          post: {}
        }
      }
    } as any;

    const methodName = 'SomeMethod';
    const methodsContextMap = new Map<string, ApexOASMethodDetail>([
      [
        methodName,
        {
          annotations: [{ name: 'HttpGet' }]
        } as ApexOASMethodDetail
      ]
    ]);

    excludeUnrelatedMethods(oas, methodName, methodsContextMap);
    expect(oas.paths['/api/resource']).toEqual({
      get: {}
    });
  });

  it('should handle empty OAS gracefully', () => {
    // Mock OpenAPIV3.Document
    const oas = {
      paths: {}
    } as any;

    const methodName = 'SomeMethod';
    const methodsContextMap = new Map<string, ApexOASMethodDetail>([
      [
        methodName,
        {
          annotations: [{ name: 'HttpGet' }]
        } as ApexOASMethodDetail
      ]
    ]);

    excludeUnrelatedMethods(oas, methodName, methodsContextMap);
    expect(oas.paths).toEqual({});
  });
});

describe('updateOperationIds', () => {
  it('should update operation IDs correctly', () => {
    // Mock OpenAPIV3.Document
    const oas = {
      paths: {
        '/api/resource': {
          get: {},
          post: {}
        }
      }
    } as any;

    const methodName = 'SomeMethod';
    updateOperationIds(oas, methodName);
    expect(oas.paths['/api/resource'].get.operationId).toBe(methodName);
    expect(oas.paths['/api/resource'].post.operationId).toBe(methodName);
  });

  it('should handle empty OAS gracefully', () => {
    // Mock OpenAPIV3.Document
    const oas = {
      paths: {}
    } as any;

    const methodName = 'SomeMethod';
    updateOperationIds(oas, methodName);
    expect(oas.paths).toEqual({});
  });
});

describe('combineYamlByMethod', () => {
  it('should combine YAML content correctly', () => {
    const doc1 =
      '{ "openapi": "3.0.0", "info": { "title": "Salesforce REST API", "version": "1.0.0" }, "servers": [ { "url": "/services/apexrest" , "description": "Server URL"}], "paths": { "/apex-rest-examples/v1/Cases/{case_id}": { "get": { "description": "Retrieve a Case record by its External ID", "operationId": "getCaseById", "responses": { "200": { "description": "OK", "content": { "application/json": { "schema": { "type": "object", "properties": { "CaseNumber": { "type": "string" }, "Subject": { "type": "string" }, "Status": { "type": "string" }, "Origin": { "type": "string" }, "Priority": { "type": "string" } } } } } }, "404": { "description": "NOT_FOUND", "content": { "application/json": { "schema": { "type": "object", "properties": { "message": { "type": "string" } } } } } } }, "parameters": [ { "name": "case_id", "in": "path", "required": true, "description": "Case ID (15 or 18 character Salesforce ID, or External Id)", "schema": { "type": "string" } } ] } } } }';
    const doc2 =
      '{\n\n\n"openapi": "3.0.0",\n"info": {\n"title": "apex-rest-examples",\n"version": "1.0.0"\n},\n"paths": {\n"/apex-rest-examples/v1/Cases": {\n"post": {\n"operationId": "createCase",\n"description": "createCase",\n"responses": {\n"200": {\n"description": "",\n"content": {\n"application/json": {\n"schema": {\n"type": "string"\n}\n}\n}\n},\n"400": {\n"description": "Bad Request"\n},\n"401": {\n"description": "Not Authorized"\n}\n},\n"parameters": [],\n"requestBody": {\n"description": "Request body for createCase",\n"content": {\n"application/json": {\n"schema": {\n"type": "object",\n"required": [\n"subject",\n"status",\n"origin",\n"priority"\n],\n"properties": {\n"subject": {\n"type": "string"\n},\n"status": {\n"type": "string"\n},\n"origin": {\n"type": "string"\n},\n"priority": {\n"type": "string"\n}\n}\n}\n}\n}\n}\n}\n}\n}}';
    const combinedYaml = combineYamlByMethod([doc1, doc2], 'CaseManager');

    expect(JSON.stringify(combinedYaml)).toEqual(
      '"{\\"openapi\\":\\"3.0.0\\",\\"servers\\":[{\\"url\\":\\"/services/apexrest/\\"}],\\"info\\":{\\"title\\":\\"CaseManager\\",\\"version\\":\\"1.0.0\\",\\"description\\":\\"This is auto-generated OpenAPI v3 spec for CaseManager.\\"},\\"paths\\":{\\"/apex-rest-examples/v1/Cases/{case_id}\\":{\\"get\\":{\\"description\\":\\"Retrieve a Case record by its External ID\\",\\"operationId\\":\\"getCaseById\\",\\"responses\\":{\\"200\\":{\\"description\\":\\"OK\\",\\"content\\":{\\"application/json\\":{\\"schema\\":{\\"type\\":\\"object\\",\\"properties\\":{\\"CaseNumber\\":{\\"type\\":\\"string\\"},\\"Subject\\":{\\"type\\":\\"string\\"},\\"Status\\":{\\"type\\":\\"string\\"},\\"Origin\\":{\\"type\\":\\"string\\"},\\"Priority\\":{\\"type\\":\\"string\\"}}}}}},\\"404\\":{\\"description\\":\\"NOT_FOUND\\",\\"content\\":{\\"application/json\\":{\\"schema\\":{\\"type\\":\\"object\\",\\"properties\\":{\\"message\\":{\\"type\\":\\"string\\"}}}}}}},\\"parameters\\":[{\\"name\\":\\"case_id\\",\\"in\\":\\"path\\",\\"required\\":true,\\"description\\":\\"Case ID (15 or 18 character Salesforce ID, or External Id)\\",\\"schema\\":{\\"type\\":\\"string\\"}}]}},\\"/apex-rest-examples/v1/Cases\\":{\\"post\\":{\\"operationId\\":\\"createCase\\",\\"description\\":\\"createCase\\",\\"responses\\":{\\"200\\":{\\"description\\":\\"\\",\\"content\\":{\\"application/json\\":{\\"schema\\":{\\"type\\":\\"string\\"}}}},\\"400\\":{\\"description\\":\\"Bad Request\\"},\\"401\\":{\\"description\\":\\"Not Authorized\\"}},\\"parameters\\":[],\\"requestBody\\":{\\"description\\":\\"Request body for createCase\\",\\"content\\":{\\"application/json\\":{\\"schema\\":{\\"type\\":\\"object\\",\\"required\\":[\\"subject\\",\\"status\\",\\"origin\\",\\"priority\\"],\\"properties\\":{\\"subject\\":{\\"type\\":\\"string\\"},\\"status\\":{\\"type\\":\\"string\\"},\\"origin\\":{\\"type\\":\\"string\\"},\\"priority\\":{\\"type\\":\\"string\\"}}}}}}}}}}"'
    );
  });
});
