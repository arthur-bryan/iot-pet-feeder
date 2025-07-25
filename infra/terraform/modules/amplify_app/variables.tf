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

variable "build_spec" {
  description = "The build specification YAML for the Amplify app."
  type        = string
  default     = <<-EOT
    version: 1
    frontend:
      phases:
        preBuild:
          commands:
            - echo "No pre-build commands needed for static HTML/JS."
        build:
          commands:
            - echo "No build commands needed for static HTML/JS."
      artifacts:
        baseDirectory: frontend/web-control-panel/public # Your frontend's public directory
        files:
          - '**/*'
      cache:
        paths: []
    EOT
}

variable "environment_variables" {
  description = "A map of environment variables for the Amplify build."
  type        = map(string)
  default     = {}
}