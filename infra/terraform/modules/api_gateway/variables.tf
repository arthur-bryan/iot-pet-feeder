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