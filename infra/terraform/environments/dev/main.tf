# infra/terraform/environments/dev/main.tf
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
    Environment = var.environment # Using the new environment variable
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
          module.feed_schedule_table.table_arn,
          module.feed_config_table.table_arn,
          module.pending_users_table.table_arn # ADDED: Access to pending users table
        ]
      }
    ]
  })
}

# --- NEW: IAM Role for IoT Rule CloudWatch Error Action ---
resource "aws_iam_role" "iot_rule_cloudwatch_role" {
  name = "${var.project_name}-IoTRuleCloudWatchRole-${var.environment}"

  assume_role_policy = jsonencode({
    Version = "2012-10-17",
    Statement = [
      {
        Action = "sts:AssumeRole",
        Effect = "Allow",
        Principal = {
          Service = "iot.amazonaws.com" # Allow IoT service to assume this role
        }
      }
    ]
  })

  tags = {
    Project = var.project_name
    Environment = var.environment
  }
}

resource "aws_iam_policy" "iot_rule_cloudwatch_policy" {
  name        = "${var.project_name}-IoTRuleCloudWatchPolicy-${var.environment}"
  description = "IAM policy for IoT Rule to publish to CloudWatch Alarms"

  policy = jsonencode({
    Version = "2012-10-17",
    Statement = [
      {
        Action = [
          "cloudwatch:PutMetricAlarm"
        ],
        Effect = "Allow",
        Resource = "*" # Or restrict to specific alarm ARNs if known
      }
    ]
  })
}

resource "aws_iam_role_policy_attachment" "iot_rule_cloudwatch_attach" {
  role       = aws_iam_role.iot_rule_cloudwatch_role.name
  policy_arn = aws_iam_policy.iot_rule_cloudwatch_policy.arn
}
# --- END NEW IAM Role ---

# --- NEW: IAM Policy for Cognito Pre-Sign-up Lambda ---
resource "aws_iam_policy" "cognito_pre_sign_up_lambda_policy" {
  name        = "${var.project_name}-CognitoPreSignUpLambdaPolicy-${var.environment}"
  description = "IAM policy for Cognito Pre-Sign-up Lambda to manage users and send notifications"

  policy = jsonencode({
    Version = "2012-10-17",
    Statement = [
      {
        Action = [
          "cognito-idp:AdminConfirmSignUp",
          "cognito-idp:AdminDisableUser", # For potential future rejection logic
          "cognito-idp:ListUsers" # To check for existing users/admin
        ],
        Effect = "Allow",
        Resource = module.cognito_user_pool.user_pool_arn
      },
      {
        Action = [
          "dynamodb:PutItem",
          "dynamodb:GetItem",
          "dynamodb:UpdateItem",
          "dynamodb:Scan" # For checking pending users
        ],
        Effect = "Allow",
        Resource = module.pending_users_table.table_arn
      },
      {
        Action = [
          "ses:SendEmail", # For sending approval emails (if using SES directly)
          "sns:Publish"    # For publishing to SNS topic (if using SNS for emails)
        ],
        Effect = "Allow",
        Resource = aws_sns_topic.admin_notification_topic.arn # Allow publishing to the SNS topic
      }
    ]
  })
}

# --- NEW: SNS Topic for Admin Notifications ---
resource "aws_sns_topic" "admin_notification_topic" {
  name = "${var.project_name}-AdminApprovalNotifications-${var.environment}"

  tags = {
    Project = var.project_name
    Environment = var.environment
  }
}

resource "aws_sns_topic_subscription" "admin_email_subscription" {
  topic_arn = aws_sns_topic.admin_notification_topic.arn
  protocol  = "email"
  endpoint  = var.admin_email # Admin's email address
}



# --- Module Calls ---

