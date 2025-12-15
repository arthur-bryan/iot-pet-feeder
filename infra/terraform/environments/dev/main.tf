# infra/terraform/environments/dev/main.tf
provider "aws" {
  region = var.aws_region
}

data "aws_caller_identity" "current" {}

# Data source to fetch the AWS IoT Core Data Plane endpoint
data "aws_iot_endpoint" "iot_data_endpoint" {
  endpoint_type = "iot:Data-ATS" # Use ATS endpoint for secure connection
}

# Construct GitHub repository URL from variables
locals {
  github_repo_url = "https://github.com/${var.github_owner}/${var.github_repo_name}"
}

# S3 Bucket for Lambda Deployment Packages (shared by both Lambdas)
resource "aws_s3_bucket" "lambda_deployment_bucket" {
  bucket        = "${var.project_name}-lambda-packages-${var.aws_region}-${data.aws_caller_identity.current.account_id}"
  force_destroy = true  # Allow Terraform to delete bucket even if it contains objects

  tags = {
    Project = var.project_name
    Environment = var.environment # Using the new environment variable
  }
}

# Block all public access to S3 bucket
resource "aws_s3_bucket_public_access_block" "lambda_deployment_bucket" {
  bucket = aws_s3_bucket.lambda_deployment_bucket.id

  block_public_acls       = true
  block_public_policy     = true
  ignore_public_acls      = true
  restrict_public_buckets = true
}

