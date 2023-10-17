
// TODO: Make these either proper secrets or based on ENV
variable "APNS_SANDBOX_TEAM" {
  type      = string
  sensitive = true
  nullable  = false
}

variable "APNS_SANDBOX_KEY_ID" {
  type      = string
  sensitive = true
  nullable  = false
}

variable "APNS_SANDBOX_DEFAULT_TOPIC" {
  type      = string
  sensitive = true
  nullable  = false
}

variable "apnsSigningKey" {
  type    = string
  default = "./../../../secure/APNS_SANDBOX/signingKey.txt"
  nullable  = false
}

variable "apnsPrivateKeyPath" {
  type    = string
  default = "./../../../secure/APNS_SANDBOX/privateKey.txt"
}

variable "apnsCertificatePath" {
  type    = string
  default = "./../../../secure/APNS_SANDBOX/certificate.txt"
}
