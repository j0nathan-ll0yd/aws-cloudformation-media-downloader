# SOPS Secrets Data Source
#
# Decrypts environment-specific secrets file using SOPS/age.
# Requires SOPS_AGE_KEY_FILE environment variable to be set.

data "sops_file" "secrets" {
  source_file = "${path.module}/../secrets.${var.environment == "staging" ? "staging" : "prod"}.enc.yaml"
}
