/*
 * Copyright (c) 2024, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */
import type { GenerationStrategy } from '../../../src/oas/generationStrategy/generationStrategy';
import { URI } from 'vscode-uri';
import GenerationInteractionLogger from '../../../src/oas/generationInteractionLogger';
import { GenerationStrategyType, initializeAndBid } from '../../../src/oas/generationStrategy/generationStrategyFactory';
import { BID_RULES, PromptGenerationOrchestrator } from '../../../src/oas/promptGenerationOrchestrator';
import {
  ApexClassOASEligibleResponse,
  ApexClassOASGatherContextResponse,
  PromptGenerationStrategyBid
} from '../../../src/oas/schemas';
import * as oasUtils from '../../../src/oasUtils';

jest.mock('../../../src/oas/generationStrategy/generationStrategyFactory');
jest.mock('../../../src/oasUtils');
jest.mock('../../../src/oas/generationInteractionLogger', () => {
  const mockInstance = {
    addPostGenDoc: jest.fn(),
    addGenerationStrategy: jest.fn(),
    addOutputTokenLimit: jest.fn(),
    addGuidedJson: jest.fn()
  };
  return {
    __esModule: true,
    default: {
      getInstance() {
        return mockInstance;
      },
    }
  };
});

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

    it('should return undefined when all strategies have zero calls', () => {
      const bids = new Map<GenerationStrategyType, PromptGenerationStrategyBid>([
        ['ApexRest', { result: { callCounts: 0, maxBudget: 100 } }],
        ['AuraEnabled', { result: { callCounts: 0, maxBudget: 100 } }]
      ]);

      const result = orchestrator['getLeastCallsStrategy'](bids);
      expect(result).toBeUndefined();
    });

    it('should return undefined for empty bids map', () => {
      const bids = new Map<GenerationStrategyType, PromptGenerationStrategyBid>();
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

  describe('selectStrategyByBidRule', () => {
    let mockStrategy: jest.Mocked<GenerationStrategy>;

    beforeEach(() => {
      mockStrategy = {
        generateOAS: jest.fn(),
        bid: jest.fn(),
        outputTokenLimit: 1000,
        includeOASSchema: false,
        openAPISchema: undefined,
        strategyName: 'ApexRest',
        metadata: mockMetadata,
        context: mockContext
      } as any;

      jest.clearAllMocks();
    });

    it('should select and return strategy based on LEAST_CALLS rule', async () => {
      const bids = new Map<GenerationStrategyType, PromptGenerationStrategyBid>([
        ['ApexRest', { result: { callCounts: 5, maxBudget: 100 } }],
        ['AuraEnabled', { result: { callCounts: 10, maxBudget: 100 } }]
      ]);
      const strategies = new Map<GenerationStrategyType, GenerationStrategy>([
        ['ApexRest', mockStrategy],
        ['AuraEnabled', mockStrategy]
      ]);

      (initializeAndBid as jest.Mock).mockResolvedValue({ strategies, bids });

      const result = await orchestrator.selectStrategyByBidRule(BID_RULES.LEAST_CALLS);

      expect(initializeAndBid).toHaveBeenCalledWith(mockMetadata, mockContext);
      expect(result).toBe(mockStrategy);
      expect(orchestrator.strategy).toBe(mockStrategy);
    });

    it('should select and return strategy based on MOST_CALLS rule', async () => {
      const bids = new Map<GenerationStrategyType, PromptGenerationStrategyBid>([
        ['ApexRest', { result: { callCounts: 5, maxBudget: 100 } }],
        ['AuraEnabled', { result: { callCounts: 10, maxBudget: 100 } }]
      ]);
      const strategies = new Map<GenerationStrategyType, GenerationStrategy>([
        ['ApexRest', mockStrategy],
        ['AuraEnabled', mockStrategy]
      ]);

      (initializeAndBid as jest.Mock).mockResolvedValue({ strategies, bids });

      const result = await orchestrator.selectStrategyByBidRule(BID_RULES.MOST_CALLS);

      expect(initializeAndBid).toHaveBeenCalledWith(mockMetadata, mockContext);
      expect(result).toBe(mockStrategy);
      expect(orchestrator.strategy).toBe(mockStrategy);
    });

    it('should throw error when no strategy qualifies', async () => {
      const bids = new Map<GenerationStrategyType, PromptGenerationStrategyBid>([
        ['ApexRest', { result: { callCounts: 0, maxBudget: 100 } }],
        ['AuraEnabled', { result: { callCounts: 0, maxBudget: 100 } }]
      ]);
      const strategies = new Map<GenerationStrategyType, GenerationStrategy>([
        ['ApexRest', mockStrategy],
        ['AuraEnabled', mockStrategy]
      ]);

      (initializeAndBid as jest.Mock).mockResolvedValue({ strategies, bids });

      await expect(orchestrator.selectStrategyByBidRule(BID_RULES.LEAST_CALLS)).rejects.toThrow();
    });

    it('should throw error when selected strategy is not found', async () => {
      const bids = new Map<GenerationStrategyType, PromptGenerationStrategyBid>([
        ['ApexRest', { result: { callCounts: 5, maxBudget: 100 } }]
      ]);
      const strategies = new Map<GenerationStrategyType, GenerationStrategy>();

      (initializeAndBid as jest.Mock).mockResolvedValue({ strategies, bids });

      await expect(orchestrator.selectStrategyByBidRule(BID_RULES.LEAST_CALLS)).rejects.toThrow();
    });
  });

  describe('generateOASWithSelectedStrategy', () => {
    let mockStrategy: jest.Mocked<GenerationStrategy>;

    beforeEach(() => {
      mockStrategy = {
        generateOAS: jest.fn().mockResolvedValue('{"openapi": "3.0.0"}'),
        bid: jest.fn(),
        outputTokenLimit: 1000,
        includeOASSchema: false,
        openAPISchema: undefined,
        strategyName: 'ApexRest',
        metadata: mockMetadata,
        context: mockContext
      } as any;

      (oasUtils.cleanupGeneratedDoc as jest.Mock).mockImplementation((doc: string) => doc);
      jest.clearAllMocks();
    });

    it('should generate OAS using previously selected strategy', async () => {
      orchestrator.strategy = mockStrategy;

      const result = await orchestrator.generateOASWithSelectedStrategy();

      expect(mockStrategy.generateOAS).toHaveBeenCalled();
      expect(oasUtils.cleanupGeneratedDoc).toHaveBeenCalledWith('{"openapi": "3.0.0"}');
      const gil = GenerationInteractionLogger.getInstance();
      expect(gil.addPostGenDoc).toHaveBeenCalledWith('{"openapi": "3.0.0"}');
      expect(gil.addGenerationStrategy).toHaveBeenCalledWith('MANUAL');
      expect(gil.addOutputTokenLimit).toHaveBeenCalledWith(1000);
      expect(result).toBe('{"openapi": "3.0.0"}');
    });

    it('should select strategy and generate OAS when rule is provided', async () => {
      const bids = new Map<GenerationStrategyType, PromptGenerationStrategyBid>([
        ['ApexRest', { result: { callCounts: 5, maxBudget: 100 } }]
      ]);
      const strategies = new Map<GenerationStrategyType, GenerationStrategy>([
        ['ApexRest', mockStrategy]
      ]);

      (initializeAndBid as jest.Mock).mockResolvedValue({ strategies, bids });

      const result = await orchestrator.generateOASWithSelectedStrategy(BID_RULES.LEAST_CALLS);

      expect(initializeAndBid).toHaveBeenCalled();
      expect(mockStrategy.generateOAS).toHaveBeenCalled();
      expect(oasUtils.cleanupGeneratedDoc).toHaveBeenCalled();
      const gil = GenerationInteractionLogger.getInstance();
      expect(gil.addPostGenDoc).toHaveBeenCalled();
      expect(gil.addGenerationStrategy).toHaveBeenCalledWith(BID_RULES.LEAST_CALLS);
      expect(result).toBe('{"openapi": "3.0.0"}');
    });

    it('should throw error when no strategy is selected and no rule provided', async () => {
      orchestrator.strategy = undefined;

      await expect(orchestrator.generateOASWithSelectedStrategy()).rejects.toThrow();
    });

    it('should include guided JSON when strategy has OAS schema', async () => {
      mockStrategy.includeOASSchema = true;
      mockStrategy.openAPISchema = '{"schema": "test"}';
      orchestrator.strategy = mockStrategy;

      await orchestrator.generateOASWithSelectedStrategy();

      const gil = GenerationInteractionLogger.getInstance();
      expect(gil.addGuidedJson).toHaveBeenCalledWith('{"schema": "test"}');
    });

    it('should not include guided JSON when strategy does not have OAS schema', async () => {
      mockStrategy.includeOASSchema = false;
      orchestrator.strategy = mockStrategy;

      await orchestrator.generateOASWithSelectedStrategy();

      const gil = GenerationInteractionLogger.getInstance();
      expect(gil.addGuidedJson).not.toHaveBeenCalled();
    });

    it('should clean up generated document with markdown code fences', async () => {
      const rawOas = '```json\n{"openapi": "3.0.0"}\n```';
      const cleanedOas = '{"openapi": "3.0.0"}';
      mockStrategy.generateOAS = jest.fn().mockResolvedValue(rawOas);
      (oasUtils.cleanupGeneratedDoc as jest.Mock).mockReturnValue(cleanedOas);
      orchestrator.strategy = mockStrategy;

      const result = await orchestrator.generateOASWithSelectedStrategy();

      expect(oasUtils.cleanupGeneratedDoc).toHaveBeenCalledWith(rawOas);
      expect(result).toBe(cleanedOas);
      const gil = GenerationInteractionLogger.getInstance();
      expect(gil.addPostGenDoc).toHaveBeenCalledWith(cleanedOas);
    });
  });
});
