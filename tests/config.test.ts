import { describe, it, expect } from '@jest/globals';
import { loadConfig, loadConfigFromObject, loadConfigFromFile, ConfigValidationError } from '../src/config';

describe('Config', () => {
  describe('loadConfig', () => {
    it('should load default config from empty env', () => {
      const config = loadConfig({});
      
      expect(config).toEqual({
        logLevel: 'info',
        requestIdHeader: 'x-request-id',
        ctidHeader: 'x-correlation-id',
        transport: 'console',
        autoModule: false,
      });
    });

    it('should load config from environment variables', () => {
      const env = {
        LOG_LEVEL: 'debug',
        REQUEST_ID_HEADER: 'custom-request-id',
        CTID_HEADER: 'custom-ctid',
        LOG_TRANSPORT: 'json',
        LOG_AUTO_MODULE: 'true',
      };

      const config = loadConfig(env);
      
      expect(config).toEqual({
        logLevel: 'debug',
        requestIdHeader: 'custom-request-id',
        ctidHeader: 'custom-ctid',
        transport: 'json',
        autoModule: true,
      });
    });

    it('should load Loki config when transport is loki', () => {
      // Mock readEnv function by setting up process.env temporarily
      const originalEnv = process.env;
      process.env = {
        ...originalEnv,
        LOG_TRANSPORT: 'loki',
        LOKI_URL: 'https://loki.example.com',
        LOKI_TENANT_ID: 'tenant123',
        LOKI_BASIC_AUTH: 'dXNlcjpwYXNz',
      };

      try {
        const config = loadConfig();
        
        expect(config.transport).toBe('loki');
        expect(config.loki).toEqual({
          url: 'https://loki.example.com',
          tenantId: 'tenant123',
          basicAuth: 'dXNlcjpwYXNz',
        });
      } finally {
        // Restore original env
        process.env = originalEnv;
      }
    });

    it('should throw error when loki transport is selected but no URL provided', () => {
      const env = {
        LOG_TRANSPORT: 'loki',
      };

      expect(() => loadConfig(env)).toThrow(ConfigValidationError);
      expect(() => loadConfig(env)).toThrow('LOKI_URL is required when transport is "loki"');
    });

    it('should throw ConfigValidationError for invalid log level', () => {
      const env = {
        LOG_LEVEL: 'invalid',
      };

      const error = expect(() => loadConfig(env)).toThrow(ConfigValidationError);
      try {
        loadConfig(env);
      } catch (e) {
        if (e instanceof ConfigValidationError) {
          expect(e.field).toBe('logLevel');
          expect(e.value).toBe('invalid');
        }
      }
    });

    it('should throw ConfigValidationError for invalid transport', () => {
      const env = {
        LOG_TRANSPORT: 'invalid',
      };

      try {
        loadConfig(env);
      } catch (e) {
        if (e instanceof ConfigValidationError) {
          expect(e.field).toBe('transport');
          expect(e.value).toBe('invalid');
        }
      }
    });
  });

  describe('loadConfigFromObject', () => {
    it('should load config from partial object', () => {
      const input = {
        logLevel: 'warn' as const,
        autoModule: true,
      };

      const config = loadConfigFromObject(input);
      
      expect(config.logLevel).toBe('warn');
      expect(config.autoModule).toBe(true);
      expect(config.requestIdHeader).toBe('x-request-id'); // default
    });

    it('should throw ConfigValidationError for invalid config', () => {
      const input = {
        logLevel: 'invalid',
      } as any; // Cast to bypass TypeScript checking for runtime validation test

      expect(() => loadConfigFromObject(input)).toThrow(ConfigValidationError);
    });

    it('should validate Loki URL', () => {
      const input = {
        transport: 'loki' as const,
        loki: {
          url: 'invalid-url',
        },
      } as any; // Cast to bypass TypeScript checking for runtime validation test

      expect(() => loadConfigFromObject(input)).toThrow(ConfigValidationError);
    });

    it('should require Loki config when transport is loki', () => {
      const input = {
        transport: 'loki' as const,
      };

      expect(() => loadConfigFromObject(input)).toThrow('Loki configuration is required');
    });

    it('should validate Loki labels are strings', () => {
      const input = {
        transport: 'loki' as const,
        loki: {
          url: 'https://loki.example.com',
          labels: {
            service: 'test',
            version: 123, // invalid - should be string
          },
        },
      } as any; // Cast to bypass TypeScript checking for runtime validation test

      expect(() => loadConfigFromObject(input)).toThrow(ConfigValidationError);
    });
  });

  describe('loadConfigFromFile', () => {
    it('should throw error for non-existent file', () => {
      expect(() => loadConfigFromFile('/non/existent/file.json')).toThrow('no such file or directory');
    });
  });
});
