/*
 * Copyright (c) 2025, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */
import { JSONPath } from 'jsonpath-plus';
import type { OpenAPIV3 } from 'openapi-types';
import { ProcessorInputOutput, ProcessorStep } from './processorStep';

export class ReconcileDuplicateSemanticPathsStep implements ProcessorStep {
  public process(input: ProcessorInputOutput): Promise<ProcessorInputOutput> {
    const fixedOASDoc = this.resolvePathsThatAreSemanticallyEqual(input.openAPIDoc);

    return new Promise(resolve => {
      resolve({ ...input, openAPIDoc: fixedOASDoc });
    });
  }

  private resolvePathsThatAreSemanticallyEqual(doc: OpenAPIV3.Document): OpenAPIV3.Document {
    const newPaths: Record<string, OpenAPIV3.PathItemObject> = {};
    const paramNames: Record<string, string> = {};

    const pathsToFix = this.getPathsToFix(doc);

    JSONPath({
      path: '$.paths',
      json: doc,
      resultType: 'all',
      callback: ({ value }: { value: Record<string, OpenAPIV3.PathItemObject> }) => {
        Object.entries(value).forEach(([methodPath, methodValues]) => {
          const fromName = this.getNameFromPath(methodPath);
          const toName = this.getNameFromPath(pathsToFix[methodPath] ?? methodPath);
          const paramName = toName ?? fromName ?? 'param';
          const newPath = pathsToFix[methodPath] ?? methodPath;

          newPaths[newPath] = { ...newPaths[newPath], ...methodValues };

          // Store the parameter name for the new path
          if (!paramNames[newPath]) {
            paramNames[newPath] = paramName;
          }

          // Update parameter names to match the new path
          JSONPath({
            path: "$..parameters[?(@.in=='path')]",
            json: methodValues,
            resultType: 'all',
            callback: ({ value: paramValue }: { value: OpenAPIV3.ParameterObject }) => {
              paramValue.name = paramName;
            }
          });
        });
      }
    });

    doc.paths = newPaths;
    return doc;
  }

  private getPathsToFix(yaml: OpenAPIV3.Document): Record<string, string> {
    const paths = JSONPath<Record<string, OpenAPIV3.PathItemObject>>({
      path: '$.paths',
      json: yaml,
      resultType: 'value'
    })[0];

    return Object.keys(paths)
      .filter(path => path.match(/\{[^}]+}/))
      .reduce<Record<string, string>>((acc, path, index, thePaths) => {
        const toPath = thePaths[0];
        acc[path] = toPath;
        return acc;
      }, {});
  }

  private getNameFromPath(path: string): string | undefined {
    const match = path.match(/\{([^}]+)}/);
    return match ? match[1] : undefined;
  }
}
