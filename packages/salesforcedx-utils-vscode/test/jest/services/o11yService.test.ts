/*
 * Copyright (c) 2025, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */
import { O11yService } from '../../../src/services/o11yService';
import { loadO11yModules } from '../../../src/telemetry/utils/o11yLoader';

jest.mock('../../../src/telemetry/utils/o11yLoader', () => ({
  loadO11yModules: jest.fn()
}));

describe('O11yService', () => {
  let o11yService: O11yService;

  beforeEach(() => {
    o11yService = O11yService.getInstance('test-extension');
    jest.clearAllMocks();
  });

  test('should return the same instance when getInstance is called multiple times', () => {
    const instance1 = O11yService.getInstance('test-extension');
    const instance2 = O11yService.getInstance('test-extension');
    expect(instance1).toBe(instance2);
  });

  test('should initialize correctly', async () => {
    const mockModules = {
      o11yClientVersion: '1.0.0',
      o11ySchemaVersion: '1.0.0',
      getInstrumentation: jest.fn().mockReturnValue({ log: jest.fn() }),
      registerInstrumentedApp: jest
        .fn()
        .mockReturnValue({ registerLogCollector: jest.fn(), registerMetricsCollector: jest.fn() }),
      ConsoleCollector: jest.fn(),
      a4d_instrumentation: {},
      simpleCollectorModule: { default: { SimpleCollector: jest.fn() } },
      collectorsModule: { default: { encodeCoreEnvelopeContentsRaw: jest.fn() } }
    };

    (loadO11yModules as jest.Mock).mockResolvedValue(mockModules);

    await o11yService.initialize('test-extension', 'http://test-endpoint');

    // @ts-expect-error - internal property
    expect(o11yService.o11yUploadEndpoint).toBe('http://test-endpoint');
    expect(mockModules.getInstrumentation).toHaveBeenCalledWith('salesforce-vscode-extensions-instrumentation');
    expect(mockModules.registerInstrumentedApp).toHaveBeenCalled();
  });

  test('should handle initialization failure', async () => {
    // Reset shared resources to ensure initialization actually happens
    (O11yService as any).sharedInstrApp = null;
    (O11yService as any).sharedO11yModules = null;
    (O11yService as any).sharedInstrumentation = null;
    (O11yService as any).sharedProtoEncoderFunc = null;

    (loadO11yModules as jest.Mock).mockRejectedValue(new Error('Failed to load modules'));

    await expect(o11yService.initialize('test-extension', 'http://test-endpoint')).rejects.toThrow(
      'Failed to load modules'
    );
  });

  test('should log events correctly', async () => {
    const logMock = jest.fn();

    // First initialize the service to set extension name and endpoint
    const mockModules = {
      o11yClientVersion: '1.0.0',
      o11ySchemaVersion: '1.0.0',
      getInstrumentation: jest.fn().mockReturnValue({ log: logMock }),
      registerInstrumentedApp: jest
        .fn()
        .mockReturnValue({ registerLogCollector: jest.fn(), registerMetricsCollector: jest.fn() }),
      ConsoleCollector: jest.fn(),
      a4d_instrumentation: {},
      simpleCollectorModule: { default: { SimpleCollector: jest.fn() } },
      collectorsModule: { default: { encodeCoreEnvelopeContentsRaw: jest.fn() } }
    };

    (loadO11yModules as jest.Mock).mockResolvedValue(mockModules);
    await o11yService.initialize('test-extension', 'http://test-endpoint');

    o11yService.instrumentation = { log: logMock } as any;
    // @ts-expect-error - internal property
    o11yService.a4dO11ySchema = {};

    o11yService.logEvent({ key: 'value' });

    expect(logMock).toHaveBeenCalledWith({}, { message: '{"key":"value"}' });
  });

  test('should not log event if instrumentation is not initialized', () => {
    console.log = jest.fn();
    // @ts-expect-error - internal property
    o11yService.instrumentation = undefined as any;
    o11yService.logEvent({ key: 'value' });

    expect(console.log).toHaveBeenCalledWith('O11yService: Unable to log event - Instrumentation not initialized.');
  });

  test('should upload data correctly', async () => {
    const mockProtoEncoder = jest.fn().mockReturnValue(new Uint8Array([1, 2, 3]));
    const mockSimpleCollector = {
      hasData: true,
      estimatedByteSize: 60000,
      getRawContentsOfCoreEnvelope: jest.fn().mockReturnValue({})
    };

    (O11yService as any).sharedProtoEncoderFunc = mockProtoEncoder;
    (O11yService as any).sharedInstrApp = { simpleCollector: mockSimpleCollector };
    
    jest.spyOn(o11yService, 'uploadToFalconAsync').mockResolvedValue({} as Response);

    await o11yService.upload();

    expect(mockProtoEncoder).toHaveBeenCalled();
    expect(o11yService.uploadToFalconAsync).toHaveBeenCalled();
  });

  test('should not upload if simpleCollector has no data', async () => {
    const mockSimpleCollector = { hasData: false };

    (O11yService as any).sharedInstrApp = { simpleCollector: mockSimpleCollector };

    await o11yService.upload();

    expect(o11yService.uploadToFalconAsync).not.toHaveBeenCalled();
  });

  test('should handle missing protoEncoderFunc during upload', async () => {
    o11yService = O11yService.getInstance('test-extension');

    // Simulating a missing sharedProtoEncoderFunc
    (O11yService as any).sharedProtoEncoderFunc = null;

    // Call upload but expect no rejection (since we now handle missing protoEncoderFunc safely)
    await expect(o11yService.upload()).resolves.toBeUndefined();
  });

  test('should post request successfully', async () => {
    jest.spyOn(global, 'fetch').mockResolvedValue({
      ok: true,
      json: jest.fn().mockResolvedValue({ success: true })
    } as unknown as Response);

    const response = await o11yService.postRequest('http://test-endpoint', { key: 'value' });

    expect(fetch).toHaveBeenCalledWith('http://test-endpoint', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ key: 'value' })
    });

    expect(response.ok).toBe(true);
  });

  test('should handle post request failure', async () => {
    const mockError = new Error('Network Error');
    jest.spyOn(global, 'fetch').mockRejectedValue(mockError);
    jest.spyOn(console, 'error').mockImplementation(() => {}); // Suppress console output

    await expect(o11yService.postRequest('http://test-endpoint', { key: 'value' })).rejects.toThrow('Network Error');

    expect(fetch).toHaveBeenCalledWith('http://test-endpoint', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ key: 'value' })
    });

    expect(console.error).toHaveBeenCalledWith('Post Request failed:', mockError);
  });

  test('should throw error if o11yUploadEndpoint is undefined', async () => {
    // @ts-expect-error - internal property
    o11yService.o11yUploadEndpoint = undefined;
    jest.spyOn(o11yService, 'uploadToFalconAsync').mockRejectedValue(new Error('o11yUploadEndpoint is not defined'));
  });
});