# Lambda Layer for Python Dependencies
module "python_dependencies_layer" {
  source            = "../../modules/lambda_layer"
  project_name      = var.project_name
  layer_name        = "${var.project_name}-python-deps-${var.environment}"
  s3_bucket_id      = aws_s3_bucket.lambda_deployment_bucket.id
  requirements_file = "../../../../backend/requirements.txt"
  runtime           = var.python_version
}

# DynamoDB Tables
module "feed_history_table" {
  source       = "../../modules/dynamodb_table"
  project_name = var.project_name
  table_name   = "${var.project_name}-feed-history-${var.environment}"
  hash_key     = "feed_id"
  hash_key_type = "S"
  enable_streams = true  # Enable streams for email notifications
  stream_view_type = "NEW_IMAGE"
}

module "device_status_table" {
  source       = "../../modules/dynamodb_table"
  project_name = var.project_name
  table_name   = "${var.project_name}-device-status-${var.environment}" # Corrected table name for consistency
  hash_key     = "thing_id"
  hash_key_type = "S"
}

module "feed_schedule_table" {
  source       = "../../modules/dynamodb_table"
  project_name = var.project_name
  table_name   = "${var.project_name}-feed-schedules-${var.environment}" # Corrected table name for consistency
  hash_key     = "schedule_id"
  hash_key_type = "S"
}

module "feed_config_table" {
  source       = "../../modules/dynamodb_table"
  project_name = var.project_name
  table_name   = "${var.project_name}-feed-config-${var.environment}"
  hash_key     = "config_key"
  hash_key_type = "S"
}

# NEW: DynamoDB table for pending user registrations
module "pending_users_table" {
  source       = "../../modules/dynamodb_table"
  project_name = var.project_name
  table_name   = "${var.project_name}-pending-users-${var.environment}"
  hash_key     = "email"
  hash_key_type = "S"
}

# IoT Device Resources
module "iot_device" {
  source          = "../../modules/iot_device"
  project_name    = var.project_name
  aws_region      = var.aws_region
  aws_account_id  = data.aws_caller_identity.current.account_id
  thing_name      = "${var.project_name}-device-${var.environment}"
  policy_name     = "${var.project_name}-device-policy-${var.environment}"
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
  source_path           = "../../../../backend"
  handler               = "lambda_handler.handler"
  runtime               = var.python_version
  timeout               = 30
  memory_size           = 256
  layer_arns            = [module.python_dependencies_layer.layer_arn]
  environment_variables = {
    PROJECT_NAME             = var.project_name,
    IOT_ENDPOINT             = data.aws_iot_endpoint.iot_data_endpoint.endpoint_address,
    IOT_PUBLISH_TOPIC        = "petfeeder/commands",
    IOT_THING_ID             = module.iot_device.thing_name,
    DYNAMO_FEED_HISTORY_TABLE  = module.feed_history_table.table_name,
    DEVICE_STATUS_TABLE_NAME = module.device_status_table.table_name,
    DYNAMO_FEED_SCHEDULE_TABLE = module.feed_schedule_table.table_name,
    DYNAMO_FEED_CONFIG_TABLE_NAME = module.feed_config_table.table_name,
    SNS_TOPIC_ARN            = aws_sns_topic.feed_notification_topic.arn
  }
  attached_policy_arns = [
    aws_iam_policy.iot_publish_policy.arn,
    aws_iam_policy.dynamodb_access_policy.arn,
    aws_iam_policy.sns_manage_subscriptions_policy.arn
  ]
}

# NEW: IAM Policy for API Lambda to manage SNS subscriptions
resource "aws_iam_policy" "sns_manage_subscriptions_policy" {
  name        = "${var.project_name}-sns-manage-subscriptions-policy-${var.environment}"
  description = "IAM policy for API Lambda to manage SNS subscriptions"

  policy = jsonencode({
    Version = "2012-10-17",
    Statement = [
      {
        Action = [
          "sns:Subscribe",
          "sns:Unsubscribe",
          "sns:ListSubscriptionsByTopic"
        ],
        Effect = "Allow",
        Resource = [
          aws_sns_topic.feed_notification_topic.arn
        ]
      }
    ]
  })
}

