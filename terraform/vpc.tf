variable "cidr_vpc" {
  description = "CIDR block for the VPC"
  default = "10.1.0.0/16"
}
variable "cidr_subnet" {
  description = "CIDR block for the subnet"
  default = "10.1.0.0/24"
}
variable "availability_zone" {
  description = "availability zone to create subnet"
  default = "us-west-2a"
}
variable "public_key_path" {
  description = "Public key path"
  default = "~/.ssh/id_rsa.pub"
}
variable "instance_ami" {
  description = "AMI for aws EC2 instance"
  default = "ami-0cf31d971a3ca20d6"
}
variable "instance_type" {
  description = "type for aws EC2 instance"
  default = "t2.micro"
}
variable "environment_tag" {
  description = "Environment tag"
  default = "Production"
}

resource "aws_vpc" "Default" {
  cidr_block = "10.0.0.0/16"
  enable_dns_support   = true
  enable_dns_hostnames = true
  tags = {
    Name = "OfflineMediaDownloader"
  }
}

resource "aws_internet_gateway" "Default" {
  vpc_id = aws_vpc.Default.id
}

resource "aws_subnet" "Public" {
  vpc_id = aws_vpc.Default.id
  cidr_block = "10.0.0.0/24"
  map_public_ip_on_launch = true
  availability_zone = var.availability_zone
}

resource "aws_subnet" "Private" {
  vpc_id = aws_vpc.Default.id
  cidr_block = "10.0.1.0/24"
  map_public_ip_on_launch = true
  availability_zone = var.availability_zone
}

resource "aws_route_table" "Private" {
  vpc_id = aws_vpc.Default.id
}

resource "aws_route_table_association" "rta_subnet_private" {
  subnet_id      = aws_subnet.Private.id
  route_table_id = aws_route_table.Private.id
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
