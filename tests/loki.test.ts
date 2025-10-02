import { describe, it, expect, jest } from '@jest/globals';
import { LokiTransport, LokiTransportError } from '../src/transports/loki';
import { loadConfigFromObject } from '../src/config';

// Mock the http/https modules
jest.mock('node:https', () => ({
  request: jest.fn(),
}));

jest.mock('node:http', () => ({
  request: jest.fn(),
}));

describe('LokiTransport', () => {
  describe('constructor', () => {
    it('should create transport with valid config', () => {
      const config = loadConfigFromObject({
        transport: 'loki',
        loki: {
          url: 'https://loki.example.com',
        },
      });

      const transport = new LokiTransport(config);
      expect(transport).toBeInstanceOf(LokiTransport);
    });

    it('should throw error for missing Loki URL', () => {
      expect(() => loadConfigFromObject({
        transport: 'loki',
      })).toThrow('Loki configuration is required when transport is "loki"');
    });

    it('should throw error for invalid Loki URL', () => {
      expect(() => loadConfigFromObject({
        transport: 'loki',
        loki: {
          url: 'invalid-url',
        },
      } as any)).toThrow('Invalid URL format');
    });
  });

  describe('log', () => {
    it('should format log entry correctly', async () => {
      const config = loadConfigFromObject({
        transport: 'loki',
        loki: {
          url: 'https://loki.example.com',
        },
      });

      const transport = new LokiTransport(config);
      
      // Mock successful HTTP request
      const mockReq = {
        on: jest.fn(),
        write: jest.fn(),
        end: jest.fn(),
      };

      const mockRes = {
        statusCode: 204,
        on: jest.fn((event: string, callback: () => void) => {
          if (event === 'end') {
            callback();
          }
        }),
      };

      const { request: httpsRequest } = require('node:https');
      httpsRequest.mockImplementation((_options: any, callback: any) => {
        callback(mockRes);
        return mockReq;
      });

      await transport.log('test log line', { level: 'info' });

      expect(mockReq.write).toHaveBeenCalledWith(
        expect.stringContaining('"test log line"')
      );
      expect(mockReq.end).toHaveBeenCalled();
    });
  });
});
