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
  default     = "python3.13"
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

variable "admin_email" {
  description = "The email address of the admin user who will receive notifications."
  type        = string
}

variable "github_token" {
  description = "GitHub Personal Access Token for Amplify repository access"
  type        = string
  sensitive   = true
}

variable "domain_name" {
  description = "Domain name for SES sender email (e.g., arthurbryan.dev.br)"
  type        = string
}

variable "route53_zone_id" {
  description = "Route53 hosted zone ID for domain verification records"
  type        = string
  default     = ""
}

variable "create_route53_records" {
  description = "Whether to automatically create Route53 DNS records for SES verification"
  type        = bool
  default     = true
}
