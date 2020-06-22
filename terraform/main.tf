provider "aws" {
  profile = "default"
  region  = "us-west-2"
}
resource "aws_s3_bucket" "file_bucket" {
  bucket = "lifegames-media-downloader-files"
  acl    = "public-read"
}

resource "aws_lambda_layer_version" "lambda_layer" {
  filename            = "./../build/artifacts/dist.zip"
  layer_name          = "node_modules_layer"
  compatible_runtimes = ["nodejs12.x"]
}