# IoT Status Updater Lambda
module "status_lambda" {
  source                = "../../modules/lambda"
  project_name          = var.project_name
  aws_region            = var.aws_region
  aws_account_id        = data.aws_caller_identity.current.account_id
  function_name         = "${var.project_name}-iot-status-updater-${var.environment}"
  s3_bucket_id          = aws_s3_bucket.lambda_deployment_bucket.id
  source_path           = "../../../../backend"
  handler               = "status_updater.handler" # This will be a new Python file
  runtime               = var.python_version
  timeout               = 10
  memory_size           = 128
  layer_arns            = [module.python_dependencies_layer.layer_arn]
  environment_variables = {
    PROJECT_NAME             = var.project_name,
    DEVICE_STATUS_TABLE_NAME = module.device_status_table.table_name,
    IOT_THING_ID             = module.iot_device.thing_name
  }
  attached_policy_arns = [
    aws_iam_policy.dynamodb_access_policy.arn
  ]
}

# Feed Event Logger Lambda
module "feed_event_logger_lambda" {
  source                = "../../modules/lambda"
  project_name          = var.project_name
  aws_region            = var.aws_region
  aws_account_id        = data.aws_caller_identity.current.account_id
  function_name         = "${var.project_name}-feed-event-logger-${var.environment}"
  s3_bucket_id          = aws_s3_bucket.lambda_deployment_bucket.id
  source_path           = "../../../../backend"
  handler               = "feed_event_logger.handler"
  runtime               = var.python_version
  timeout               = 10
  memory_size           = 128
  layer_arns            = [module.python_dependencies_layer.layer_arn]
  environment_variables = {
    PROJECT_NAME                = var.project_name,
    DYNAMO_FEED_HISTORY_TABLE   = module.feed_history_table.table_name
  }
  attached_policy_arns = [
    aws_iam_policy.dynamodb_access_policy.arn
  ]
}

# NEW: Lambda for Cognito Pre-Sign-up Trigger
module "pre_sign_up_lambda" {
  source                = "../../modules/lambda"
  project_name          = var.project_name
  aws_region            = var.aws_region
  aws_account_id        = data.aws_caller_identity.current.account_id
  function_name         = "${var.project_name}-cognito-pre-sign-up-${var.environment}"
  s3_bucket_id          = aws_s3_bucket.lambda_deployment_bucket.id
  source_path           = "../../../../backend" # Assuming pre_sign_up_handler.py will be in backend root
  handler               = "pre_sign_up_handler.handler" # This will be a new Python file
  runtime               = var.python_version
  timeout               = 10
  memory_size           = 128
  layer_arns            = [module.python_dependencies_layer.layer_arn]
  environment_variables = {
    PROJECT_NAME             = var.project_name,
    ADMIN_EMAIL              = var.admin_email,
    PENDING_USERS_TABLE_NAME = module.pending_users_table.table_name,
    SNS_TOPIC_ARN            = aws_sns_topic.admin_notification_topic.arn
  }
  attached_policy_arns = [
    aws_iam_policy.cognito_pre_sign_up_lambda_policy.arn,
    # Add CloudWatch logging policy if not already handled by the lambda module
  ]
}

# NEW: SNS Topic for Feed Event Email Notifications
resource "aws_sns_topic" "feed_notification_topic" {
  name = "${var.project_name}-FeedNotifications-${var.environment}"

  tags = {
    Project = var.project_name
    Environment = var.environment
  }
}

