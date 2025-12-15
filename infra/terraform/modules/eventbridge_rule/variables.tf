# infra/terraform/modules/eventbridge_rule/variables.tf

variable "project_name" {
  description = "Name of the project"
  type        = string
}

variable "environment" {
  description = "Environment name (dev, staging, prod)"
  type        = string
}

variable "rule_name" {
  description = "Name of the EventBridge rule"
  type        = string
}

variable "rule_description" {
  description = "Description of the EventBridge rule"
  type        = string
}

variable "schedule_expression" {
  description = "Schedule expression for the rule (e.g., 'rate(1 minute)' or 'cron(0 * * * ? *)')"
  type        = string
}

variable "lambda_function_arn" {
  description = "ARN of the Lambda function to trigger"
  type        = string
}

variable "lambda_function_name" {
  description = "Name of the Lambda function for permissions"
  type        = string
}
