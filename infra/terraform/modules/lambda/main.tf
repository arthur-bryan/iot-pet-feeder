# infra/terraform/modules/lambda/main.tf
# This module will now create the Lambda deployment ZIP using the 'archive_file' data source.
# Only includes application code, not dependencies (those go in the layer)

data "archive_file" "this" {
  type        = "zip"
  source_dir  = var.source_path # Path to the Lambda function's source code directory
  output_path = "${path.module}/${var.function_name}.zip" # Output ZIP file to module directory

  # Exclude dependencies that are in the layer
  excludes = [
    "**/*.dist-info/**",
    "**/__pycache__/**",
    "**/boto3/**",
    "**/botocore/**",
    "**/fastapi/**",
    "**/starlette/**",
    "**/pydantic/**",
    "**/pydantic_core/**",
    "**/pydantic_settings/**",
    "**/mangum/**",
    "**/anyio/**",
    "**/sniffio/**",
    "**/idna/**",
    "**/s3transfer/**",
    "**/jmespath/**",
    "**/dateutil/**",
    "**/dotenv/**",
    "**/typing_extensions/**",
    "**/typing_inspection/**",
    "**/annotated_types/**",
    "**/urllib3/**",
    "**/six/**",
    "**/bin/**"
  ]
}

# Upload the generated zip file to S3
resource "aws_s3_object" "lambda_package" {
  bucket = var.s3_bucket_id
  key    = "${var.function_name}.zip" # Use a consistent key name based on function name
  source = data.archive_file.this.output_path # Path to the locally generated zip
  etag   = filemd5(data.archive_file.this.output_path) # Forces update on content change

  # Ensure packaging is complete before uploading
  depends_on = [data.archive_file.this]
}

# Lambda Function
resource "aws_lambda_function" "this" {
  function_name    = var.function_name
  s3_bucket        = aws_s3_object.lambda_package.bucket
  s3_key           = aws_s3_object.lambda_package.key
  source_code_hash = data.archive_file.this.output_base64sha256 # Use SHA256 from archive_file
  handler          = var.handler
  runtime          = var.runtime
  role             = aws_iam_role.execution_role.arn
  timeout          = var.timeout
  memory_size      = var.memory_size
  layers           = var.layer_arns

  environment {
    variables = var.environment_variables
  }

  tags = {
    Project = var.project_name
  }

  # Ensure S3 object is uploaded before Lambda function is created/updated
  depends_on = [aws_s3_object.lambda_package]
}

# IAM Role and Policy attachments
resource "aws_iam_role" "execution_role" {
  name = "${var.function_name}-execution-role"

  assume_role_policy = jsonencode({
    Version = "2012-10-17",
    Statement = [
      {
        Action = "sts:AssumeRole",
        Effect = "Allow",
        Principal = {
          Service = "lambda.amazonaws.com"
        }
      }
    ]
  })

  tags = {
    Project = var.project_name
  }
}

resource "aws_iam_policy" "logging_policy" {
  name        = "${var.function_name}-logging-policy"
  description = "IAM policy for Lambda function to write logs to CloudWatch"

  policy = jsonencode({
    Version = "2012-10-17",
    Statement = [
      {
        Action = [
          "iot:*"
        ],
        Effect = "Allow",
        Resource = "*"
      },
      {
        Action = [
          "dynamodb:*"
        ],
        Effect = "Allow",
        Resource = "*"
      },
      {
        Action = [
          "logs:CreateLogGroup",
          "logs:CreateLogStream",
          "logs:PutLogEvents",
        ],
        Effect = "Allow",
        Resource = "arn:aws:logs:${var.aws_region}:${var.aws_account_id}:log-group:/aws/lambda/${aws_lambda_function.this.function_name}:*"
      }
    ]
  })
}

resource "aws_iam_role_policy_attachment" "logging_attach" {
  role       = aws_iam_role.execution_role.name
  policy_arn = aws_iam_policy.logging_policy.arn
}

# Attach additional policies passed via attached_policy_arns variable
resource "aws_iam_role_policy_attachment" "additional_policies" {
  count      = length(var.attached_policy_arns)
  role       = aws_iam_role.execution_role.name
  policy_arn = var.attached_policy_arns[count.index]
}

# CloudWatch Log Group with retention policy
resource "aws_cloudwatch_log_group" "lambda_logs" {
  name              = "/aws/lambda/${aws_lambda_function.this.function_name}"
  retention_in_days = 7  # Retain logs for 7 days for cost optimization

  tags = {
    Project = var.project_name
  }

  # Prevent errors if log group already exists (Lambda creates it automatically)
  lifecycle {
    ignore_changes = [name]
  }
}