# NEW: Lambda for Feed Event Email Notifications
module "feed_notifier_lambda" {
  source                = "../../modules/lambda"
  project_name          = var.project_name
  aws_region            = var.aws_region
  aws_account_id        = data.aws_caller_identity.current.account_id
  function_name         = "${var.project_name}-feed-notifier-${var.environment}"
  s3_bucket_id          = aws_s3_bucket.lambda_deployment_bucket.id
  source_path           = "../../../../backend"
  handler               = "feed_notifier.handler"
  runtime               = var.python_version
  timeout               = 10
  memory_size           = 128
  layer_arns            = [module.python_dependencies_layer.layer_arn]
  environment_variables = {
    PROJECT_NAME         = var.project_name,
    DYNAMO_CONFIG_TABLE  = module.feed_config_table.table_name,
    SNS_TOPIC_ARN        = aws_sns_topic.feed_notification_topic.arn
  }
  attached_policy_arns = [
    aws_iam_policy.dynamodb_access_policy.arn,
    aws_iam_policy.sns_publish_policy.arn
  ]
}

# NEW: IAM Policy for SNS Publishing
resource "aws_iam_policy" "sns_publish_policy" {
  name        = "${var.project_name}-sns-publish-policy-${var.environment}"
  description = "IAM policy for Lambda to publish to SNS topics"

  policy = jsonencode({
    Version = "2012-10-17",
    Statement = [
      {
        Action = [
          "sns:Publish"
        ],
        Effect = "Allow",
        Resource = [
          aws_sns_topic.feed_notification_topic.arn
        ]
      }
    ]
  })
}

# NEW: DynamoDB Stream Event Source Mapping for Feed Notifier
resource "aws_lambda_event_source_mapping" "feed_history_stream" {
  event_source_arn  = module.feed_history_table.stream_arn
  function_name     = module.feed_notifier_lambda.lambda_arn
  starting_position = "LATEST"
  batch_size        = 10

  filter_criteria {
    filter {
      pattern = jsonencode({
        eventName = ["INSERT", "MODIFY"]
      })
    }
  }
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
  aws_region           = var.aws_region
  # No Cognito Authorizer integration here yet, will be a separate step
}

# IoT Topic Rule for Device Status
module "iot_status_rule" {
  source                        = "../../modules/iot_rule"
  project_name                  = var.project_name
  rule_name                     = "IoT_StatusRule_${var.environment}"
  rule_description              = "Routes device status messages to a Lambda function for DynamoDB update (${var.environment} environment)."
  mqtt_topic                    = "petfeeder/status"
  lambda_function_arn           = module.status_lambda.lambda_arn
  lambda_function_name_for_permission = module.status_lambda.lambda_function_name
  lambda_execution_role_arn     = aws_iam_role.iot_rule_cloudwatch_role.arn
}

# IoT Topic Rule for Feed Events
module "iot_feed_event_rule" {
  source                        = "../../modules/iot_rule"
  project_name                  = var.project_name
  rule_name                     = "IoT_FeedEventRule_${var.environment}"
  rule_description              = "Routes feed event messages to Lambda for logging (${var.environment} environment)."
  mqtt_topic                    = "petfeeder/feed_event"
  lambda_function_arn           = module.feed_event_logger_lambda.lambda_arn
  lambda_function_name_for_permission = module.feed_event_logger_lambda.lambda_function_name
  lambda_execution_role_arn     = aws_iam_role.iot_rule_cloudwatch_role.arn
}

# Schedule Executor Lambda
module "schedule_executor_lambda" {
  source                = "../../modules/lambda"
  project_name          = var.project_name
  aws_region            = var.aws_region
  aws_account_id        = data.aws_caller_identity.current.account_id
  function_name         = "${var.project_name}-schedule-executor-${var.environment}"
  s3_bucket_id          = aws_s3_bucket.lambda_deployment_bucket.id
  source_path           = "../../../../backend"
  handler               = "schedule_executor.handler"
  runtime               = var.python_version
  timeout               = 30
  memory_size           = 256
  layer_arns            = [module.python_dependencies_layer.layer_arn]
  environment_variables = {
    PROJECT_NAME                = var.project_name,
    DYNAMO_FEED_SCHEDULE_TABLE  = module.feed_schedule_table.table_name,
    IOT_ENDPOINT                = data.aws_iot_endpoint.iot_data_endpoint.endpoint_address,
    IOT_TOPIC_FEED              = "petfeeder/commands"
  }
  attached_policy_arns = [
    aws_iam_policy.dynamodb_access_policy.arn,
    aws_iam_policy.iot_publish_policy.arn
  ]
}

