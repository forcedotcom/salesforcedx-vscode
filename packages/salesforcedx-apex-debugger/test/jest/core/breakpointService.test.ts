/*
 * Copyright (c) 2023, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */

import * as sfUtils from '@salesforce/salesforcedx-utils';
import { BreakpointService } from '../../../src/core';
import { DEBUGGER_BREAKPOINT_ID_PREFIX } from '../../../src/core/breakpointService';

describe('breakpointService Unit Tests.', () => {
  const bpId = `${DEBUGGER_BREAKPOINT_ID_PREFIX}defabreakpoint`;

  let breakpointService: BreakpointService;
  let fakeRequestService: jest.SpyInstance;
  let getEnvVarsMock: jest.SpyInstance;
  let executeMock: jest.SpyInstance;
  let getCmdResultMock: jest.SpyInstance;
  beforeEach(() => {
    getEnvVarsMock = jest.fn();
    // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment
    fakeRequestService = {
      getEnvVars: getEnvVarsMock.mockReturnValue({})
    } as any;

    executeMock = jest.fn().mockReturnValue(undefined);
    jest.spyOn(sfUtils, 'CliCommandExecutor').mockImplementation(() => {
      // eslint-disable-next-line @typescript-eslint/no-unsafe-return
      return {
        execute: executeMock
      } as any;
    });

    jest.spyOn(sfUtils, 'SfCommandBuilder').mockImplementation(() => {
      // eslint-disable-next-line @typescript-eslint/no-unsafe-return
      return {
        withArg: jest.fn().mockReturnThis(),
        withFlag: jest.fn().mockReturnThis(),
        withJson: jest.fn().mockReturnThis(),
        build: jest.fn()
      } as any;
    });

    getCmdResultMock = jest.fn();
    jest.spyOn(sfUtils, 'CommandOutput').mockImplementation(() => {
      // eslint-disable-next-line @typescript-eslint/no-unsafe-return
      return {
        getCmdResult: getCmdResultMock
      } as any;
    });

    breakpointService = new BreakpointService(fakeRequestService as any);
  });

  it('Should be able to construct an instance.', () => {
    expect(breakpointService).toBeDefined();
  });

  it('Should be able to call setValidLines.', () => {
    const lineNumberMapping = new Map();
    lineNumberMapping.set('test', []);
    const typerefMapping = new Map();
    breakpointService.setValidLines(lineNumberMapping, typerefMapping);
    expect(breakpointService.hasLineNumberMapping()).toBeTruthy();
  });

  it('Should return false if hasLineNumberMapping is empty.', () => {
    const lineNumberMapping = new Map();
    const typerefMapping = new Map();
    breakpointService.setValidLines(lineNumberMapping, typerefMapping);
    expect(breakpointService.hasLineNumberMapping()).toBeFalsy();
  });

  describe('isApexDebuggerBreakpointId()', () => {
    it('Should return false if isApexDebuggerBreakpointId is empty.', () => {
      expect(breakpointService.isApexDebuggerBreakpointId('')).toBeFalsy();
    });

    it('Should return false if isApexDebuggerBreakpointId is empty.', () => {
      expect(breakpointService.isApexDebuggerBreakpointId('NOT_THE_DEBUGGER_ID')).toBeFalsy();
    });

    it('Should return true if isApexDebuggerBreakpointId is not value.', () => {
      const idWithBP = `${DEBUGGER_BREAKPOINT_ID_PREFIX}dfadfw32f`;
      const hasBP = breakpointService.isApexDebuggerBreakpointId(idWithBP);
      expect(hasBP).toBeTruthy();
    });
  });

  describe('getTyperefFor()', () => {
    it('Should return undefined if getTyperefFor is empty.', () => {
      const typeref = breakpointService.getTyperefFor('test', 1);
      expect(typeref).toBeUndefined();
    });

    it('Should return undefined if the line is not found.', () => {
      const lineNumberMapping = new Map();
      lineNumberMapping.set('test', [
        {
          typeref: 'test',
          lines: [2]
        }
      ]);
      const typerefMapping = new Map();
      breakpointService.setValidLines(lineNumberMapping, typerefMapping);
      const typeref = breakpointService.getTyperefFor('test', 1);
      expect(typeref).toBeUndefined();
    });

    it('Should return the typeref if the line is found.', () => {
      const lineNumberMapping = new Map();
      lineNumberMapping.set('test', [
        {
          typeref: 'test',
          lines: [1]
        }
      ]);
      const typerefMapping = new Map();
      breakpointService.setValidLines(lineNumberMapping, typerefMapping);
      const typeref = breakpointService.getTyperefFor('test', 1);
      expect(typeref).toEqual('test');
    });
  });

  describe('getSourcePathFromTyperef()', () => {
    it('Should return undefined if getSourcePathFromTyperef is empty.', () => {
      const typeref = breakpointService.getSourcePathFromTyperef('test');
      expect(typeref).toBeUndefined();
    });

    it('Should return typeref if getSourcePathFromTyperef is not empty.', () => {
      const typerefMapping = new Map();
      typerefMapping.set('test', 'test');
      breakpointService.setValidLines(new Map(), typerefMapping);
      const typeref = breakpointService.getSourcePathFromTyperef('test');
      expect(typeref).toEqual('test');
    });
  });

  describe('getSourcePathFromPartialTyperef()', () => {
    it('Should return undefined if getSourcePathFromPartialTyperef is empty.', () => {
      const typeref = breakpointService.getSourcePathFromPartialTyperef('test');
      expect(typeref).toBeUndefined();
    });

    it('Should return typeref if getSourcePathFromPartialTyperef is not empty.', () => {
      const typerefMapping = new Map();
      typerefMapping.set('test', 'test');
      breakpointService.setValidLines(new Map(), typerefMapping);
      const typeref = breakpointService.getSourcePathFromPartialTyperef('test');
      expect(typeref).toEqual('test');
    });
  });

  describe('cacheLineBreakpoint()', () => {
    it('Should return undefined if cacheLineBreakpoint is empty.', () => {
      breakpointService.cacheLineBreakpoint('test', 1, 'test');
      const cache = breakpointService.getLineBreakpointCache();
      expect(cache).toBeDefined();
    });

    it('Should add a new line breakpoint to the cache.', () => {
      breakpointService.cacheLineBreakpoint('test', 1, 'test');
      const cache = breakpointService.getLineBreakpointCache();
      expect(cache.get('test')).toBeDefined();
    });
  });

  describe('getBreakpointsFor()', () => {
    it('Should return undefined if getBreakpointsFor is empty.', () => {
      const cache = breakpointService.getBreakpointsFor('test');
      expect(cache).toBeDefined();
    });

    it('Should return a set of breakpoints.', () => {
      breakpointService.cacheLineBreakpoint('test', 1, 'test');
      const cache = breakpointService.getBreakpointsFor('test');
      expect(cache).toBeDefined();
    });
  });

  describe('getExceptionBreakpointCache()', () => {
    it('Should return undefined if getExceptionBreakpointCache is empty.', () => {
      const cache = breakpointService.getExceptionBreakpointCache();
      expect(cache).toBeDefined();
    });

    it('Should return a set of breakpoints.', () => {
      const cache = breakpointService.getExceptionBreakpointCache();
      expect(cache).toBeDefined();
    });
  });

  describe('getLineBreakpointCache()', () => {
    it('Should return undefined if getLineBreakpointCache is empty.', () => {
      const cache = breakpointService.getLineBreakpointCache();
      expect(cache).toBeDefined();
    });

    it('Should return a set of breakpoints.', () => {
      const cache = breakpointService.getLineBreakpointCache();
      expect(cache).toBeDefined();
    });
  });

  describe('getBreakpointsFor()', () => {
    it('Should return undefined if cache is empty.', () => {
      const lines = breakpointService.getBreakpointsFor('test');
      expect(lines.size).toEqual(0);
    });

    it('Should return a breakpoint.', () => {
      breakpointService.cacheLineBreakpoint('test', 1, 'test');
      const lines = breakpointService.getBreakpointsFor('test');
      expect(lines.size).toEqual(1);
      expect(lines.has(1)).toEqual(true);
    });
  });

  describe('createLineBreakpoint()', () => {
    it('Should resolve to breakpointId if found.', async () => {
      getCmdResultMock.mockResolvedValue(
        JSON.stringify({
          result: { id: bpId }
        })
      );
      const result = await breakpointService.createLineBreakpoint('fake/project/path', 'fakeSessionId', 'test', 1);
      expect(executeMock).toHaveBeenCalled();
      expect(getCmdResultMock).toHaveBeenCalled();
      expect(result).toEqual(bpId);
    });

    it('Should reject with result if not a breakpoint id.', () => {
      const expectedResults = JSON.stringify({
        result: { id: 'notABPId' }
      });
      getCmdResultMock.mockResolvedValue(expectedResults);

      // eslint-disable-next-line @typescript-eslint/no-floating-promises
      expect(breakpointService.createLineBreakpoint('fake/project/path', 'fakeSessionId', 'test', 1)).rejects.toEqual(
        expectedResults
      );
      expect(executeMock).toHaveBeenCalled();
      expect(getCmdResultMock).toHaveBeenCalled();
    });

    it('Should reject with result if not able to parse.', () => {
      const expectedResults = JSON.stringify({
        result: { id: 'notABPId' }
      }).substring(1);
      getCmdResultMock.mockResolvedValue(expectedResults);

      // eslint-disable-next-line @typescript-eslint/no-floating-promises
      expect(breakpointService.createLineBreakpoint('fake/project/path', 'fakeSessionId', 'test', 1)).rejects.toEqual(
        expectedResults
      );
      expect(executeMock).toHaveBeenCalled();
      expect(getCmdResultMock).toHaveBeenCalled();
    });
  });

  describe('deleteBreakpoint()', () => {
    it('Should resolve to breakpointId if deleted.', async () => {
      getCmdResultMock.mockResolvedValue(
        JSON.stringify({
          result: { id: bpId }
        })
      );
      const result = await breakpointService.deleteBreakpoint('fake/project/path', bpId);
      expect(executeMock).toHaveBeenCalled();
      expect(getCmdResultMock).toHaveBeenCalled();
      expect(result).toEqual(bpId);
    });

    it('Should reject with result if not a breakpoint id.', () => {
      const expectedResults = JSON.stringify({
        result: { id: 'notABPId' }
      });
      getCmdResultMock.mockResolvedValue(expectedResults);

      // eslint-disable-next-line @typescript-eslint/no-floating-promises
      expect(breakpointService.deleteBreakpoint('fake/project/path', bpId)).rejects.toEqual(expectedResults);
      expect(executeMock).toHaveBeenCalled();
      expect(getCmdResultMock).toHaveBeenCalled();
    });

    it('Should reject with result if not able to parse.', () => {
      const expectedResults = JSON.stringify({
        result: { id: 'notABPId' }
      }).substring(1);
      getCmdResultMock.mockResolvedValue(expectedResults);

      // eslint-disable-next-line @typescript-eslint/no-floating-promises
      expect(breakpointService.deleteBreakpoint('fake/project/path', bpId)).rejects.toEqual(expectedResults);
      expect(executeMock).toHaveBeenCalled();
      expect(getCmdResultMock).toHaveBeenCalled();
    });
  });

  describe('reconcileLineBreakpoints()', () => {
    const fakeUri = 'fake/project/path';
    beforeEach(() => {
      jest.spyOn(breakpointService, 'deleteBreakpoint').mockResolvedValue(bpId);
      jest.spyOn(breakpointService, 'createLineBreakpoint').mockResolvedValue(bpId);
      jest.spyOn(breakpointService, 'getTyperefFor').mockReturnValue('typeref');
    });

    it('Should delete breakpoint if known and not in clientLines.', async () => {
      (breakpointService as any).lineBreakpointCache.set(fakeUri, [
        {
          line: 1,
          breakpointId: bpId + '1'
        }
      ]);

      await breakpointService.reconcileLineBreakpoints('fake/project/path', fakeUri, 'test', [2, 3]);
      expect(breakpointService.deleteBreakpoint).toHaveBeenCalledWith('fake/project/path', bpId + '1');
    });

    it('Should create a breakpoint if typeref is found .', async () => {
      (breakpointService as any).lineBreakpointCache.set(fakeUri, [
        {
          line: 1,
          breakpointId: bpId + '1'
        }
      ]);

      await breakpointService.reconcileLineBreakpoints('fake/project/path', fakeUri, 'test', [2, 3]);
      expect(breakpointService.createLineBreakpoint).toHaveBeenCalledWith('fake/project/path', 'test', 'typeref', 2);
      expect(breakpointService.createLineBreakpoint).toHaveBeenCalledWith('fake/project/path', 'test', 'typeref', 3);
    });
  });

  describe('createExceptionBreakpoint()', () => {
    it('Should resolve to breakpointId if deleted.', async () => {
      getCmdResultMock.mockResolvedValue(
        JSON.stringify({
          result: { id: bpId }
        })
      );
      const result = await breakpointService.createExceptionBreakpoint(
        'fake/project/path',
        'fakeSessionId',
        'fakeTypeRef'
      );
      expect(executeMock).toHaveBeenCalled();
      expect(getCmdResultMock).toHaveBeenCalled();
      expect(result).toEqual(bpId);
    });

    it('Should reject with result if not a breakpoint id.', () => {
      const expectedResults = JSON.stringify({
        result: { id: 'notABPId' }
      });
      getCmdResultMock.mockResolvedValue(expectedResults);

      // eslint-disable-next-line @typescript-eslint/no-floating-promises
      expect(
        breakpointService.createExceptionBreakpoint('fake/project/path', 'fakeSessionId', 'fakeTypeRef')
      ).rejects.toEqual(expectedResults);
      expect(executeMock).toHaveBeenCalled();
      expect(getCmdResultMock).toHaveBeenCalled();
    });

    it('Should reject with result if not able to parse.', () => {
      const expectedResults = JSON.stringify({
        result: { id: 'notABPId' }
      }).substring(1);
      getCmdResultMock.mockResolvedValue(expectedResults);

      // eslint-disable-next-line @typescript-eslint/no-floating-promises
      expect(
        breakpointService.createExceptionBreakpoint('fake/project/path', 'fakeSessionId', 'fakeTypeRef')
      ).rejects.toEqual(expectedResults);
      expect(executeMock).toHaveBeenCalled();
      expect(getCmdResultMock).toHaveBeenCalled();
    });
  });

  describe('reconcileExceptionBreakpoints()', () => {
    beforeEach(() => {
      jest.spyOn(breakpointService, 'deleteBreakpoint').mockResolvedValue(undefined);
      jest.spyOn(breakpointService, 'createExceptionBreakpoint').mockResolvedValue(bpId);
      (breakpointService as any).exceptionBreakpointCache = {
        get: jest.fn().mockReturnValue('test'),
        set: jest.fn(),
        delete: jest.fn()
      };
    });
    it('Should delete breakpoint if known and never.', async () => {
      await breakpointService.reconcileExceptionBreakpoints('fake/project/path', 'fakeSessionId', {
        label: 'fakeFake',
        typeref: 'test',
        breakMode: 'never'
      });
      expect(breakpointService.deleteBreakpoint).toHaveBeenCalledWith('fake/project/path', 'test');
      expect((breakpointService as any).exceptionBreakpointCache.delete).toHaveBeenCalledWith('test');
      expect((breakpointService as any).exceptionBreakpointCache.set).not.toHaveBeenCalled();
    });

    it('Should create breakpoint if not known and always.', async () => {
      (breakpointService as any).exceptionBreakpointCache.get.mockReturnValue(undefined);
      await breakpointService.reconcileExceptionBreakpoints('fake/project/path', 'fakeSessionId', {
        label: 'fakeFake',
        typeref: 'test',
        breakMode: 'always'
      });
      expect(breakpointService.deleteBreakpoint).not.toHaveBeenCalled();
      expect(breakpointService.createExceptionBreakpoint).toHaveBeenCalledWith(
        'fake/project/path',
        'fakeSessionId',
        'test'
      );
      expect((breakpointService as any).exceptionBreakpointCache.delete).not.toHaveBeenCalled();
      expect((breakpointService as any).exceptionBreakpointCache.set).toHaveBeenCalledWith('test', bpId);
    });
  });

  describe('clearSavedBreakpoints()', () => {
    it('Should clear saved breakpoints.', () => {
      const fakeMapOne = new Map<string, string>();
      fakeMapOne.set('test', 'test');
      (breakpointService as any).lineBreakpointCache = fakeMapOne;
      const fakeMapTwo = new Map<string, string>();
      fakeMapOne.set('test2', 'test2');
      (breakpointService as any).exceptionBreakpointCache = fakeMapTwo;

      breakpointService.clearSavedBreakpoints();
      expect((breakpointService as any).lineBreakpointCache.size).toEqual(0);
      expect((breakpointService as any).exceptionBreakpointCache.size).toEqual(0);
    });
  });
});
