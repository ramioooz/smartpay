# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/), and this project adheres to [Semantic Versioning](https://semver.org/).

## [0.6.0] - 2026-03-02
### Added
- Routing service active PSP health polling loop against `payment-srv /health`.
- Redis-based deduplication for routing outcome consumers.
- Unit coverage for routing outcome consumer and health poller flows.

### Changed
- Routing service now combines Kafka outcome ingestion and active polling to keep PSP health fresh.
- Per-package test scripts now run scoped Jest suites instead of placeholder commands.

## [0.5.0] - 2026-03-02
### Added
- Saga compensation step summaries with per-step status and duration tracking.
- Additional payment-srv unit coverage for compensation behavior.
- Merchant webhook dispatch consumer wiring from Kafka event stream.

### Changed
- Payment orchestration now logs `saga.summary` events for better incident debugging.

## [0.4.0] - 2025-06-15
### Added
- Provider/adapter pattern for FX rate sources and settlement data fetchers.
- Frankfurter API integration for real ECB exchange rates with simulated fallback.
- Per-PSP settlement data providers with registry pattern.
- Comprehensive race condition handling across all services.
- Consumer-side idempotency for Kafka event deduplication.

### Changed
- FX service now fetches real rates from ECB via Frankfurter API instead of purely simulated data.
- Reconciliation service uses settlement provider registry instead of monolithic fetcher.
- Circuit breaker state moved to Redis for cross-instance consistency.

## [0.3.0] - 2025-05-20
### Added
- Reconciliation service with automated discrepancy detection and classification.
- Crypto-rail PSP adapter for digital asset bridge simulation.
- Volume-based FX spread tiers.
- Webhook HMAC signature verification for merchant notifications.
- PgBouncer integration for connection pooling (mirrors production topology).

### Changed
- Routing engine now uses weighted scoring algorithm (was simple round-robin).
- Improved Kafka consumer error handling with dead letter queue support.
- Database architecture moved to schema-per-service with dedicated users.

### Fixed
- Race condition in idempotency key check under high concurrency.
- FX rate cache returning stale rates after Redis reconnection.

## [0.2.0] - 2025-04-10
### Added
- Routing service with PSP health tracking and scoring algorithm.
- FX service with rate caching and spread calculation.
- Saga-based compensation for failed payments.
- Merchant webhook delivery with exponential backoff retry.
- API key rotation with 24-hour deprecation window.

### Changed
- Moved from single PostgreSQL schema to multi-schema (added MongoDB for flexible configs).
- Switched logging from Winston to Pino (faster serialization).
- Payment state machine now supports full lifecycle including refunds.

## [0.1.0] - 2025-03-01
### Added
- Initial project scaffolding with Turborepo monorepo.
- Payment service with basic orchestration and state machine.
- Stripe and Wise PSP adapter stubs.
- API Gateway with Redis-backed rate limiting.
- Merchant service with API key management.
- Shared package with Kafka wrappers, middleware, and utilities.
- Docker Compose for local development.
- PostgreSQL schema and seed data.
- Prisma ORM integration with per-service schema generation.
