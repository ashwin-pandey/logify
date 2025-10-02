# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [Unreleased]

## [0.0.2] - 2024-10-02

### Added
- CHANGELOG.md for tracking version changes
- Enhanced error handling with field-specific validation details

### Changed
- **BREAKING**: Simplified logger API - removed need for `{ details: { ... } }` wrapper
  - Before: `logger.info('msg', { details: { userId: 123 } })`
  - After: `logger.info('msg', { userId: 123 })`
- **BREAKING**: Removed Zod dependency - now uses native TypeScript validation
- Moved all test files from `src/` to `tests/` directory for better organization
- Enhanced LogOptions interface with index signature for flexible key-value pairs
- Updated comprehensive documentation and examples
- ConfigValidationError now includes `field` and `value` properties for better debugging

### Removed
- Zod external dependency (zero runtime dependencies achieved)
- ESLint configuration and dependencies due to compatibility issues
- Linting from prepublish process for more reliable builds

### Fixed
- Build process reliability issues
- Test structure and import paths
- Configuration validation error messages

## [0.0.1] - 2024-10-02

### Added
- Initial release of Logify Node SDK
- Cross-service logging with automatic request and correlation ID propagation
- AsyncLocalStorage-based context tracking for request isolation
- Express middleware for automatic ID injection and propagation
- Multiple transport support:
  - Console transport with JSON output
  - JSON transport for structured logging
  - Grafana Loki transport with HTTP push API
- Zero external runtime dependencies
- Native TypeScript validation (no Zod dependency)
- Comprehensive configuration system:
  - Environment variables
  - JSON configuration files
  - Programmatic configuration objects
- Logger features:
  - Structured logging with automatic context enrichment
  - Child loggers with bound context
  - Module name inference from stack traces (optional)
  - Error object extraction with stack traces
  - Log level filtering
- Request/Correlation ID semantics:
  - Fresh UUID v4 for each request (requestId)
  - 32-character alphanumeric correlation ID (ctid) that persists across services
- HTTP utilities for outbound request header propagation
- Production-ready error handling:
  - Graceful Loki transport failures
  - Configuration validation with detailed error messages
  - File operation error handling
- Performance optimizations:
  - Stack trace parsing with LRU caching
  - Early return for filtered log levels
- Comprehensive test coverage:
  - Unit tests for all core components
  - Integration smoke tests
  - Configuration validation tests
  - Transport functionality tests
- Complete TypeScript support with full type definitions
- Examples and documentation:
  - Express server example
  - Comprehensive README with usage examples
  - API documentation with TypeScript interfaces

### Technical Details
- Node.js >= 18.0.0 support
- TypeScript compilation to both ESM and CommonJS
- Jest testing framework with ts-jest
- Prettier code formatting
- GitHub Actions CI/CD workflows
- Release-please for automated versioning

---

## Version Format

This project uses [Semantic Versioning](https://semver.org/):
- **MAJOR** version for incompatible API changes
- **MINOR** version for backwards-compatible functionality additions  
- **PATCH** version for backwards-compatible bug fixes

## Categories

- **Added** for new features
- **Changed** for changes in existing functionality
- **Deprecated** for soon-to-be removed features
- **Removed** for now removed features
- **Fixed** for any bug fixes
- **Security** for vulnerability fixes
