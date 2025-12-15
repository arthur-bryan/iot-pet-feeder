variable "project_name" {
  description = "Name of the project."
  type        = string
}

variable "environment" {
  description = "The deployment environment (e.g., dev, prod)."
  type        = string
}

variable "app_name" {
  description = "Name of the Amplify application."
  type        = string
}

variable "github_repo_url" {
  description = "The full URL of the GitHub repository (e.g., https://github.com/your-org/your-repo)."
  type        = string
}

variable "environment_variables" {
  description = "A map of environment variables for the Amplify build."
  type        = map(string)
  default     = {}
}

variable "github_access_token" {
  description = "GitHub Personal Access Token for repository access"
  type        = string
  sensitive   = true
}