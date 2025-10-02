import { describe, it, expect, beforeEach, jest } from '@jest/globals';
import { createLogger } from '../src/logger';
import { loadConfigFromObject } from '../src/config';
import { runWithContext } from '../src/context';

// Mock stdout.write
const mockStdoutWrite = jest.fn();
Object.defineProperty(process.stdout, 'write', {
  value: mockStdoutWrite,
  writable: true,
});

describe('Logger', () => {
  beforeEach(() => {
    mockStdoutWrite.mockClear();
  });

  describe('createLogger', () => {
    it('should create logger with default config', () => {
      const config = loadConfigFromObject({});
      const logger = createLogger(config);
      
      expect(logger).toBeDefined();
      expect(typeof logger.info).toBe('function');
      expect(typeof logger.error).toBe('function');
      expect(typeof logger.debug).toBe('function');
      expect(typeof logger.warn).toBe('function');
      expect(typeof logger.child).toBe('function');
    });

    it('should log messages with correct structure', () => {
      const config = loadConfigFromObject({ logLevel: 'debug' });
      const logger = createLogger(config);
      
      runWithContext(
        { requestId: 'test-req-id', ctid: 'test-ctid' },
        () => {
          logger.info('test message', { key: 'value' });
        }
      );

      expect(mockStdoutWrite).toHaveBeenCalledTimes(1);
      const logOutput = mockStdoutWrite.mock.calls[0][0] as string;
      const logRecord = JSON.parse(logOutput.trim());
      
      expect(logRecord).toMatchObject({
        level: 'info',
        message: 'test message',
        requestId: 'test-req-id',
        ctid: 'test-ctid',
        details: { key: 'value' },
      });
      expect(logRecord.timestamp).toMatch(/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z$/);
    });

    it('should respect log level filtering', () => {
      const config = loadConfigFromObject({ logLevel: 'warn' });
      const logger = createLogger(config);
      
      logger.debug('debug message');
      logger.info('info message');
      logger.warn('warn message');
      logger.error('error message');

      expect(mockStdoutWrite).toHaveBeenCalledTimes(2); // warn and error only
    });

    it('should handle error objects in options', () => {
      const config = loadConfigFromObject({});
      const logger = createLogger(config);
      const testError = new Error('test error');
      
      logger.error('Something went wrong', { error: testError });

      expect(mockStdoutWrite).toHaveBeenCalledTimes(1);
      const logOutput = mockStdoutWrite.mock.calls[0][0] as string;
      const logRecord = JSON.parse(logOutput.trim());
      
      expect(logRecord.details.error).toMatchObject({
        name: 'Error',
        message: 'test error',
        stack: expect.stringContaining('Error: test error'),
      });
    });

    it('should support module names', () => {
      const config = loadConfigFromObject({});
      const logger = createLogger(config);
      
      logger.info('test message', { module: 'TestModule.testFunction' });

      expect(mockStdoutWrite).toHaveBeenCalledTimes(1);
      const logOutput = mockStdoutWrite.mock.calls[0][0] as string;
      const logRecord = JSON.parse(logOutput.trim());
      
      expect(logRecord.module).toBe('TestModule.testFunction');
    });

    it('should create child loggers with bound context', () => {
      const config = loadConfigFromObject({});
      const logger = createLogger(config);
      const childLogger = logger.child({ service: 'auth', module: 'AuthService' });
      
      childLogger.info('user authenticated', { userId: 123 });

      expect(mockStdoutWrite).toHaveBeenCalledTimes(1);
      const logOutput = mockStdoutWrite.mock.calls[0][0] as string;
      const logRecord = JSON.parse(logOutput.trim());
      
      expect(logRecord.details).toMatchObject({
        service: 'auth',
        userId: 123,
      });
      expect(logRecord.module).toBe('AuthService');
    });

    it('should merge child logger bindings correctly', () => {
      const config = loadConfigFromObject({});
      const logger = createLogger(config);
      const childLogger = logger.child({ service: 'auth' });
      const grandChildLogger = childLogger.child({ component: 'login' });
      
      grandChildLogger.info('login attempt', { username: 'test' });

      expect(mockStdoutWrite).toHaveBeenCalledTimes(1);
      const logOutput = mockStdoutWrite.mock.calls[0][0] as string;
      const logRecord = JSON.parse(logOutput.trim());
      
      expect(logRecord.details).toMatchObject({
        service: 'auth',
        component: 'login',
        username: 'test',
      });
    });

    it('should not emit logs when level is filtered out', () => {
      const config = loadConfigFromObject({ logLevel: 'error' });
      const logger = createLogger(config);
      
      logger.debug('debug message');
      logger.info('info message');
      logger.warn('warn message');

      expect(mockStdoutWrite).not.toHaveBeenCalled();
    });
  });
});
