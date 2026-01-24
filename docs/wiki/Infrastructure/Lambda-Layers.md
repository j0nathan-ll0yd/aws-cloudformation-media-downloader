# Lambda Layers

## Overview

This project uses AWS Lambda layers for:
1. **ADOT Layer** - AWS Distro for OpenTelemetry (tracing)
2. **yt-dlp Layer** - YouTube video downloader binary
3. **ffmpeg Layer** - Video processing binary

## Layer Inventory

| Layer | Type | Size | Used By | Version Tracking |
|-------|------|------|---------|------------------|
| ADOT (ARM64) | AWS-managed | N/A | 15 Lambdas | AWS-managed |
| ADOT (x86_64) | AWS-managed | N/A | StartFileUpload | AWS-managed |
| yt-dlp | Custom binary | 34 MB | StartFileUpload | `layers/yt-dlp/VERSION` |
| ffmpeg | Custom binary | 29 MB | StartFileUpload | `layers/ffmpeg/VERSION` |

## Layer Architecture

### ADOT Layer (AWS-Managed)

| Architecture | ARN | Used By |
|--------------|-----|---------|
| ARM64 | `aws-otel-nodejs-arm64-ver-1-30-2:1` | All Lambdas except StartFileUpload |
| x86_64 | `aws-otel-nodejs-amd64-ver-1-30-2:1` | StartFileUpload only |

The ADOT layer provides OpenTelemetry instrumentation for distributed tracing via X-Ray.

**Version Updates**: AWS manages these layers. To update, change the version in `terraform/main.tf`:
- `local.adot_layer_arn` (ARM64)
- `local.adot_layer_arn_x86_64` (x86_64)

### yt-dlp Layer (Custom)

| Property | Value |
|----------|-------|
| Size | ~34 MB compressed |
| Contents | `/opt/bin/yt-dlp_linux`, `/opt/cookies/youtube-cookies.txt` |
| Architecture | x86_64 (amd64) |
| Version Tracking | `layers/yt-dlp/VERSION` |
| Source | [yt-dlp GitHub Releases](https://github.com/yt-dlp/yt-dlp/releases) |

**Update Process** (yt-dlp releases frequently):
```bash
# Check for updates
pnpm run update:ytdlp:check

# Update VERSION and download
pnpm run update:ytdlp
tofu apply
```

The Terraform configuration automatically:
1. Triggers re-download when VERSION file changes
2. Downloads the binary from GitHub releases
3. Verifies SHA256 checksum
4. Tests binary version on Linux hosts

### ffmpeg Layer (Custom)

| Property | Value |
|----------|-------|
| Size | ~29 MB compressed |
| Contents | `/opt/bin/ffmpeg` |
| Architecture | x86_64 (amd64) |
| Version Tracking | `layers/ffmpeg/VERSION` |
| Source | [John Van Sickle static builds](https://johnvansickle.com/ffmpeg/) |

**Update Process** (ffmpeg is stable, infrequent updates):
```bash
# Check current version
pnpm run update:ffmpeg:check

# Update VERSION manually (prompted for new version)
pnpm run update:ffmpeg
rm layers/ffmpeg/bin/ffmpeg  # Force re-download
tofu apply
```

The Terraform configuration automatically:
1. Triggers re-download when VERSION file changes
2. Downloads the static build tarball
3. Verifies MD5 checksum
4. Extracts and installs the binary

## Why No Shared Code Layer?

The team evaluated adding a shared code layer for common modules (logging, powertools, entity queries) but decided against it:

| Factor | Impact |
|--------|--------|
| **Bundle Sizes** | Average Lambda is ~580KB. Layer overhead exceeds savings. |
| **Cold Start** | Layers add extraction time and lose esbuild optimization. |
| **Deployment** | Layer versioning adds coordination risk. |
| **Tree-Shaking** | esbuild already removes unused code per-Lambda. |

Each Lambda is bundled as a self-contained unit for optimal performance.

## Layer Configuration Details

### Terraform Resources

| Resource | File | Purpose |
|----------|------|---------|
| `null_resource.DownloadYtDlpBinary` | `terraform/feedly_webhook.tf` | Downloads yt-dlp binary |
| `null_resource.DownloadFfmpegBinary` | `terraform/feedly_webhook.tf` | Downloads ffmpeg binary |
| `archive_file.YtDlpLayer` | `terraform/feedly_webhook.tf` | Creates yt-dlp.zip |
| `archive_file.FfmpegLayer` | `terraform/feedly_webhook.tf` | Creates ffmpeg.zip |
| `aws_lambda_layer_version.YtDlp` | `terraform/feedly_webhook.tf` | yt-dlp layer resource |
| `aws_lambda_layer_version.Ffmpeg` | `terraform/feedly_webhook.tf` | ffmpeg layer resource |

### Layer Directory Structure

```
layers/
├── yt-dlp/
│   ├── bin/
│   │   └── yt-dlp_linux         # Binary at /opt/bin/yt-dlp_linux
│   ├── cookies/
│   │   └── youtube-cookies.txt  # Cookies at /opt/cookies/youtube-cookies.txt
│   └── VERSION                   # Version tracking file
└── ffmpeg/
    ├── bin/
    │   └── ffmpeg               # Binary at /opt/bin/ffmpeg
    └── VERSION                   # Version tracking file
```

### Environment Variables

StartFileUpload Lambda uses these layer-related environment variables:

| Variable | Value | Purpose |
|----------|-------|---------|
| `YTDLP_BINARY_PATH` | `/opt/bin/yt-dlp_linux` | Path to yt-dlp binary |
| `PATH` | `...:/opt/bin` | Includes /opt/bin for ffmpeg discovery |

## Troubleshooting

### Binary Download Fails

If Terraform fails to download binaries:
1. Check network connectivity to GitHub (yt-dlp) or johnvansickle.com (ffmpeg)
2. Verify checksum files are accessible
3. For yt-dlp, ensure the VERSION matches an existing release

### Layer Size Limits

AWS Lambda has a 250 MB unzipped deployment limit (including all layers):
- Current usage: ~63 MB (yt-dlp + ffmpeg) + ~500 KB (code) + ADOT
- Well within limits

### Architecture Mismatch

StartFileUpload uses x86_64 for binary compatibility. Using ARM64 binaries causes "cannot execute binary file" errors.

### Cookie File Issues

yt-dlp requires write access to cookie files. The Lambda copies cookies from the read-only `/opt/cookies/` to writable `/tmp/` at runtime.

## Related Documentation

- [OpenTofu Patterns](./OpenTofu-Patterns.md) - Infrastructure as Code patterns
- [Lambda Function Patterns](../TypeScript/Lambda-Function-Patterns.md) - Handler patterns
- [Bundle Size Analysis](./Bundle-Size-Analysis.md) - Bundle optimization
