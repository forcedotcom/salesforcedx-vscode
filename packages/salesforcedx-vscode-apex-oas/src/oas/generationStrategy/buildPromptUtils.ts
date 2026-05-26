/*
 * Copyright (c) 2025, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */
import { ExtensionProviderService } from '@salesforce/effect-ext-utils';
import * as Effect from 'effect/Effect';
import { isNotUndefined } from 'effect/Predicate';
import * as ejs from 'ejs';
import type { DocumentSymbol } from 'vscode-languageserver-protocol';
import { MethodNotFoundInDocSymbols } from '../../errors';
import { nls } from '../../messages/nls';
import { getTemplatePath } from '../../oasUtils';
import { ApexAnnotationDetail, ApexOASClassDetail, ApexOASMethodDetail } from '../schemas';

export const getMethodImplementation = Effect.fn('ApexOas.Prompt.getMethodImplementation')(function* (
  methodName: string,
  doc: string,
  methodsDocSymbolMap: Map<string, DocumentSymbol>
) {
  const methodSymbol = methodsDocSymbolMap.get(methodName);
  if (!methodSymbol) {
    return yield* new MethodNotFoundInDocSymbols({
      message: nls.localize('method_not_found_in_doc_symbols', methodName)
    });
  }
  const startLine = methodSymbol.range.start.line;
  const endLine = methodSymbol.range.end.line;
  const lines = doc.split('\n').map(line => line.trim());
  return lines.slice(startLine - 1, endLine + 1).join('\n');
});

export const getAnnotationsWithParameters = (annotations: ApexAnnotationDetail[]): string =>
  annotations
    .map(annotation => {
      const paramsEntries = Object.entries(annotation.parameters);
      const paramsAsStr =
        paramsEntries.length > 0 ? `${paramsEntries.map(([key, value]) => `${key}: ${value}`).join(', ')}` : undefined;
      return paramsAsStr
        ? `Annotation name: ${annotation.name} , Parameters: ${paramsAsStr}`
        : `Annotation name: ${annotation.name}.`;
    })
    .join('\n, ');

export const buildClassPrompt = (classDetail: ApexOASClassDetail): string =>
  [
    `The class name of the given method is ${classDetail.name}.`,
    ...(classDetail.annotations.length > 0
      ? [`The class is annotated with ${getAnnotationsWithParameters(classDetail.annotations)}`]
      : []),
    ...(classDetail.comment !== undefined
      ? [
          `The documentation of the class is ${classDetail.comment
            .replaceAll(/\/\*\*|\*\//g, '') // remove opening and closing comment markers
            .split('\n')
            .map(line => line.trim().replace(/^\* ?/, '')) // remove leading '*'
            .filter(line => line.length > 0)
            .join(' ')}.`
        ]
      : []),
    '' // for an extra newline at the end
  ].join('\n');

const HTTP_VERB_PROMPT: Record<string, string> = {
  HttpGet: nls.localize('http_verb_prompt_get'),
  HttpPatch: nls.localize('http_verb_prompt_patch'),
  HttpPost: nls.localize('http_verb_prompt_post'),
  HttpPut: nls.localize('http_verb_prompt_put'),
  HttpDelete: nls.localize('http_verb_prompt_delete')
};

export const getPromptForMethodContext = (methodContext: ApexOASMethodDetail | undefined): string =>
  methodContext?.annotations
    .map(a => HTTP_VERB_PROMPT[a.name])
    .filter(isNotUndefined)
    .join('\n') ?? '';

export const generatePromptForMethod = Effect.fn('ApexOas.Prompt.generatePromptForMethod')(function* (
  methodName: string,
  docText: string,
  methodsDocSymbolMap: Map<string, DocumentSymbol>,
  methodsContextMap: Map<string, ApexOASMethodDetail>,
  classPrompt: string
) {
  const templatePath = yield* getTemplatePath('METHOD_BY_METHOD');
  const methodImplementation = yield* getMethodImplementation(methodName, docText, methodsDocSymbolMap);
  const methodContext = methodsContextMap.get(methodName);
  const additionalUserPrompts = getPromptForMethodContext(methodContext);
  const api = yield* (yield* ExtensionProviderService).getServicesApi;
  const templateContent = yield* api.services.FsService.readFile(templatePath.fsPath);
  return ejs.render(templateContent, {
    classPrompt,
    methodImplementation,
    additionalUserPrompts
  });
});
