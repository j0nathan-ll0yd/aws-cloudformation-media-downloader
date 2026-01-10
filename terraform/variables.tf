# Variables for RefreshYouTubeCookies Lambda
# These are populated from environment variables (TF_VAR_*) via .env file

variable "youtube_email" {
  description = "YouTube/Google account email for cookie extraction"
  type        = string
  sensitive   = true
  default     = ""
}

variable "youtube_password" {
  description = "YouTube/Google account app password for cookie extraction"
  type        = string
  sensitive   = true
  default     = ""
}
