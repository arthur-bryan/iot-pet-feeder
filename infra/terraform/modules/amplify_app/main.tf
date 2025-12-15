# infra/terraform/modules/amplify_app/main.tf
#
# AWS Amplify frontend hosting module
#
# Authentication: GitHub Personal Access Token
# - Requires token with 'repo' scope
# - Pass via var.github_access_token
#
resource "aws_amplify_app" "this" {
  name                        = var.app_name
  repository                  = var.github_repo_url
  access_token                = var.github_access_token
  enable_auto_branch_creation = false # We'll manage branches explicitly

  # Build configuration is in amplify.yml at repo root (best practice)
  # Terraform only manages infrastructure and passes environment variables
  environment_variables = var.environment_variables

  # Custom rules to serve .html files directly without redirects
  custom_rule {
    source = "/docs.html"
    target = "/docs.html"
    status = "200"
  }

  custom_rule {
    source = "/redoc.html"
    target = "/redoc.html"
    status = "200"
  }

  # SPA fallback for other routes
  custom_rule {
    source = "/<*>"
    target = "/index.html"
    status = "404-200"
  }

  tags = {
    Project     = var.project_name
    Environment = var.environment
  }
}

resource "aws_amplify_branch" "dev" { # Explicitly define the 'dev' branch
  app_id      = aws_amplify_app.this.id
  branch_name = "dev"
  stage       = "DEVELOPMENT" # 'dev' branch for development environment

  framework         = "NONE" # For plain HTML/JS or custom build
  enable_auto_build = true   # Automatically build on push to this branch

  tags = {
    Project     = var.project_name
    Environment = var.environment
  }
}


