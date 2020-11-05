resource "aws_iam_role" "CloudfrontMiddlewareRole" {
  name               = "CloudfrontMiddlewareRole"
  assume_role_policy = data.aws_iam_policy_document.lamdba-edge-assume-role-policy.json
}

resource "aws_iam_role_policy_attachment" "CloudfrontMiddlewarePolicyLogging" {
  role       = aws_iam_role.CloudfrontMiddlewareRole.name
  policy_arn = aws_iam_policy.CommonLambdaLogging.arn
}

resource "aws_cloudwatch_log_group" "CloudfrontMiddleware" {
  name              = "/aws/lambda/${aws_lambda_function.CloudfrontMiddleware.function_name}"
  retention_in_days = 14
}

provider "aws" {
  alias  = "us_east_1"
  region = "us-east-1"
}

data "archive_file" "lambda_edge_zip" {
  type        = "zip"
  output_path = "/tmp/lambda_edge.zip"
  source {
    content  = <<EOF
module.exports.handler = (event, context, callback) => {
    console.log(JSON.stringify(event));
	const request = event.Records[0].cf.request;
    console.log(JSON.stringify(request));
    if (request.querystring && request.querystring.match(/ApiKey/)) {
      const querystringpart = request.querystring.split("=");
      const headers = request.headers;
      headers['x-api-key'] = [{"key": "X-API-Key", "value": querystringpart[1]}];
      console.log(JSON.stringify(headers));
      request.headers = headers;
      console.log('FINAL REQUEST:'+JSON.stringify(request));
	  callback(null, request);
    }
    else {
      callback(null, request);
    }
};
EOF
    filename = "main.js"
  }
}

resource "aws_lambda_function" "CloudfrontMiddleware" {
  description = "A lambda that acts as middleware before hitting the API."
  filename         = data.archive_file.lambda_edge_zip.output_path
  source_code_hash = data.archive_file.lambda_edge_zip.output_base64sha256
  function_name = "CloudfrontMiddleware"
  role = aws_iam_role.CloudfrontMiddlewareRole.arn
  handler = "main.handler"
  runtime = "nodejs12.x"
  publish = true
  provider = aws.us_east_1
}

resource "aws_cloudfront_distribution" "Default" {
  origin {
    domain_name = replace(aws_api_gateway_deployment.Main.invoke_url, "/^https?://([^/]*).*/", "$1")
    origin_path = "/${aws_api_gateway_stage.Production.stage_name}"
    origin_id = "CloudfrontMiddleware"
    custom_origin_config {
      origin_protocol_policy = "https-only"
      origin_ssl_protocols = ["TLSv1.2"]
      http_port = 80
      https_port = 443
    }
  }
  ordered_cache_behavior {
    lambda_function_association {
      event_type = "viewer-request"
      lambda_arn = aws_lambda_function.CloudfrontMiddleware.qualified_arn
    }
    allowed_methods = ["DELETE", "GET", "HEAD", "OPTIONS", "PATCH", "POST", "PUT"]
    cached_methods = ["GET", "HEAD"]
    path_pattern = "*"
    target_origin_id = "CloudfrontMiddleware"
    viewer_protocol_policy = "https-only"
    forwarded_values {
      query_string = true
      headers = ["X-API-Key"]
      cookies {
        forward = "none"
      }
    }
  }
  enabled = true
  default_cache_behavior {
    viewer_protocol_policy = "https-only"
    allowed_methods = ["DELETE", "GET", "HEAD", "OPTIONS", "PATCH", "POST", "PUT"]
    cached_methods = ["GET", "HEAD"]
    target_origin_id = "CloudfrontMiddleware"
    forwarded_values {
      query_string = true
      headers = ["X-API-Key"]
      cookies {
        forward = "none"
      }
    }
  }
  restrictions {
    geo_restriction {
      restriction_type = "whitelist"
      locations        = ["US"]
    }
  }
  viewer_certificate {
    cloudfront_default_certificate = true
  }
}
