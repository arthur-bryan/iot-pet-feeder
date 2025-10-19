# infra/terraform/modules/amplify_app/main.tf
resource "aws_amplify_app" "this" {
  name                 = var.app_name
  repository           = var.github_repo_url
  oauth_token          = var.github_token # GitHub Personal Access Token
  enable_auto_branch_creation = false # We'll manage branches explicitly

  # The build_spec is now defined directly here, allowing variable interpolation
  build_spec = <<-EOT
    version: 1
    frontend:
      phases:
        preBuild:
          commands:
            - echo "Generating environment configuration for frontend..."
            # Create env-config.js with all environment variables using a here-document.
            # This version explicitly adds commas between entries, but avoids a trailing comma
            # after the last entry, ensuring robust JavaScript syntax.
            - |
              cat <<EOF > frontend/web-control-panel/public/env-config.js
              window.ENV = {
              %{ for i, key in keys(var.environment_variables) ~}
                ${key}: "${var.environment_variables[key]}"%{ if i < length(var.environment_variables) - 1 },%{ endif }
              %{ endfor ~}
              };
              EOF
            - echo "Environment configuration generated."
            - echo "--- Content of env-config.js ---"
            - cat frontend/web-control-panel/public/env-config.js # Print the content of the generated file
            - echo "------------------------------"
        build:
          commands:
            # No direct sed replacement needed in index.js/login.js anymore for API_BASE_URL
            # as they will read from window.ENV.VITE_API_BASE_URL
            - echo "Build phase complete."
      artifacts:
        baseDirectory: frontend/web-control-panel/public # Your frontend's public directory
        files:
          - '**/*'
      cache:
        paths: []
    EOT

  environment_variables = var.environment_variables

  tags = {
    Project     = var.project_name
    Environment = var.environment
  }
}

resource "aws_amplify_branch" "dev" { # Explicitly define the 'dev' branch
  app_id      = aws_amplify_app.this.id
  branch_name = "dev"
  stage       = "DEVELOPMENT" # 'dev' branch for development environment

  framework     = "NONE" # For plain HTML/JS or custom build
  enable_auto_build = true # Automatically build on push to this branch

  tags = {
    Project     = var.project_name
    Environment = var.environment
  }
}


