# infra/terraform/modules/lambda/variables.tf
variable "project_name" {
  description = "Name of the project."
  type        = string
}

variable "aws_region" {
  description = "AWS region."
  type        = string
}

variable "aws_account_id" {
  description = "AWS account ID."
  type        = string
}

variable "function_name" {
  description = "Name of the Lambda function."
  type        = string
}

variable "s3_bucket_id" {
  description = "ID of the S3 bucket where the Lambda deployment package will be stored."
  type        = string
}

variable "source_path" { # <<< RE-INTRODUCED: Local path to the Lambda function's source code directory
  description = "Local path to the Lambda function's source code directory. Dependencies must be installed here."
  type        = string
}

# Removed local_zip_path and s3_key as they are not used with archive_file

variable "handler" {
  description = "The function entrypoint in your Lambda code (e.g., 'main.handler')."
  type        = string
}

variable "runtime" {
  description = "The runtime environment for the Lambda function."
  type        = string
}

variable "timeout" {
  description = "The maximum amount of time (in seconds) that the Lambda function can run."
  type        = number
}

variable "memory_size" {
  description = "The amount of memory (in MB) that the Lambda function has access to."
  type        = number
}

variable "environment_variables" {
  description = "A map of environment variables for the Lambda function."
  type        = map(string)
  default     = {}
}

variable "attached_policy_arns" {
  description = "A list of additional IAM policy ARNs to attach to the Lambda's execution role."
  type        = list(string)
  default     = []
}

variable "layer_arns" {
  description = "List of Lambda Layer ARNs to attach to the function."
  type        = list(string)
  default     = []
}
