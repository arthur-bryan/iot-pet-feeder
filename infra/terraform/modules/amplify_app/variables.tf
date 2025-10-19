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

variable "github_token" {
  description = "GitHub Personal Access Token with repo scope for Amplify to connect to the repository."
  type        = string
  sensitive   = true
}


variable "environment_variables" {
  description = "A map of environment variables for the Amplify build."
  type        = map(string)
  default     = {}
}