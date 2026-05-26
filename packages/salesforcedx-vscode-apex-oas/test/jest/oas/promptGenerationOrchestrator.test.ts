/*
 * Copyright (c) 2024, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */
import * as Effect from 'effect/Effect';
import { URI } from 'vscode-uri';
import type { GenerationStrategy } from '../../../src/oas/generationStrategy/generationStrategy';
import * as factory from '../../../src/oas/generationStrategy/generationStrategyFactory';
import { GenerationStrategyType } from '../../../src/oas/generationStrategy/generationStrategyFactory';
import {
  applyRule,
  getLeastCallsStrategy,
  getMostCallsStrategy,
  selectStrategyByBidRule
} from '../../../src/oas/promptGenerationOrchestrator';
import {
  ApexClassOASEligibleResponse,
  ApexClassOASGatherContextResponse,
  PromptGenerationStrategyBid
} from '../../../src/oas/schemas';

const buildBids = (entries: Array<[GenerationStrategyType, number]>) =>
  new Map<GenerationStrategyType, PromptGenerationStrategyBid>(
    entries.map(([s, callCounts]) => [s, { result: { callCounts, maxBudget: 100 } }])
  );

describe('promptGenerationOrchestrator pure helpers', () => {
  describe('getLeastCallsStrategy', () => {
    it('returns strategy with minimum calls excluding zero', async () => {
      const result = await Effect.runPromise(
        getLeastCallsStrategy(
          buildBids([
            ['ApexRest', 5],
            ['AuraEnabled', 0]
          ])
        )
      );
      expect(result).toBe('ApexRest');
    });

    it('returns first strategy when multiple share min', async () => {
      const result = await Effect.runPromise(
        getLeastCallsStrategy(
          buildBids([
            ['ApexRest', 2],
            ['AuraEnabled', 2]
          ])
        )
      );
      expect(result).toBe('ApexRest');
    });

    it('fails when all zero', async () => {
      await expect(
        Effect.runPromise(
          getLeastCallsStrategy(
            buildBids([
              ['ApexRest', 0],
              ['AuraEnabled', 0]
            ])
          )
        )
      ).rejects.toBeDefined();
    });

    it('fails for empty bids', async () => {
      await expect(Effect.runPromise(getLeastCallsStrategy(new Map()))).rejects.toBeDefined();
    });
  });

  describe('getMostCallsStrategy', () => {
    it('returns strategy with highest calls', async () => {
      const result = await Effect.runPromise(
        getMostCallsStrategy(
          buildBids([
            ['ApexRest', 5],
            ['AuraEnabled', 1]
          ])
        )
      );
      expect(result).toBe('ApexRest');
    });

    it('fails when all zero', async () => {
      await expect(
        Effect.runPromise(
          getMostCallsStrategy(
            buildBids([
              ['ApexRest', 0],
              ['AuraEnabled', 0]
            ])
          )
        )
      ).rejects.toBeDefined();
    });
  });

  describe('applyRule', () => {
    it('applies LEAST_CALLS', async () => {
      const result = await Effect.runPromise(
        applyRule(
          'LEAST_CALLS',
          buildBids([
            ['ApexRest', 5],
            ['AuraEnabled', 0]
          ])
        )
      );
      expect(result).toBe('ApexRest');
    });

    it('applies MOST_CALLS', async () => {
      const result = await Effect.runPromise(
        applyRule(
          'MOST_CALLS',
          buildBids([
            ['ApexRest', 5],
            ['AuraEnabled', 0]
          ])
        )
      );
      expect(result).toBe('ApexRest');
    });
  });
});