# EventBridge Rule to trigger Schedule Executor every minute
module "schedule_executor_eventbridge" {
  source                = "../../modules/eventbridge_rule"
  project_name          = var.project_name
  environment           = var.environment
  rule_name             = "${var.project_name}-schedule-executor-rule-${var.environment}"
  rule_description      = "Triggers schedule executor Lambda every minute to check for due schedules"
  schedule_expression   = "rate(1 minute)"
  lambda_function_arn   = module.schedule_executor_lambda.lambda_arn
  lambda_function_name  = module.schedule_executor_lambda.lambda_function_name
}

# AWS Amplify App for Frontend
module "amplify_app" {
  source              = "../../modules/amplify_app"
  project_name        = var.project_name
  environment         = var.environment
  app_name            = "${var.project_name}-frontend-${var.environment}"
  github_repo_url     = data.github_repository.this.html_url
  github_token        = var.github_token
  environment_variables = {
    VITE_API_BASE_URL        = module.api_gateway.api_gateway_invoke_url,
    VITE_USER_POOL_ID        = module.cognito_user_pool.user_pool_id,
    VITE_USER_POOL_CLIENT_ID = aws_cognito_user_pool_client.web_client.id, # Keep this
    VITE_REGION              = var.aws_region,
    VITE_GOOGLE_CLIENT_ID    = var.google_client_id, # ADD THIS
    VITE_USER_POOL_DOMAIN    = module.cognito_user_pool.user_pool_domain # ADD THIS
  }
}

# NEW: Cognito User Pool Module Call
module "cognito_user_pool" {
  source               = "../../modules/cognito_user_pool"
  user_pool_name       = "${var.project_name}-users-${var.environment}"
  project_name         = var.project_name
  environment          = var.environment
  aws_region           = var.aws_region
  google_client_id     = var.google_client_id
  google_client_secret = var.google_client_secret
  # callback_urls and logout_urls are removed from here as they are now in the client resource
  admin_email          = var.admin_email
  lambda_pre_sign_up_arn = module.pre_sign_up_lambda.lambda_arn # Link the pre-sign-up Lambda
}

# NEW: Cognito User Pool Client (moved from module to resolve cycle)
resource "aws_cognito_user_pool_client" "web_client" {
  name                                 = "${var.project_name}-web-client-${var.environment}"
  user_pool_id                         = module.cognito_user_pool.user_pool_id
  generate_secret                      = false # False for web applications
  allowed_oauth_flows_user_pool_client = true
  allowed_oauth_flows                  = ["code", "implicit"]
  # ADDED: Required OAuth scopes
  allowed_oauth_scopes                 = ["phone", "email", "openid", "profile", "aws.cognito.signin.user.admin"]
  # Construct callback/logout URLs using a generic placeholder to break the cycle
  # IMPORTANT: You MUST update these URLs in the AWS Cognito console AFTER Amplify deployment
  # to the actual Amplify App URL (e.g., https://<your-amplify-domain>.amplifyapp.com/)
  callback_urls                        = ["https://example.com/", "https://example.com/oauth2/idpresponse"]
  logout_urls                          = ["https://example.com/"]
  supported_identity_providers         = ["COGNITO", "Google"] # Allow Cognito's own login and Google
  explicit_auth_flows = [ # Essential for custom pre-sign-up flow
    "ALLOW_ADMIN_USER_PASSWORD_AUTH",
    "ALLOW_CUSTOM_AUTH",
    "ALLOW_USER_PASSWORD_AUTH",
    "ALLOW_REFRESH_TOKEN_AUTH"
  ]
}

