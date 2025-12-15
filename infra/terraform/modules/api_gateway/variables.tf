variable "project_name" {
  description = "Name of the project."
  type        = string
}

variable "api_name" {
  description = "Name of the API Gateway REST API."
  type        = string
}

variable "api_description" {
  description = "Description of the API Gateway REST API."
  type        = string
}

variable "lambda_invoke_arn" {
  description = "The invoke ARN of the Lambda function to integrate with API Gateway."
  type        = string
}

variable "lambda_function_name" {
  description = "The name of the Lambda function to integrate with API Gateway."
  type        = string
}

variable "stage_name" {
  description = "Name of the API Gateway deployment stage."
  type        = string
  default     = "prd"
}

variable "aws_region" {
  description = "AWS region for the API Gateway and Lambda integration."
  type        = string
}

variable "cognito_user_pool_arn" {
  description = "ARN of the Cognito User Pool for API authorization. If not provided, no authorization is used."
  type        = string
  default     = ""
}

variable "enable_cognito_auth" {
  description = "Whether to enable Cognito authorization for API endpoints"
  type        = bool
  default     = false
}

variable "custom_domain_name" {
  description = "Custom domain name for API Gateway (e.g., api.example.com). If not provided, no custom domain is created."
  type        = string
  default     = ""
}

variable "certificate_arn" {
  description = "ARN of the ACM certificate for the custom domain. Required if custom_domain_name is provided."
  type        = string
  default     = ""
}