# Enforce HTTPS-only access
resource "aws_s3_bucket_policy" "lambda_deployment_bucket" {
  bucket = aws_s3_bucket.lambda_deployment_bucket.id

  policy = jsonencode({
    Version = "2012-10-17"
    Statement = [
      {
        Sid       = "DenyInsecureTransport"
        Effect    = "Deny"
        Principal = "*"
        Action    = "s3:*"
        Resource  = [
          "${aws_s3_bucket.lambda_deployment_bucket.arn}/*",
          "${aws_s3_bucket.lambda_deployment_bucket.arn}"
        ]
        Condition = {
          Bool = {
            "aws:SecureTransport" = "false"
          }
        }
      }
    ]
  })
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
        Resource = concat([
          module.feed_history_table.table_arn,
          module.device_status_table.table_arn,
          module.feed_schedule_table.table_arn,
          module.feed_config_table.table_arn,
          module.schedule_execution_history_table.table_arn
        ], var.environment != "demo" ? [module.pending_users_table[0].table_arn] : [])
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

module "schedule_execution_history_table" {
  source       = "../../modules/dynamodb_table"
  project_name = var.project_name
  table_name   = "${var.project_name}-schedule-execution-history-${var.environment}"
  hash_key     = "execution_id"
  hash_key_type = "S"
}

# Pending Users Table (only for non-demo environments)
module "pending_users_table" {
  count = var.environment != "demo" ? 1 : 0

  source       = "../../modules/dynamodb_table"
  project_name = var.project_name
  table_name   = "${var.project_name}-pending-users-${var.environment}"
  hash_key     = "request_id"
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
    PROJECT_NAME               = var.project_name
    ENVIRONMENT                = var.environment
    IOT_ENDPOINT               = data.aws_iot_endpoint.iot_data_endpoint.endpoint_address
    IOT_PUBLISH_TOPIC          = "petfeeder/commands"
    IOT_THING_ID               = module.iot_device.thing_name
    DYNAMO_FEED_HISTORY_TABLE  = module.feed_history_table.table_name
    DEVICE_STATUS_TABLE_NAME   = module.device_status_table.table_name
    DYNAMO_FEED_SCHEDULE_TABLE = module.feed_schedule_table.table_name
    DYNAMO_FEED_CONFIG_TABLE_NAME = module.feed_config_table.table_name
    SNS_TOPIC_ARN              = aws_sns_topic.feed_notification_topic.arn
    DYNAMO_PENDING_USERS_TABLE = var.environment != "demo" ? module.pending_users_table[0].table_name : ""
    COGNITO_USER_POOL_ID       = var.environment != "demo" ? module.cognito_user_pool[0].user_pool_id : ""
    SES_SENDER_EMAIL           = "iot-pet-feeder@${var.domain_name}"
    SES_CONFIGURATION_SET      = aws_ses_configuration_set.main.name
    CORS_ALLOWED_ORIGINS       = "https://dev.d2w2idwvj381w0.amplifyapp.com,https://iot-pet-feeder.arthurbryan.dev.br"
  }
  attached_policy_arns = concat([
    aws_iam_policy.iot_publish_policy.arn,
    aws_iam_policy.dynamodb_access_policy.arn,
    aws_iam_policy.sns_manage_subscriptions_policy.arn,
    aws_iam_policy.ses_send_email.arn
  ], var.environment != "demo" ? [aws_iam_policy.cognito_admin_policy[0].arn] : [])
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

  # Cognito authorization (only for non-demo environments)
  enable_cognito_auth   = var.environment != "demo"
  cognito_user_pool_arn = var.environment != "demo" ? module.cognito_user_pool[0].user_pool_arn : ""
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
    PROJECT_NAME                      = var.project_name
    ENVIRONMENT                       = var.environment
    DYNAMO_FEED_SCHEDULE_TABLE        = module.feed_schedule_table.table_name
    DYNAMO_FEED_HISTORY_TABLE         = module.feed_history_table.table_name
    DEVICE_STATUS_TABLE_NAME          = module.device_status_table.table_name
    DYNAMO_FEED_CONFIG_TABLE_NAME     = module.feed_config_table.table_name
    SCHEDULE_EXECUTION_HISTORY_TABLE  = module.schedule_execution_history_table.table_name
    IOT_THING_ID                      = module.iot_device.thing_name
    IOT_ENDPOINT                      = data.aws_iot_endpoint.iot_data_endpoint.endpoint_address
    IOT_TOPIC_FEED                    = "petfeeder/commands"
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

# --- Cognito User Pool (only for non-demo environments) ---
module "cognito_user_pool" {
  count = var.environment != "demo" ? 1 : 0

  source          = "../../modules/cognito_user_pool"
  project_name    = var.project_name
  environment     = var.environment
  user_pool_name  = "${var.project_name}-user-pool-${var.environment}"
  callback_urls   = [
    "https://${var.environment}.${data.aws_caller_identity.current.account_id}.amplifyapp.com",
    "http://localhost:5173"
  ]
  logout_urls     = [
    "https://${var.environment}.${data.aws_caller_identity.current.account_id}.amplifyapp.com",
    "http://localhost:5173"
  ]
  domain_suffix   = "${data.aws_caller_identity.current.account_id}"
}

# IAM Policy for Cognito Admin Operations
resource "aws_iam_policy" "cognito_admin_policy" {
  count = var.environment != "demo" ? 1 : 0

  name        = "${var.project_name}-cognito-admin-policy-${var.environment}"
  description = "IAM policy for Lambda to manage Cognito users"

  policy = jsonencode({
    Version = "2012-10-17",
    Statement = [
      {
        Action = [
          "cognito-idp:AdminCreateUser",
          "cognito-idp:AdminGetUser",
          "cognito-idp:AdminAddUserToGroup",
          "cognito-idp:AdminSetUserPassword",
          "cognito-idp:AdminDeleteUser",
          "cognito-idp:AdminListGroupsForUser",
          "cognito-idp:ListUsers"
        ],
        Effect = "Allow",
        Resource = module.cognito_user_pool[0].user_pool_arn
      },
      {
        Action = [
          "ses:SendEmail",
          "ses:SendRawEmail"
        ],
        Effect = "Allow",
        Resource = "*"
      }
    ]
  })
}

# Admin User Creator Lambda (runs post-deployment)
module "admin_user_creator_lambda" {
  count = var.environment != "demo" ? 1 : 0

  source                = "../../modules/lambda"
  project_name          = var.project_name
  aws_region            = var.aws_region
  aws_account_id        = data.aws_caller_identity.current.account_id
  function_name         = "${var.project_name}-admin-user-creator-${var.environment}"
  s3_bucket_id          = aws_s3_bucket.lambda_deployment_bucket.id
  source_path           = "../../../../backend"
  handler               = "create_admin_user.handler"
  runtime               = var.python_version
  timeout               = 30
  memory_size           = 128
  layer_arns            = []
  environment_variables = {
    USER_POOL_ID      = module.cognito_user_pool[0].user_pool_id
    ADMIN_EMAIL       = var.admin_email
    ADMIN_GROUP_NAME  = "admin"
  }
  attached_policy_arns = [
    aws_iam_policy.cognito_admin_policy[0].arn
  ]
}

# Trigger admin user creation after deployment
resource "null_resource" "create_admin_user" {
  count = var.environment != "demo" ? 1 : 0

  depends_on = [module.cognito_user_pool, module.admin_user_creator_lambda]

  triggers = {
    user_pool_id = module.cognito_user_pool[0].user_pool_id
    admin_email  = var.admin_email
  }

  provisioner "local-exec" {
    command = <<-EOT
      echo "===================================================="
      echo "Creating admin user in Cognito..."
      echo "===================================================="

      # Invoke Lambda to create admin user
      aws lambda invoke \
        --function-name ${module.admin_user_creator_lambda[0].lambda_function_name} \
        --region ${var.aws_region} \
        --payload '{}' \
        response.json > /dev/null 2>&1

      # Wait a moment for CloudWatch logs to be available
      sleep 3

      # Fetch credentials from CloudWatch logs
      echo ""
      echo "Fetching admin credentials from CloudWatch logs..."
      echo ""

      LOGS=$(aws logs tail /aws/lambda/${module.admin_user_creator_lambda[0].lambda_function_name} \
        --region ${var.aws_region} \
        --since 5m \
        --format short 2>/dev/null)

      # Extract password from the log format: "📧 TEMPORARY PASSWORD for {email}: {password}"
      PASSWORD=$(echo "$LOGS" | grep "TEMPORARY PASSWORD for" | sed 's/.*TEMPORARY PASSWORD for [^:]*: //' | head -1)

      # If that fails, try the alternative format from the email body
      if [ -z "$PASSWORD" ]; then
        PASSWORD=$(echo "$LOGS" | grep "Temporary Password:" | sed 's/.*Temporary Password: //' | head -1)
      fi

      if [ ! -z "$PASSWORD" ]; then
        echo "===================================================="
        echo "       ADMIN USER CREATED SUCCESSFULLY!"
        echo "===================================================="
        echo ""
        echo "  Email:              ${var.admin_email}"
        echo "  Temporary Password: $PASSWORD"
        echo ""
        echo "  ⚠️  IMPORTANT: Save this password!"
        echo "  You must change it on first login."
        echo ""
        echo "===================================================="
        echo ""
      else
        echo "===================================================="
        echo "WARNING: Could not fetch credentials from logs."
        echo "Retrieve the admin password from CloudWatch Logs:"
        echo ""
        echo "  aws logs tail /aws/lambda/${module.admin_user_creator_lambda[0].lambda_function_name} \\"
        echo "    --region ${var.aws_region} \\"
        echo "    --since 10m | grep 'TEMPORARY PASSWORD'"
        echo ""
        echo "===================================================="
      fi

      rm -f response.json
    EOT
  }
}

# AWS Amplify App for Frontend
module "amplify_app" {
  source              = "../../modules/amplify_app"
  project_name        = var.project_name
  environment         = var.environment
  app_name            = "${var.project_name}-frontend-${var.environment}"
  github_repo_url     = local.github_repo_url
  github_access_token = var.github_token
  environment_variables = {
    VITE_API_BASE_URL          = module.api_gateway.api_gateway_invoke_url
    VITE_REGION                = var.aws_region
    VITE_ENVIRONMENT           = var.environment
    VITE_COGNITO_USER_POOL_ID  = var.environment != "demo" ? module.cognito_user_pool[0].user_pool_id : ""
    VITE_COGNITO_CLIENT_ID     = var.environment != "demo" ? module.cognito_user_pool[0].user_pool_client_id : ""
    VITE_COGNITO_DOMAIN        = var.environment != "demo" ? module.cognito_user_pool[0].hosted_ui_url : ""
  }
}

# Trigger Amplify rebuild when API Gateway URL changes
resource "null_resource" "amplify_rebuild_trigger" {
  # Trigger rebuild when API Gateway URL changes
  triggers = {
    api_gateway_url = module.api_gateway.api_gateway_invoke_url
  }

  # Wait for both API Gateway and Amplify to be ready
  depends_on = [
    module.api_gateway,
    module.amplify_app
  ]

  provisioner "local-exec" {
    command = <<-EOT
      echo "API Gateway URL changed to: ${module.api_gateway.api_gateway_invoke_url}"
      echo "Triggering Amplify rebuild to update frontend configuration..."

      # Start Amplify build job
      aws amplify start-job \
        --app-id ${module.amplify_app.amplify_app_id} \
        --branch-name ${var.environment} \
        --job-type RELEASE \
        --region ${var.aws_region} || echo "Warning: Could not trigger Amplify rebuild. Run post-deploy.sh manually."
    EOT
  }
}

# SNS Topic for CloudWatch Alarm Notifications
resource "aws_sns_topic" "alarm_notifications" {
  name = "${var.project_name}-alarm-notifications-${var.environment}"

  tags = {
    Project     = var.project_name
    Environment = var.environment
  }
}

# CloudWatch Alarms for monitoring
module "cloudwatch_alarms" {
  source = "../../modules/cloudwatch_alarms"

  project_name    = var.project_name
  environment     = var.environment
  api_gateway_name  = module.api_gateway.rest_api_name
  api_gateway_stage = var.environment

  lambda_function_names = [
    module.api_lambda.lambda_function_name,
    module.status_lambda.lambda_function_name,
    module.feed_event_logger_lambda.lambda_function_name,
    module.feed_notifier_lambda.lambda_function_name,
    module.schedule_executor_lambda.lambda_function_name
  ]

  alarm_actions = [aws_sns_topic.alarm_notifications.arn]
}


