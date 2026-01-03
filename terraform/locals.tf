# Extracted from main.tf for centralized configuration
# AWS Distro for OpenTelemetry (ADOT) collector layer
# Used for Lambda tracing - sends traces to X-Ray via OTLP
# Layer version list: https://aws-otel.github.io/docs/getting-started/lambda/lambda-js#lambda-layer
# AWS-managed layer published in account 901920570463
locals {
  # Lambda architecture: arm64 (Graviton2) for 20% cost savings and 13-24% faster cold starts
  # Exception: StartFileUpload uses x86_64 for yt-dlp/ffmpeg binary compatibility
  lambda_architecture = var.lambda_architecture

  # AWS Distro for OpenTelemetry (ADOT) collector layers
  # Must match Lambda architecture - using wrong arch causes "cannot execute binary file" errors
  adot_layer_arn        = "arn:aws:lambda:${data.aws_region.current.id}:901920570463:layer:aws-otel-nodejs-${var.lambda_architecture == "arm64" ? "arm64" : "amd64"}-ver-1-30-2:1"
  adot_layer_arn_x86_64 = "arn:aws:lambda:${data.aws_region.current.id}:901920570463:layer:aws-otel-nodejs-amd64-ver-1-30-2:1"

  # Common tags for all resources (drift detection & identification)
  common_tags = {
    ManagedBy   = "terraform"
    Project     = "media-downloader"
    Environment = var.environment
  }

  # Common environment variables for all lambdas with ADOT layer
  # OPENTELEMETRY_EXTENSION_LOG_LEVEL=warn silences extension INFO logs (~14 lines per cold start)
  # OPENTELEMETRY_COLLECTOR_CONFIG_URI points to custom config that fixes deprecated telemetry.metrics.address
  # NODE_OPTIONS suppresses url.parse() deprecation warning from AWS SDK v3
  # LOG_LEVEL varies by environment (DEBUG for development, INFO for production)
  #
  # Note: OTEL_EXPORTER_OTLP_ENDPOINT and OTEL_PROPAGATORS are not needed as ADOT layer
  # defaults to localhost:4318 (HTTP) and X-Ray propagation respectively.
  common_lambda_env = {
    OPENTELEMETRY_EXTENSION_LOG_LEVEL  = "warn"
    OPENTELEMETRY_COLLECTOR_CONFIG_URI = "/var/task/collector.yaml"
    NODE_OPTIONS                       = "--no-deprecation"
    LOG_LEVEL                          = var.environment == "production" ? "INFO" : "DEBUG"
    # Aurora DSQL connection configuration
    # Aurora DSQL endpoints follow the pattern: <identifier>.dsql.<region>.on.aws
    DSQL_CLUSTER_ENDPOINT = "${aws_dsql_cluster.media_downloader.identifier}.dsql.${data.aws_region.current.id}.on.aws"
    DSQL_REGION           = data.aws_region.current.id
  }
}
