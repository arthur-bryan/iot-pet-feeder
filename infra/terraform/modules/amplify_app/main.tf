resource "aws_amplify_app" "this" {
  name                 = var.app_name
  repository           = var.github_repo_url
  oauth_token          = var.github_token # GitHub Personal Access Token
  enable_auto_branch_creation = false # We'll manage branches explicitly

  build_spec = var.build_spec # Build commands for the frontend

  environment_variables = var.environment_variables

  tags = {
    Project     = var.project_name
    Environment = var.environment
  }
}

resource "aws_amplify_branch" "main" {
  app_id      = aws_amplify_app.this.id
  branch_name = "main" # Or 'master', 'develop' depending on your primary branch
  stage       = "PRODUCTION" # Or 'DEVELOPMENT', 'STAGING'

  framework     = "NONE" # For plain HTML/JS or custom build
  enable_auto_build = true # Automatically build on push to this branch

  # If you have a custom build folder (e.g., 'dist' or 'public')
  # build_spec will handle this, but you can also specify here if needed
  # e.g., enable_auto_branch_auto_build = true

  tags = {
    Project     = var.project_name
    Environment = var.environment
  }
}