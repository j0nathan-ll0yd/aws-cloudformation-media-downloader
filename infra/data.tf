# Public IP Lookup
#
# Used for local development and testing.

data "http" "icanhazip" {
  url = "https://ipv4.icanhazip.com/"
}
