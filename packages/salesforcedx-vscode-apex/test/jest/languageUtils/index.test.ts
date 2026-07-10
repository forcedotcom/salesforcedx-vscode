/*
 * Copyright (c) 2026, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */

import * as Effect from 'effect/Effect';
import * as Layer from 'effect/Layer';
import * as Tracer from 'effect/Tracer';
import * as vscode from 'vscode';

// Record spans emitted via getRuntime().runPromise so the apex.test.discovery span name and its
// numClasses/numMethods/durationMs attributes can be asserted (pre-migration these were verified via
// sendEventData('apexTestDiscoveryEnd', ...)). Prefixed `mock*` so jest.mock's hoisted factory may reference it.
const mockRecordedSpans: { name: string; attributes: Map<string, unknown> }[] = [];

const spanAttributes = (name: string): Record<string, unknown> | undefined => {
  const hit = mockRecordedSpans.find(s => s.name === name);
  return hit ? Object.fromEntries(hit.attributes) : undefined;
};

jest.mock('../../../src/services/runtime', () => {
  const recordingTracer = Tracer.make({
    span: (name, parent, context, links, startTime, kind, options) => {
      const attributes = new Map<string, unknown>(Object.entries(options?.attributes ?? {}));
      mockRecordedSpans.push({ name, attributes });
      return {
        _tag: 'Span',
        name,
        spanId: `span-${mockRecordedSpans.length}`,
        traceId: 'trace',
        parent,
        context,
        links,
        status: { _tag: 'Started', startTime },
        attributes,
        sampled: true,
        kind,
        end: () => {},
        attribute: (key: string, value: unknown) => {
          attributes.set(key, value);
        },
        event: () => {},
        addLinks: () => {}
      } as Tracer.Span;
    },
    context: <X>(f: () => X) => f()
  });
  const layer = Layer.setTracer(recordingTracer);
  return {
    getRuntime: () => ({
      runPromise: (eff: Effect.Effect<unknown, unknown>) => Effect.runPromise(eff.pipe(Effect.provide(layer)))
    })
  };
});

import { fetchFromLs, getApexTests } from '../../../src/languageUtils';
import { languageClientManager } from '../../../src/languageUtils/languageClientManager';
import { ApexTestMethod } from '../../../src/views/lspConverter';

// Mock dependencies
jest.mock('../../../src/languageUtils/languageClientManager');

describe('languageUtils/index', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockRecordedSpans.length = 0;
  });

  describe('fetchFromLs', () => {
    it('should fetch tests from language server and return timing/counts', async () => {
      // Arrange
      const mockTests: ApexTestMethod[] = [
        {
          methodName: 'testMethod1',
          definingType: 'TestClass1',
          location: {} as vscode.Location
        },
        {
          methodName: 'testMethod2',
          definingType: 'TestClass1',
          location: {} as vscode.Location
        },
        {
          methodName: 'testMethod3',
          definingType: 'TestClass2',
          location: {} as vscode.Location
        }
      ];

      (languageClientManager.getApexTests as jest.Mock).mockResolvedValue(mockTests);

      // Act
      const result = await fetchFromLs();

      // Assert
      expect(result.tests).toEqual(mockTests);
      expect(result.durationMs).toBeGreaterThanOrEqual(0);
      expect(languageClientManager.getApexTests).toHaveBeenCalledTimes(1);

      // apex.test.discovery span carries the distinct-type/method counts (numClasses via Set of
      // definingType: 2 distinct across 3 methods) previously asserted on apexTestDiscoveryEnd.
      const attrs = spanAttributes('apex.test.discovery');
      expect(attrs?.source).toBe('ls');
      expect(attrs?.numClasses).toBe(2);
      expect(attrs?.numMethods).toBe(3);
      expect(attrs?.durationMs).toBeGreaterThanOrEqual(0);
    });

    it('should handle empty test results', async () => {
      // Arrange
      (languageClientManager.getApexTests as jest.Mock).mockResolvedValue([]);

      // Act
      const result = await fetchFromLs();

      // Assert
      expect(result.tests).toEqual([]);
      expect(result.durationMs).toBeGreaterThanOrEqual(0);

      const attrs = spanAttributes('apex.test.discovery');
      expect(attrs?.source).toBe('ls');
      expect(attrs?.numClasses).toBe(0);
      expect(attrs?.numMethods).toBe(0);
    });

    it('should propagate errors from language server', async () => {
      // Arrange
      const error = new Error('Language server error');
      (languageClientManager.getApexTests as jest.Mock).mockRejectedValue(error);

      // Act & Assert
      await expect(fetchFromLs()).rejects.toThrow('Language server error');
    });
  });

  describe('getApexTests', () => {
    it('should fetch tests from Language Server', async () => {
      // Arrange
      const mockTests: ApexTestMethod[] = [
        {
          methodName: 'testMethod1',
          definingType: 'TestClass1',
          location: {} as vscode.Location
        }
      ];

      (languageClientManager.getApexTests as jest.Mock).mockResolvedValue(mockTests);

      // Act
      const result = await getApexTests();

      // Assert
      expect(result).toEqual(mockTests);
      expect(languageClientManager.getApexTests).toHaveBeenCalledTimes(1);
    });

    it('should handle empty test results', async () => {
      // Arrange
      (languageClientManager.getApexTests as jest.Mock).mockResolvedValue([]);

      // Act
      const result = await getApexTests();

      // Assert
      expect(result).toEqual([]);
    });

    it('should propagate errors from language server', async () => {
      // Arrange
      const error = new Error('Language server error');
      (languageClientManager.getApexTests as jest.Mock).mockRejectedValue(error);

      // Act & Assert
      await expect(getApexTests()).rejects.toThrow('Language server error');
    });
  });
});
