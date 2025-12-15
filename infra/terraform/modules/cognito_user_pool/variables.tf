variable "project_name" {
  description = "Name of the project"
  type        = string
}

variable "environment" {
  description = "Environment name (dev, staging, prod)"
  type        = string
}

variable "user_pool_name" {
  description = "Name of the Cognito User Pool"
  type        = string
}

variable "callback_urls" {
  description = "List of callback URLs for Cognito Hosted UI"
  type        = list(string)
}

variable "logout_urls" {
  description = "List of logout URLs for Cognito Hosted UI"
  type        = list(string)
}

variable "domain_suffix" {
  description = "Suffix for Cognito domain (must be globally unique)"
  type        = string
}
