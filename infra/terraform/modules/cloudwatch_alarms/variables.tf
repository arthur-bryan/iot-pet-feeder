variable "project_name" {
  description = "Name of the project"
  type        = string
}

variable "environment" {
  description = "Environment name (dev, prd, demo)"
  type        = string
}

variable "lambda_function_names" {
  description = "List of Lambda function names to monitor"
  type        = list(string)
}

variable "api_gateway_name" {
  description = "Name of the API Gateway to monitor"
  type        = string
}

variable "api_gateway_stage" {
  description = "Stage name of the API Gateway"
  type        = string
}

variable "alarm_actions" {
  description = "List of ARNs to notify when alarm triggers (e.g., SNS topic ARNs)"
  type        = list(string)
  default     = []
}

variable "lambda_error_threshold" {
  description = "Number of Lambda errors to trigger alarm"
  type        = number
  default     = 1
}

variable "api_5xx_threshold" {
  description = "Number of 5xx errors to trigger alarm"
  type        = number
  default     = 5
}

variable "api_4xx_threshold" {
  description = "Number of 4xx errors to trigger alarm (high rate)"
  type        = number
  default     = 50
}

variable "evaluation_periods" {
  description = "Number of periods to evaluate"
  type        = number
  default     = 1
}

variable "period_seconds" {
  description = "Period in seconds for metric evaluation"
  type        = number
  default     = 300
}