describe('selectStrategyByBidRule', () => {
  const mockMetadata: ApexClassOASEligibleResponse = {
    isApexOasEligible: true,
    isEligible: true,
    resourceUri: URI.parse('file:///test.cls')
  };
  const mockContext: ApexClassOASGatherContextResponse = {
    classDetail: {
      name: 'TestClass',
      interfaces: [],
      extendedClass: null,
      annotations: [],
      definitionModifiers: [],
      accessModifiers: [],
      innerClasses: [],
      comment: ''
    },
    properties: [],
    methods: []
  };

  const buildMockStrategy = (strategyName: string): GenerationStrategy =>
    ({
      strategyName,
      betaInfo: undefined,
      openAPISchema: undefined,
      bid: jest.fn(),
      generateOAS: jest.fn(),
      getTelemetry: jest.fn()
    }) as unknown as GenerationStrategy;

  const stubInitializeAndBid = (
    strategies: Map<GenerationStrategyType, GenerationStrategy>,
    bids: Map<GenerationStrategyType, PromptGenerationStrategyBid>
  ) => {
    jest.spyOn(factory, 'initializeAndBid').mockReturnValue(Effect.succeed({ strategies, bids }) as never);
  };

  // initializeAndBid is mocked, so the `R` channel is empty at runtime; cast away the static service requirements.
  // eslint-disable-next-line @typescript-eslint/consistent-type-assertions
  const runSelect = (rule: 'LEAST_CALLS' | 'MOST_CALLS') =>
    Effect.runPromise(
      selectStrategyByBidRule(mockMetadata, mockContext, rule) as Effect.Effect<GenerationStrategy, unknown, never>
    );

  afterEach(() => {
    jest.restoreAllMocks();
  });

  it('returns the strategy chosen by LEAST_CALLS', async () => {
    const apexRest = buildMockStrategy('ApexRest');
    const aura = buildMockStrategy('AuraEnabled');
    stubInitializeAndBid(
      new Map<GenerationStrategyType, GenerationStrategy>([
        ['ApexRest', apexRest],
        ['AuraEnabled', aura]
      ]),
      new Map<GenerationStrategyType, PromptGenerationStrategyBid>([
        ['ApexRest', { result: { callCounts: 5, maxBudget: 100 } }],
        ['AuraEnabled', { result: { callCounts: 10, maxBudget: 100 } }]
      ])
    );

    const result = await runSelect('LEAST_CALLS');
    expect(result).toBe(apexRest);
  });

  it('returns the strategy chosen by MOST_CALLS', async () => {
    const apexRest = buildMockStrategy('ApexRest');
    const aura = buildMockStrategy('AuraEnabled');
    stubInitializeAndBid(
      new Map<GenerationStrategyType, GenerationStrategy>([
        ['ApexRest', apexRest],
        ['AuraEnabled', aura]
      ]),
      new Map<GenerationStrategyType, PromptGenerationStrategyBid>([
        ['ApexRest', { result: { callCounts: 5, maxBudget: 100 } }],
        ['AuraEnabled', { result: { callCounts: 10, maxBudget: 100 } }]
      ])
    );

    const result = await runSelect('MOST_CALLS');
    expect(result).toBe(aura);
  });

  it('fails when all bids are zero', async () => {
    stubInitializeAndBid(
      new Map<GenerationStrategyType, GenerationStrategy>([
        ['ApexRest', buildMockStrategy('ApexRest')],
        ['AuraEnabled', buildMockStrategy('AuraEnabled')]
      ]),
      new Map<GenerationStrategyType, PromptGenerationStrategyBid>([
        ['ApexRest', { result: { callCounts: 0, maxBudget: 100 } }],
        ['AuraEnabled', { result: { callCounts: 0, maxBudget: 100 } }]
      ])
    );

    await expect(runSelect('LEAST_CALLS')).rejects.toBeDefined();
  });

  it('fails when the chosen strategy is missing from the strategies map', async () => {
    stubInitializeAndBid(
      new Map<GenerationStrategyType, GenerationStrategy>(),
      new Map<GenerationStrategyType, PromptGenerationStrategyBid>([
        ['ApexRest', { result: { callCounts: 5, maxBudget: 100 } }]
      ])
    );

    await expect(runSelect('LEAST_CALLS')).rejects.toBeDefined();
  });
});
