variable "project_name" {
  description = "Name of the project."
  type        = string
}

variable "rule_name" {
  description = "Name of the AWS IoT Topic Rule."
  type        = string
}

variable "rule_description" {
  description = "Description of the AWS IoT Topic Rule."
  type        = string
}

variable "mqtt_topic" {
  description = "The MQTT topic the rule listens to."
  type        = string
}

variable "lambda_function_arn" {
  description = "The ARN of the Lambda function to invoke."
  type        = string
}

variable "lambda_function_name_for_permission" {
  description = "The name of the Lambda function for the permission statement."
  type        = string
}

variable "lambda_execution_role_arn" {
  description = "The ARN of the Lambda's execution role, used for error action."
  type        = string
}