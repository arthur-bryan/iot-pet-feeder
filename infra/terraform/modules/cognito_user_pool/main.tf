# Cognito User Pool for Authentication
resource "aws_cognito_user_pool" "this" {
  name = var.user_pool_name

  # Use email as username (no separate username field)
  username_attributes      = ["email"]
  auto_verified_attributes = ["email"]

  # Password policy
  password_policy {
    minimum_length                   = 8
    require_lowercase                = true
    require_uppercase                = true
    require_numbers                  = true
    require_symbols                  = false
    temporary_password_validity_days = 7
  }

  # Account recovery
  account_recovery_setting {
    recovery_mechanism {
      name     = "verified_email"
      priority = 1
    }
  }

  # Email configuration
  email_configuration {
    email_sending_account = "COGNITO_DEFAULT"
  }

  # User attribute schema
  schema {
    name                = "email"
    attribute_data_type = "String"
    required            = true
    mutable             = false

    string_attribute_constraints {
      min_length = 5
      max_length = 256
    }
  }

  # Admin create user config
  admin_create_user_config {
    allow_admin_create_user_only = true # Only admin can create users

    invite_message_template {
      email_subject = "${var.project_name} - Your temporary password"
      email_message = "Welcome to ${var.project_name}!\n\nYour username: {username}\nYour temporary password: {####}\n\nPlease log in and change your password immediately."
      sms_message   = "Your username is {username} and temporary password is {####}"
    }
  }

  # User pool add-ons
  user_pool_add_ons {
    advanced_security_mode = "OFF" # Set to AUDIT or ENFORCED for advanced security (costs extra)
  }

  # Tags
  tags = {
    Project     = var.project_name
    Environment = var.environment
  }
}

# Cognito User Pool Client (for frontend app)
resource "aws_cognito_user_pool_client" "this" {
  name         = "${var.project_name}-web-client-${var.environment}"
  user_pool_id = aws_cognito_user_pool.this.id

  # OAuth settings
  allowed_oauth_flows_user_pool_client = true
  allowed_oauth_flows                  = ["code", "implicit"]
  allowed_oauth_scopes                 = ["email", "openid", "profile"]
  callback_urls                        = var.callback_urls
  logout_urls                          = var.logout_urls
  supported_identity_providers         = ["COGNITO"]

  # Token validity
  access_token_validity  = 1  # 1 hour
  id_token_validity      = 1  # 1 hour
  refresh_token_validity = 30 # 30 days

  token_validity_units {
    access_token  = "hours"
    id_token      = "hours"
    refresh_token = "days"
  }

  # Security
  prevent_user_existence_errors = "ENABLED"
  enable_token_revocation       = true

  # Read/write attributes
  read_attributes = [
    "email",
    "email_verified"
  ]

  write_attributes = [
    "email"
  ]

  # Explicit auth flows
  explicit_auth_flows = [
    "ALLOW_USER_PASSWORD_AUTH",
    "ALLOW_REFRESH_TOKEN_AUTH",
    "ALLOW_USER_SRP_AUTH"
  ]
}

# Cognito User Pool Domain (for Hosted UI)
resource "aws_cognito_user_pool_domain" "this" {
  domain       = "${var.project_name}-${var.environment}-${var.domain_suffix}"
  user_pool_id = aws_cognito_user_pool.this.id
}

# Admin User Group
resource "aws_cognito_user_group" "admin" {
  name         = "admin"
  user_pool_id = aws_cognito_user_pool.this.id
  description  = "Administrator group with full access"
  precedence   = 1
}
