/*
 * Copyright (c) 2024, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */
import { URI } from 'vscode-uri';
import { GenerationStrategyType } from '../../../src/oas/generationStrategy/generationStrategyFactory';
import { BID_RULES, PromptGenerationOrchestrator } from '../../../src/oas/promptGenerationOrchestrator';
import {
  ApexClassOASEligibleResponse,
  ApexClassOASGatherContextResponse,
  PromptGenerationStrategyBid
} from '../../../src/oas/schemas';

describe('PromptGenerationOrchestrator', () => {
  let orchestrator: PromptGenerationOrchestrator;
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
    methods: [],
    relationships: new Map()
  };

  beforeEach(() => {
    orchestrator = new PromptGenerationOrchestrator(mockMetadata, mockContext);
  });

  describe('getLeastCallsStrategy', () => {
    it('should return strategy with minimum calls excluding zero', () => {
      const bids = new Map<GenerationStrategyType, PromptGenerationStrategyBid>([
        ['ApexRest', { result: { callCounts: 5, maxBudget: 100 } }],
        ['AuraEnabled', { result: { callCounts: 0, maxBudget: 100 } }]
      ]);

      const result = orchestrator['getLeastCallsStrategy'](bids);
      expect(result).toBe('ApexRest');
    });

    it('should return first strategy when multiple have same minimum calls', () => {
      const bids = new Map<GenerationStrategyType, PromptGenerationStrategyBid>([
        ['ApexRest', { result: { callCounts: 2, maxBudget: 100 } }],
        ['AuraEnabled', { result: { callCounts: 2, maxBudget: 100 } }]
      ]);

      const result = orchestrator['getLeastCallsStrategy'](bids);
      expect(result).toBe('ApexRest');
    });

    it('should return undefined for empty bids map', () => {
      const bids = new Map<GenerationStrategyType, PromptGenerationStrategyBid>();
      const result = orchestrator['getLeastCallsStrategy'](bids);
      expect(result).toBeUndefined();
    });

    it.only('should return undefined when all strategies have zero calls', () => {
      const bids = new Map<GenerationStrategyType, PromptGenerationStrategyBid>([
        ['ApexRest', { result: { callCounts: 0, maxBudget: 100 } }],
        ['AuraEnabled', { result: { callCounts: 0, maxBudget: 100 } }]
      ]);

      const result = orchestrator['getLeastCallsStrategy'](bids);
      expect(result).toBeUndefined();
    });
  });

  describe('getMostCallsStrategy', () => {
    it('should return strategy with highest calls among those with at least one call', () => {
      const bids = new Map<GenerationStrategyType, PromptGenerationStrategyBid>([
        ['ApexRest', { result: { callCounts: 5, maxBudget: 100 } }],
        ['AuraEnabled', { result: { callCounts: 1, maxBudget: 100 } }]
      ]);

      const result = orchestrator['getMostCallsStrategy'](bids);
      expect(result).toBe('ApexRest');
    });

    it('should return first strategy when multiple have same highest calls', () => {
      const bids = new Map<GenerationStrategyType, PromptGenerationStrategyBid>([
        ['ApexRest', { result: { callCounts: 5, maxBudget: 100 } }],
        ['AuraEnabled', { result: { callCounts: 5, maxBudget: 100 } }]
      ]);

      const result = orchestrator['getMostCallsStrategy'](bids);
      expect(result).toBe('ApexRest');
    });

    it('should return undefined when all strategies have zero calls', () => {
      const bids = new Map<GenerationStrategyType, PromptGenerationStrategyBid>([
        ['ApexRest', { result: { callCounts: 0, maxBudget: 100 } }],
        ['AuraEnabled', { result: { callCounts: 0, maxBudget: 100 } }]
      ]);

      const result = orchestrator['getMostCallsStrategy'](bids);
      expect(result).toBeUndefined();
    });

    it('should return undefined for empty bids map', () => {
      const bids = new Map<GenerationStrategyType, PromptGenerationStrategyBid>();
      const result = orchestrator['getMostCallsStrategy'](bids);
      expect(result).toBeUndefined();
    });
  });

  describe('applyRule', () => {
    it('should apply LEAST_CALLS rule correctly excluding zero calls', () => {
      const bids = new Map<GenerationStrategyType, PromptGenerationStrategyBid>([
        ['ApexRest', { result: { callCounts: 5, maxBudget: 100 } }],
        ['AuraEnabled', { result: { callCounts: 0, maxBudget: 100 } }]
      ]);

      const result = orchestrator['applyRule'](BID_RULES.LEAST_CALLS, bids);
      expect(result).toBe('ApexRest');
    });

    it('should apply MOST_CALLS rule correctly', () => {
      const bids = new Map<GenerationStrategyType, PromptGenerationStrategyBid>([
        ['ApexRest', { result: { callCounts: 5, maxBudget: 100 } }],
        ['AuraEnabled', { result: { callCounts: 0, maxBudget: 100 } }]
      ]);

      const result = orchestrator['applyRule'](BID_RULES.MOST_CALLS, bids);
      expect(result).toBe('ApexRest');
    });

    it('should throw error for unknown bid rule', () => {
      const bids = new Map<GenerationStrategyType, PromptGenerationStrategyBid>();
      expect(() => orchestrator['applyRule']('UNKNOWN_RULE' as any, bids)).toThrow();
    });
  });
});
