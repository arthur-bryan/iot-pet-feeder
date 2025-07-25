provider "aws" {
  region = var.aws_region
}

# Add GitHub provider for fetching repository details
provider "github" {
  token = var.github_token
}

data "aws_caller_identity" "current" {}

# Data source to fetch the AWS IoT Core Data Plane endpoint
data "aws_iot_endpoint" "iot_data_endpoint" {
  endpoint_type = "iot:Data-ATS" # Use ATS endpoint for secure connection
}

# Data source to get GitHub repository URL
data "github_repository" "this" {
  full_name = "${var.github_owner}/${var.github_repo_name}"
}

# S3 Bucket for Lambda Deployment Packages (shared by both Lambdas)
resource "aws_s3_bucket" "lambda_deployment_bucket" {
  bucket = "${var.project_name}-lambda-packages-${var.aws_region}-${data.aws_caller_identity.current.account_id}"

  tags = {
    Project = var.project_name
    Environment = var.environment
  }
}

# --- IAM Policies (shared across multiple resources/modules) ---
resource "aws_iam_policy" "iot_publish_policy" {
  name        = "${var.project_name}-iot-publish-policy-${var.environment}"
  description = "IAM policy for Lambda to publish messages to AWS IoT Core"

  policy = jsonencode({
    Version = "2012-10-17",
    Statement = [
      {
        Action = [
          "iot:Publish",
          "iot:Connect"
        ],
        Effect = "Allow",
        Resource = [
          "arn:aws:iot:${var.aws_region}:${data.aws_caller_identity.current.account_id}:topic/petfeeder/commands",
          "arn:aws:iot:${var.aws_region}:${data.aws_caller_identity.current.account_id}:client/${module.iot_device.thing_name}"
        ]
      }
    ]
  })
}

resource "aws_iam_policy" "dynamodb_access_policy" {
  name        = "${var.project_name}-dynamodb-access-policy-${var.environment}"
  description = "IAM policy for Lambda functions to access DynamoDB tables"

  policy = jsonencode({
    Version = "2012-10-17",
    Statement = [
      {
        Action = [
          "dynamodb:GetItem",
          "dynamodb:PutItem",
          "dynamodb:UpdateItem",
          "dynamodb:DeleteItem",
          "dynamodb:Scan",
          "dynamodb:Query"
        ],
        Effect = "Allow",
        Resource = [
          module.feed_history_table.table_arn,
          module.device_status_table.table_arn,
          module.feed_schedule_table.table_arn
        ]
      }
    ]
  })
}

# --- Module Calls ---

# DynamoDB Tables
module "feed_history_table" {
  source       = "../../modules/dynamodb_table"
  project_name = var.project_name
  table_name   = "${var.project_name}-FeedHistory-${var.environment}"
  hash_key     = "feed_id"
  hash_key_type = "S"
}

module "device_status_table" {
  source       = "../../modules/dynamodb_table"
  project_name = var.project_name
  table_name   = "${var.project_name}-DeviceStatus-${var.environment}"
  hash_key     = "thing_id"
  hash_key_type = "S"
}

module "feed_schedule_table" {
  source       = "../../modules/dynamodb_table"
  project_name = var.project_name
  table_name   = "${var.project_name}-FeedSchedules-${var.environment}"
  hash_key     = "schedule_id"
  hash_key_type = "S"
}

# IoT Device Resources
module "iot_device" {
  source          = "../../modules/iot_device"
  project_name    = var.project_name
  aws_region      = var.aws_region
  aws_account_id  = data.aws_caller_identity.current.account_id
  thing_name      = "${var.project_name}-Device-${var.environment}"
  policy_name     = "${var.project_name}-DevicePolicy-${var.environment}"
  publish_topic   = "petfeeder/commands"
  subscribe_topic = "petfeeder/status"
}

