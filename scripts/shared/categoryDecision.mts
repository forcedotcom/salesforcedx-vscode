/*
 * Copyright (c) 2026, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */
import * as Option from 'effect/Option';
import { isUndefined } from 'effect/Predicate';
import * as Schema from 'effect/Schema';

export const categoryIdsFromPolicy = (markdown: string) =>
  [...markdown.matchAll(/^### ([a-z0-9-]+)\s*$/gm)].map(match => match[1] ?? '');

export const buildPrompt = (policy: string, diffPath: string) =>
  `${policy}\n\nThe diff file is ${diffPath}. Read that file and no other file. Reply with only the JSON object.`;

const AgentEnvelope = Schema.Struct({ result: Schema.optional(Schema.String) });
const AgentCategories = Schema.Struct({ categories: Schema.Array(Schema.String) });

export const parseAgentResult = (stdout: string): readonly string[] | undefined => {
  const body = Option.match(Schema.decodeUnknownOption(Schema.parseJson(AgentEnvelope))(stdout), {
    onNone: () => stdout,
    onSome: ({ result }) => result ?? stdout
  });
  const extracted = body.match(/\{[\s\S]*"categories"\s*:\s*\[[\s\S]*?\][\s\S]*?\}/)?.[0];
  if (isUndefined(extracted)) return undefined;
  return Option.match(Schema.decodeUnknownOption(Schema.parseJson(AgentCategories))(extracted), {
    onNone: () => undefined,
    onSome: decoded => decoded.categories
  });
};
