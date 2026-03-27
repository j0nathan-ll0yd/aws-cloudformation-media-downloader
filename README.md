# Media Downloader

[![Built with Mantle](https://img.shields.io/badge/built%20with-Mantle-blue)](../mantle)

A serverless YouTube media downloader with a companion [iOS App](https://github.com/j0nathan-ll0yd/ios-OfflineMediaDownloader). Built on the [Mantle framework](../mantle) and deployed to AWS.

## Quick Start

```bash
# Install dependencies
pnpm install

# Build all Lambda functions
npx mantle build

# Deploy to staging
npx mantle deploy --stage staging

# Deploy to production
npx mantle deploy --stage production
```

## Architecture

18 Lambda functions organized across three categories:

- **API** — REST endpoints routed via API Gateway (file-system routing)
- **EventBridge** — Async event-driven handlers (exports, notifications)
- **Standalone** — Direct-invocation handlers (auth, webhooks)

**AWS services**: Lambda, API Gateway, Aurora DSQL, S3, SNS (APNS), SQS, EventBridge, CloudWatch

**[Architecture diagram](https://gitdiagram.com/repo/j0nathan-ll0yd/mantle-OfflineMediaDownloader)** (via GitDiagram)

## Key Features

- **Better Auth** — Apple Sign In (ID token flow) with 30-day session management
- **Aurora DSQL** — Serverless PostgreSQL with Drizzle ORM and type-safe queries
- **Media downloads** — yt-dlp + FFmpeg Lambda layer, auto-updated weekly via GitHub Actions
- **Push notifications** — APNS delivery via SNS
- **Custom authorizer** — Query-based API tokens for Feedly integration
- **EventBridge** — Async event bus for decoupled exports and processing
- **SQS** — Queued media download jobs
- **Fixture capture** — Production request/response logging from CloudWatch for test generation
- **pnpm lifecycle protection** — Supply chain attack hardening

## Documentation

- **Project conventions**: [`CLAUDE.md`](CLAUDE.md)
- **Framework docs**: [`../mantle/CLAUDE.md`](../mantle/CLAUDE.md)
- **Wiki**: [GitHub Wiki](https://github.com/j0nathan-ll0yd/mantle-OfflineMediaDownloader/wiki)

## License

ISC