# FastAPI Backend Lambda
module "api_lambda" {
  source                = "../../modules/lambda"
  project_name          = var.project_name
  aws_region            = var.aws_region
  aws_account_id        = data.aws_caller_identity.current.account_id
  function_name         = "${var.project_name}-api-${var.environment}"
  s3_bucket_id          = aws_s3_bucket.lambda_deployment_bucket.id
  local_zip_path        = "../../${var.build_dir}/${var.api_lambda_zip_name}"
  s3_key                = var.api_lambda_zip_name
  handler               = "lambda_handler.handler"
  runtime               = var.python_version
  timeout               = 30
  memory_size           = 256
  environment_variables = {
    PROJECT_NAME             = var.project_name,
    AWS_REGION               = var.aws_region,
    IOT_ENDPOINT             = data.aws_iot_endpoint.iot_data_endpoint.endpoint_address,
    IOT_PUBLISH_TOPIC        = "petfeeder/commands",
    IOT_THING_ID             = module.iot_device.thing_name,
    FEED_HISTORY_TABLE_NAME  = module.feed_history_table.table_name,
    DEVICE_STATUS_TABLE_NAME = module.device_status_table.table_name,
    FEED_SCHEDULE_TABLE_NAME = module.feed_schedule_table.table_name
  }
  attached_policy_arns = [
    aws_iam_policy.iot_publish_policy.arn,
    aws_iam_policy.dynamodb_access_policy.arn
  ]
}

# IoT Status Updater Lambda
module "status_lambda" {
  source                = "../../modules/lambda"
  project_name          = var.project_name
  aws_region            = var.aws_region
  aws_account_id        = data.aws_caller_identity.current.account_id
  function_name         = "${var.project_name}-iot-status-updater-${var.environment}"
  s3_bucket_id          = aws_s3_bucket.lambda_deployment_bucket.id
  local_zip_path        = "../../${var.build_dir}/${var.status_lambda_zip_name}"
  s3_key                = var.status_lambda_zip_name
  handler               = "status_updater.handler"
  runtime               = var.python_version
  timeout               = 10
  memory_size           = 128
  environment_variables = {
    PROJECT_NAME             = var.project_name,
    AWS_REGION               = var.aws_region,
    DEVICE_STATUS_TABLE_NAME = module.device_status_table.table_name,
    IOT_THING_ID             = module.iot_device.thing_name
  }
  attached_policy_arns = [
    aws_iam_policy.dynamodb_access_policy.arn
  ]
}

# API Gateway
module "api_gateway" {
  source               = "../../modules/api_gateway"
  project_name         = var.project_name
  api_name             = "${var.project_name}-api-gateway-${var.environment}"
  api_description      = "API Gateway for the Smart Pet Feeder FastAPI backend (${var.environment} environment)"
  lambda_invoke_arn    = module.api_lambda.lambda_arn
  lambda_function_name = module.api_lambda.lambda_function_name
  stage_name           = var.environment
}

# IoT Topic Rule
module "iot_status_rule" {
  source                        = "../../modules/iot_rule"
  project_name                  = var.project_name
  rule_name                     = "${var.project_name}-StatusRule-${var.environment}"
  rule_description              = "Routes device status messages to a Lambda function for DynamoDB update (${var.environment} environment)."
  mqtt_topic                    = "petfeeder/status"
  lambda_function_arn           = module.status_lambda.lambda_arn
  lambda_function_name_for_permission = module.status_lambda.lambda_function_name
  lambda_execution_role_arn     = module.status_lambda.lambda_execution_role_arn
}

# AWS Amplify App for Frontend
module "amplify_app" {
  source              = "../../modules/amplify_app"
  project_name        = var.project_name
  environment         = var.environment
  app_name            = "${var.project_name}-frontend-${var.environment}"
  github_repo_url     = data.github_repository.this.html_url # Use the URL from the github_repository data source
  github_token        = var.github_token
  # The build_spec default in the module is already configured for your frontend/web-control-panel/public
  environment_variables = {
    # You can pass frontend environment variables here, e.g.,
    # VITE_API_BASE_URL = module.api_gateway.api_gateway_invoke_url
  }
}
