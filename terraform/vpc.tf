variable "availability_zone" {
  description = "availability zone to create subnet"
  default = "us-west-2a"
}

resource "aws_vpc" "Default" {
  cidr_block = "10.0.0.0/16"
  enable_dns_support   = true
  enable_dns_hostnames = true
  tags = {
    Name = "OfflineMediaDownloader"
  }
}

resource "aws_subnet" "Public" {
  vpc_id = aws_vpc.Default.id
  cidr_block = "10.0.0.0/24"
  map_public_ip_on_launch = true
  availability_zone = var.availability_zone
  tags = {
    Name = "Public"
  }
}

resource "aws_subnet" "Private" {
  vpc_id = aws_vpc.Default.id
  cidr_block = "10.0.1.0/24"
  map_public_ip_on_launch = true
  availability_zone = var.availability_zone
  tags = {
    Name = "Private"
  }
}

resource "aws_route_table_association" "rta_subnet_private" {
  subnet_id      = aws_subnet.Private.id
  route_table_id = aws_route_table.Private.id
}

resource "aws_route_table" "Public" {
  vpc_id = aws_vpc.Default.id

  route {
    cidr_block = "0.0.0.0/0"
    nat_gateway_id = aws_nat_gateway.gw.id
  }
  tags = {
    Name = "Public"
  }
}

resource "aws_route_table" "Private" {
  vpc_id = aws_vpc.Default.id

  route {
    cidr_block = "0.0.0.0/0"
    nat_gateway_id = aws_nat_gateway.gw.id
  }
  tags = {
    Name = "Private"
  }
}

resource "aws_route_table_association" "rta_subnet_public" {
  subnet_id      = aws_subnet.Public.id
  route_table_id = aws_route_table.Public.id
}

resource "aws_security_group" "Lambdas" {
  name = "Lambdas"
  description = "Security group for Lambdas"
  vpc_id = aws_vpc.Default.id

  ingress {
    protocol  = -1
    self      = true
    from_port = 0
    to_port   = 0
    cidr_blocks = ["10.2.0.0/16"]
  }

  /*
  egress {
    from_port   = 443
    to_port     = 443
    protocol    = "tcp"
  }
  */

  egress {
    from_port = 443
    to_port = 443
    protocol = "tcp"
    cidr_blocks = ["0.0.0.0/0"]
  }

  egress {
    from_port   = 0
    to_port     = 0
    protocol    = "-1"
    prefix_list_ids = [
      aws_vpc_endpoint.S3.prefix_list_id,
      aws_vpc_endpoint.DynamoDB.prefix_list_id
    ]
  }
}

resource "aws_internet_gateway" "gw" {
  vpc_id = aws_vpc.Default.id
}
resource "aws_eip" "one" {
  vpc                       = true
  associate_with_private_ip = "10.0.1.10"
}

resource "aws_nat_gateway" "gw" {
  subnet_id = aws_subnet.Public.id
  depends_on = [aws_internet_gateway.gw]
  allocation_id = aws_eip.one.id
}

resource "aws_route_table_association" "InternetGatewayRouteAssociation" {
  subnet_id     = aws_subnet.Private.id
  route_table_id = aws_route_table.Private.id
}

# It's alive! A Lambda (in a VPC) accessing an S3 bucket
# FIRST: https://stackoverflow.com/questions/60769970/how-api-gateway-talk-to-firehose-vpc-endpoint
# SECOND: https://stackoverflow.com/questions/60678826/aws-route-from-public-api-gateway-to-in-vpc-lambda
# TODO: https://www.infoq.com/articles/aws-vpc-explained/
# TODO: https://medium.com/tensult/creating-vpc-endpoint-for-amazon-s3-using-terraform-7a15c840d36f

# TODO: To be even more paranoid, I could create separate private subnets to narrow scope lambdas to the services they need
# TODO: Access Required: ListFiles: S3
#
# Allows lambda functions in a private VPC to access S3
resource "aws_vpc_endpoint" "S3" {
  vpc_id       = aws_vpc.Default.id
  service_name = "com.amazonaws.us-west-2.s3"
}

resource "aws_vpc_endpoint_route_table_association" "PrivateS3" {
  vpc_endpoint_id = aws_vpc_endpoint.S3.id
  route_table_id = aws_route_table.Private.id
}

# Allows lambda functions in a private VPC to access DynamoDB
resource "aws_vpc_endpoint" "DynamoDB" {
  vpc_id       = aws_vpc.Default.id
  service_name = "com.amazonaws.us-west-2.dynamodb"
}

resource "aws_vpc_endpoint_route_table_association" "PrivateDynamoDB" {
  vpc_endpoint_id = aws_vpc_endpoint.DynamoDB.id
  route_table_id = aws_route_table.Private.id
}

data "aws_vpc_endpoint_service" "states" {
  count = 1
  service = "states"
}

# Allows lambda functions in a private VPC to access StepFunctions
resource "aws_vpc_endpoint" "StepFunctions" {
  vpc_id       = aws_vpc.Default.id
  service_name = data.aws_vpc_endpoint_service.states[0].service_name
  vpc_endpoint_type = "Interface"

  security_group_ids = [
    aws_security_group.Lambdas.id,
  ]

  subnet_ids = [aws_subnet.Private.id]
  private_dns_enabled = true
}

resource "aws_vpc_endpoint_route_table_association" "PrivateStepFunctions" {
  vpc_endpoint_id = aws_vpc_endpoint.StepFunctions.id
  route_table_id = aws_route_table.Private.id
}

# Flow Logging
resource "aws_flow_log" "Default" {
  iam_role_arn    = aws_iam_role.VPCFlowLogRole.arn
  log_destination = aws_cloudwatch_log_group.VPCFlowLog.arn
  traffic_type    = "ALL"
  vpc_id          = aws_vpc.Default.id
  max_aggregation_interval = 60
}

resource "aws_cloudwatch_log_group" "VPCFlowLog" {
  name = "VPCFlowLog"
}

resource "aws_iam_role" "VPCFlowLogRole" {
  name = "VPCFlowLogRole"
  assume_role_policy = data.aws_iam_policy_document.vpc-flow-logs-assume-role-policy.json
}

data "aws_iam_policy_document" "vpc-flow-logs-assume-role-policy" {
  statement {
    actions = ["sts:AssumeRole"]
    principals {
      type        = "Service"
      identifiers = ["vpc-flow-logs.amazonaws.com"]
    }
  }
}

data "aws_iam_policy_document" "VPCLogging" {
  statement {
    actions = [
      "logs:CreateLogGroup",
      "logs:CreateLogStream",
      "logs:PutLogEvents",
      "logs:DescribeLogGroups",
      "logs:DescribeLogStreams"
    ]
    resources = ["*"]
  }
}


resource "aws_iam_role_policy" "VPCLogging" {
  name = "VPCLogging"
  role = aws_iam_role.VPCFlowLogRole.id
  policy = data.aws_iam_policy_document.VPCLogging.json
}
