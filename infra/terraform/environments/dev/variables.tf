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
  default     = "arthur-bryan" # Replace with your GitHub username or organization
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

# NEW: Variables for Cognito Integration
variable "google_client_id" {
  description = "Google OAuth 2.0 Client ID for Cognito Identity Provider. Store as GitHub Secret."
  type        = string
  sensitive   = true
}

variable "google_client_secret" {
  description = "Google OAuth 2.0 Client Secret for Cognito Identity Provider. Store as GitHub Secret."
  type        = string
  sensitive   = true
}

variable "admin_email" {
  description = "The email address of the admin user who will be auto-confirmed in Cognito and receive approval notifications."
  type        = string
  default     = "arthurbryan2030@gmail.com"
}

variable "ses_source_email" {
  description = "The verified SES email address to use as the sender for feed notifications."
  type        = string
  default     = "noreply@example.com"  # Must be verified in SES
}
