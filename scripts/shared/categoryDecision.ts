import * as Option from 'effect/Option';
import { isUndefined } from 'effect/Predicate';
import * as Schema from 'effect/Schema';
import { BASE_BRANCH, BOT_LOGIN, deniedFile, preClassifyDecision, type PreClassifyFacts } from './categoryGates.cjs';

export const MODEL = 'grok-4.7-xhigh';
export { BASE_BRANCH, BOT_LOGIN, deniedFile };
export const TEAM_ORG = 'forcedotcom';
export const TEAM_SLUG = 'ide-experience';

const Skip = Schema.TaggedStruct('Skip', { reason: Schema.String });
const Approve = Schema.TaggedStruct('Approve', {
  reason: Schema.String,
  categories: Schema.Array(Schema.String)
});

export type Decision = ReturnType<typeof preClassifyDecision> | typeof Approve.Type;

type GatedFacts = PreClassifyFacts & {
  readonly categories: ReadonlyArray<string>;
  readonly allowedCategories: ReadonlyArray<string>;
};

export type Facts = (PreClassifyFacts & { readonly categories?: undefined }) | GatedFacts;

const isGated = (input: Facts): input is GatedFacts => !isUndefined(input.categories);

export const categoryIdsFromPolicy = (markdown: string) =>
  [...markdown.matchAll(/^### ([a-z0-9-]+)\s*$/gm)].map(match => match[1] ?? '');

export const buildPrompt = (policy: string, diffPath: string) =>
  `${policy}\n\nThe diff file is ${diffPath}. Read that file and no other file. Reply with only the JSON object.`;

const AgentEnvelope = Schema.Struct({ result: Schema.optional(Schema.String) });
const AgentCategories = Schema.Struct({ categories: Schema.Array(Schema.String) });

export const parseAgentResult = (stdout: string): ReadonlyArray<string> | undefined => {
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

export const decideCategoryApprove = (input: Facts): Decision => {
  const gated = preClassifyDecision(input);
  if (gated._tag !== 'Classify') return gated;
  if (!isGated(input)) return gated;
  const allowed = new Set(input.allowedCategories);
  if (input.categories.length === 0) return Skip.make({ reason: 'no covering categories' });
  const unknown = input.categories.find(category => !allowed.has(category));
  if (!isUndefined(unknown)) return Skip.make({ reason: `unknown category ${unknown}` });
  return Approve.make({ reason: input.categories.join(', '), categories: [...input.categories] });
};
