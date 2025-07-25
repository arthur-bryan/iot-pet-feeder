# infra/terraform/environments/dev/variables.tf
variable "aws_region" {
  description = "AWS region to deploy resources in."
  type        = string
  default     = "sa-east-1"
}

variable "project_name" {
  description = "Name of the project, used for resource naming."
  type        = string
  default     = "pet-feeder"
}

variable "environment" {
  description = "The deployment environment (e.g., dev, prod)."
  type        = string
  default     = "dev"
}

variable "python_version" {
  description = "Python runtime version for Lambda functions."
  type        = string
  default     = "python3.9"
}

# Removed iot_endpoint variable - it's now dynamically fetched by a data source in main.tf

variable "github_repo_name" {
  description = "The name of the GitHub repository (e.g., 'iot-pet-feeder')."
  type        = string
}

variable "github_owner" {
  description = "The owner/organization of the GitHub repository."
  type        = string
}

variable "github_token" {
  description = "GitHub Personal Access Token with 'repo' scope for Amplify to connect to the repository. Store as GitHub Secret."
  type        = string
  sensitive   = true
}

variable "build_dir" {
  description = "Directory where Lambda ZIP packages are built (relative to project root)."
  type        = string
  default     = "build"
}

variable "api_lambda_zip_name" {
  description = "Filename of the FastAPI Lambda deployment package ZIP."
  type        = string
  default     = "api-lambda-deployment-package.zip"
}

variable "status_lambda_zip_name" {
  description = "Filename of the IoT Status Updater Lambda deployment package ZIP."
  type        = string
  default     = "status-lambda-deployment-package.zip"
}
