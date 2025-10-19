variable "aws_region" {
  description = "AWS region to deploy resources in."
  type        = string
  default     = "us-east-2"
}

variable "project_name" {
  description = "Name of the project, used for resource naming."
  type        = string
  default     = "iot-pet-feeder"
}

variable "environment" {
  description = "The deployment environment (e.g., dev, prod)."
  type        = string
  default     = "dev"
}

variable "python_version" {
  description = "Python runtime version for Lambda functions."
  type        = string
  default     = "python3.12"
}

variable "github_repo_name" {
  description = "The name of the GitHub repository (e.g., 'iot-pet-feeder')."
  type        = string
  default     = "iot-pet-feeder"
}

variable "github_owner" {
  description = "The owner/organization of the GitHub repository."
  type        = string
}

variable "github_token" {
  description = "GitHub Personal Access Token with 'repo' scope for Amplify to connect to the repository."
  type        = string
  sensitive   = true
}

variable "admin_email" {
  description = "The email address of the admin user who will receive notifications."
  type        = string
}
