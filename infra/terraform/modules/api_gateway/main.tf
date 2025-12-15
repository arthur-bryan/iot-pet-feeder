resource "aws_api_gateway_rest_api" "this" {
  name        = var.api_name
  description = var.api_description
  endpoint_configuration {
    types = ["REGIONAL"]
  }

  tags = {
    Project = var.project_name
  }
}

# Note: Regional API Gateway endpoints use TLS 1.2+ (including TLS 1.3) by default.
# For custom domains, use aws_api_gateway_domain_name with security_policy = "TLS_1_2"

# Cognito Authorizer (only created if Cognito auth is enabled)
resource "aws_api_gateway_authorizer" "cognito" {
  count = var.enable_cognito_auth ? 1 : 0

  name            = "${var.project_name}-cognito-authorizer"
  rest_api_id     = aws_api_gateway_rest_api.this.id
  type            = "COGNITO_USER_POOLS"
  provider_arns   = [var.cognito_user_pool_arn]
  identity_source = "method.request.header.Authorization"
}

# Local variable for authorization type
locals {
  authorization_type = var.enable_cognito_auth ? "COGNITO_USER_POOLS" : "NONE"
  authorizer_id      = var.enable_cognito_auth ? aws_api_gateway_authorizer.cognito[0].id : null
}

# Documentation endpoints (public, no auth)
resource "aws_api_gateway_resource" "docs_resource" {
  rest_api_id = aws_api_gateway_rest_api.this.id
  parent_id   = aws_api_gateway_rest_api.this.root_resource_id
  path_part   = "docs"
}

resource "aws_api_gateway_resource" "redoc_resource" {
  rest_api_id = aws_api_gateway_rest_api.this.id
  parent_id   = aws_api_gateway_rest_api.this.root_resource_id
  path_part   = "redoc"
}

resource "aws_api_gateway_resource" "openapi_json_resource" {
  rest_api_id = aws_api_gateway_rest_api.this.id
  parent_id   = aws_api_gateway_rest_api.this.root_resource_id
  path_part   = "openapi.json"
}

resource "aws_api_gateway_resource" "api_resource" {
  rest_api_id = aws_api_gateway_rest_api.this.id
  parent_id   = aws_api_gateway_rest_api.this.root_resource_id
  path_part   = "api"
}

resource "aws_api_gateway_resource" "v1_resource" {
  rest_api_id = aws_api_gateway_rest_api.this.id
  parent_id   = aws_api_gateway_resource.api_resource.id
  path_part   = "v1"
}

resource "aws_api_gateway_resource" "feeds_resource" {
  rest_api_id = aws_api_gateway_rest_api.this.id
  parent_id   = aws_api_gateway_resource.v1_resource.id
  path_part   = "feeds"
}

resource "aws_api_gateway_resource" "feed_events_resource" {
  rest_api_id = aws_api_gateway_rest_api.this.id
  parent_id   = aws_api_gateway_resource.v1_resource.id
  path_part   = "feed-events"
}

# --- NEW: Schedules Resource ---
resource "aws_api_gateway_resource" "schedules_resource" {
  rest_api_id = aws_api_gateway_rest_api.this.id
  parent_id   = aws_api_gateway_resource.v1_resource.id
  path_part   = "schedules"
}

# Schedules {proxy+} resource for catch-all
resource "aws_api_gateway_resource" "schedules_proxy_resource" {
  rest_api_id = aws_api_gateway_rest_api.this.id
  parent_id   = aws_api_gateway_resource.schedules_resource.id
  path_part   = "{proxy+}"
}
# --- END NEW ---

resource "aws_api_gateway_resource" "config_resource" {
  rest_api_id = aws_api_gateway_rest_api.this.id
  parent_id   = aws_api_gateway_resource.v1_resource.id
  path_part   = "config"
}

resource "aws_api_gateway_resource" "config_key_resource" {
  rest_api_id = aws_api_gateway_rest_api.this.id
  parent_id   = aws_api_gateway_resource.config_resource.id
  path_part   = "{key}"
}

resource "aws_api_gateway_resource" "status_resource" {
  rest_api_id = aws_api_gateway_rest_api.this.id
  parent_id   = aws_api_gateway_resource.v1_resource.id # Now under /api/v1
  path_part   = "status"
}

# --- NEW: Notifications Resources ---
resource "aws_api_gateway_resource" "notifications_resource" {
  rest_api_id = aws_api_gateway_rest_api.this.id
  parent_id   = aws_api_gateway_resource.v1_resource.id
  path_part   = "notifications"
}

resource "aws_api_gateway_resource" "notifications_proxy_resource" {
  rest_api_id = aws_api_gateway_rest_api.this.id
  parent_id   = aws_api_gateway_resource.notifications_resource.id
  path_part   = "{proxy+}"
}
# --- END NEW ---

# Documentation endpoint methods (public, no auth)
resource "aws_api_gateway_method" "get_docs_method" {
  rest_api_id   = aws_api_gateway_rest_api.this.id
  resource_id   = aws_api_gateway_resource.docs_resource.id
  http_method   = "GET"
  authorization = "NONE"
}

resource "aws_api_gateway_integration" "get_docs_integration" {
  rest_api_id             = aws_api_gateway_rest_api.this.id
  resource_id             = aws_api_gateway_resource.docs_resource.id
  http_method             = aws_api_gateway_method.get_docs_method.http_method
  integration_http_method = "POST"
  type                    = "AWS_PROXY"
  uri                     = "arn:aws:apigateway:${var.aws_region}:lambda:path/2015-03-31/functions/${var.lambda_invoke_arn}/invocations"
}

resource "aws_api_gateway_method" "get_redoc_method" {
  rest_api_id   = aws_api_gateway_rest_api.this.id
  resource_id   = aws_api_gateway_resource.redoc_resource.id
  http_method   = "GET"
  authorization = "NONE"
}

resource "aws_api_gateway_integration" "get_redoc_integration" {
  rest_api_id             = aws_api_gateway_rest_api.this.id
  resource_id             = aws_api_gateway_resource.redoc_resource.id
  http_method             = aws_api_gateway_method.get_redoc_method.http_method
  integration_http_method = "POST"
  type                    = "AWS_PROXY"
  uri                     = "arn:aws:apigateway:${var.aws_region}:lambda:path/2015-03-31/functions/${var.lambda_invoke_arn}/invocations"
}

resource "aws_api_gateway_method" "get_openapi_json_method" {
  rest_api_id   = aws_api_gateway_rest_api.this.id
  resource_id   = aws_api_gateway_resource.openapi_json_resource.id
  http_method   = "GET"
  authorization = "NONE"
}

resource "aws_api_gateway_integration" "get_openapi_json_integration" {
  rest_api_id             = aws_api_gateway_rest_api.this.id
  resource_id             = aws_api_gateway_resource.openapi_json_resource.id
  http_method             = aws_api_gateway_method.get_openapi_json_method.http_method
  integration_http_method = "POST"
  type                    = "AWS_PROXY"
  uri                     = "arn:aws:apigateway:${var.aws_region}:lambda:path/2015-03-31/functions/${var.lambda_invoke_arn}/invocations"
}

# CORS for documentation endpoints
resource "aws_api_gateway_method" "options_docs_method" {
  rest_api_id   = aws_api_gateway_rest_api.this.id
  resource_id   = aws_api_gateway_resource.docs_resource.id
  http_method   = "OPTIONS"
  authorization = "NONE"
}

resource "aws_api_gateway_integration" "options_docs_integration" {
  rest_api_id = aws_api_gateway_rest_api.this.id
  resource_id = aws_api_gateway_resource.docs_resource.id
  http_method = aws_api_gateway_method.options_docs_method.http_method
  type        = "MOCK"
  request_templates = {
    "application/json" = "{ \"statusCode\": 200 }"
  }
}

resource "aws_api_gateway_method_response" "options_docs_200" {
  rest_api_id = aws_api_gateway_rest_api.this.id
  resource_id = aws_api_gateway_resource.docs_resource.id
  http_method = aws_api_gateway_method.options_docs_method.http_method
  status_code = "200"
  response_parameters = {
    "method.response.header.Access-Control-Allow-Headers" = true,
    "method.response.header.Access-Control-Allow-Methods" = true,
    "method.response.header.Access-Control-Allow-Origin"  = true
  }
}

resource "aws_api_gateway_integration_response" "options_docs_integration_200" {
  rest_api_id = aws_api_gateway_rest_api.this.id
  resource_id = aws_api_gateway_resource.docs_resource.id
  http_method = aws_api_gateway_method.options_docs_method.http_method
  status_code = aws_api_gateway_method_response.options_docs_200.status_code
  response_parameters = {
    "method.response.header.Access-Control-Allow-Headers" = "'Content-Type,X-Amz-Date,Authorization,X-Api-Key,X-Amz-Security-Token'",
    "method.response.header.Access-Control-Allow-Methods" = "'OPTIONS,GET'",
    "method.response.header.Access-Control-Allow-Origin"  = "'*'"
  }
  depends_on = [aws_api_gateway_integration.options_docs_integration]
}

resource "aws_api_gateway_method" "options_redoc_method" {
  rest_api_id   = aws_api_gateway_rest_api.this.id
  resource_id   = aws_api_gateway_resource.redoc_resource.id
  http_method   = "OPTIONS"
  authorization = "NONE"
}

resource "aws_api_gateway_integration" "options_redoc_integration" {
  rest_api_id = aws_api_gateway_rest_api.this.id
  resource_id = aws_api_gateway_resource.redoc_resource.id
  http_method = aws_api_gateway_method.options_redoc_method.http_method
  type        = "MOCK"
  request_templates = {
    "application/json" = "{ \"statusCode\": 200 }"
  }
}

resource "aws_api_gateway_method_response" "options_redoc_200" {
  rest_api_id = aws_api_gateway_rest_api.this.id
  resource_id = aws_api_gateway_resource.redoc_resource.id
  http_method = aws_api_gateway_method.options_redoc_method.http_method
  status_code = "200"
  response_parameters = {
    "method.response.header.Access-Control-Allow-Headers" = true,
    "method.response.header.Access-Control-Allow-Methods" = true,
    "method.response.header.Access-Control-Allow-Origin"  = true
  }
}

resource "aws_api_gateway_integration_response" "options_redoc_integration_200" {
  rest_api_id = aws_api_gateway_rest_api.this.id
  resource_id = aws_api_gateway_resource.redoc_resource.id
  http_method = aws_api_gateway_method.options_redoc_method.http_method
  status_code = aws_api_gateway_method_response.options_redoc_200.status_code
  response_parameters = {
    "method.response.header.Access-Control-Allow-Headers" = "'Content-Type,X-Amz-Date,Authorization,X-Api-Key,X-Amz-Security-Token'",
    "method.response.header.Access-Control-Allow-Methods" = "'OPTIONS,GET'",
    "method.response.header.Access-Control-Allow-Origin"  = "'*'"
  }
  depends_on = [aws_api_gateway_integration.options_redoc_integration]
}

resource "aws_api_gateway_method" "options_openapi_json_method" {
  rest_api_id   = aws_api_gateway_rest_api.this.id
  resource_id   = aws_api_gateway_resource.openapi_json_resource.id
  http_method   = "OPTIONS"
  authorization = "NONE"
}

resource "aws_api_gateway_integration" "options_openapi_json_integration" {
  rest_api_id = aws_api_gateway_rest_api.this.id
  resource_id = aws_api_gateway_resource.openapi_json_resource.id
  http_method = aws_api_gateway_method.options_openapi_json_method.http_method
  type        = "MOCK"
  request_templates = {
    "application/json" = "{ \"statusCode\": 200 }"
  }
}

resource "aws_api_gateway_method_response" "options_openapi_json_200" {
  rest_api_id = aws_api_gateway_rest_api.this.id
  resource_id = aws_api_gateway_resource.openapi_json_resource.id
  http_method = aws_api_gateway_method.options_openapi_json_method.http_method
  status_code = "200"
  response_parameters = {
    "method.response.header.Access-Control-Allow-Headers" = true,
    "method.response.header.Access-Control-Allow-Methods" = true,
    "method.response.header.Access-Control-Allow-Origin"  = true
  }
}

resource "aws_api_gateway_integration_response" "options_openapi_json_integration_200" {
  rest_api_id = aws_api_gateway_rest_api.this.id
  resource_id = aws_api_gateway_resource.openapi_json_resource.id
  http_method = aws_api_gateway_method.options_openapi_json_method.http_method
  status_code = aws_api_gateway_method_response.options_openapi_json_200.status_code
  response_parameters = {
    "method.response.header.Access-Control-Allow-Headers" = "'Content-Type,X-Amz-Date,Authorization,X-Api-Key,X-Amz-Security-Token'",
    "method.response.header.Access-Control-Allow-Methods" = "'OPTIONS,GET'",
    "method.response.header.Access-Control-Allow-Origin"  = "'*'"
  }
  depends_on = [aws_api_gateway_integration.options_openapi_json_integration]
}

# API Gateway Method: POST /api/v1/feeds
resource "aws_api_gateway_method" "post_feeds_method" {
  rest_api_id   = aws_api_gateway_rest_api.this.id
  resource_id   = aws_api_gateway_resource.feeds_resource.id
  http_method   = "POST"
  authorization = local.authorization_type
  authorizer_id = local.authorizer_id
}

resource "aws_api_gateway_integration" "post_feeds_integration" {
  rest_api_id             = aws_api_gateway_rest_api.this.id
  resource_id             = aws_api_gateway_resource.feeds_resource.id
  http_method             = aws_api_gateway_method.post_feeds_method.http_method
  integration_http_method = "POST"
  type                    = "AWS_PROXY"
  uri                     = "arn:aws:apigateway:${var.aws_region}:lambda:path/2015-03-31/functions/${var.lambda_invoke_arn}/invocations"
}

# --- CORS for /api/v1/feeds ---
resource "aws_api_gateway_method" "options_feeds_method" {
  rest_api_id   = aws_api_gateway_rest_api.this.id
  resource_id   = aws_api_gateway_resource.feeds_resource.id
  http_method   = "OPTIONS"
  authorization = "NONE"
  request_models = {
    "application/json" = "Error"
  }
}

resource "aws_api_gateway_integration" "options_feeds_integration" {
  rest_api_id             = aws_api_gateway_rest_api.this.id
  resource_id             = aws_api_gateway_resource.feeds_resource.id
  http_method             = aws_api_gateway_method.options_feeds_method.http_method
  type                    = "MOCK"
  request_templates = {
    "application/json" = "{ \"statusCode\": 200 }"
  }
}

resource "aws_api_gateway_method_response" "options_feeds_200" {
  rest_api_id = aws_api_gateway_rest_api.this.id
  resource_id = aws_api_gateway_resource.feeds_resource.id
  http_method = aws_api_gateway_method.options_feeds_method.http_method
  status_code = "200"
  response_parameters = {
    "method.response.header.Access-Control-Allow-Headers" = true,
    "method.response.header.Access-Control-Allow-Methods" = true,
    "method.response.header.Access-Control-Allow-Origin"  = true
  }
}

resource "aws_api_gateway_integration_response" "options_feeds_integration_200" {
  rest_api_id = aws_api_gateway_rest_api.this.id
  resource_id = aws_api_gateway_resource.feeds_resource.id
  http_method = aws_api_gateway_method.options_feeds_method.http_method
  status_code = aws_api_gateway_method_response.options_feeds_200.status_code
  response_templates = {
    "application/json" = ""
  }
  response_parameters = {
    "method.response.header.Access-Control-Allow-Headers" = "'Content-Type,X-Amz-Date,Authorization,X-Api-Key,X-Amz-Security-Token,X-Amz-User-Agent'",
    "method.response.header.Access-Control-Allow-Methods" = "'OPTIONS,POST,GET'",
    "method.response.header.Access-Control-Allow-Origin"  = "'*'"
  }
  depends_on = [aws_api_gateway_integration.options_feeds_integration]
}
# --- End CORS for /api/v1/feeds ---


# API Gateway Method: GET /api/v1/feed-events
resource "aws_api_gateway_method" "get_feed_events_method" {
  rest_api_id   = aws_api_gateway_rest_api.this.id
  resource_id   = aws_api_gateway_resource.feed_events_resource.id
  http_method   = "GET"
  authorization = local.authorization_type
  authorizer_id = local.authorizer_id
}

resource "aws_api_gateway_integration" "get_feed_events_integration" {
  rest_api_id             = aws_api_gateway_rest_api.this.id
  resource_id             = aws_api_gateway_resource.feed_events_resource.id
  http_method             = aws_api_gateway_method.get_feed_events_method.http_method
  integration_http_method = "POST"
  type                    = "AWS_PROXY"
  uri                     = "arn:aws:apigateway:${var.aws_region}:lambda:path/2015-03-31/functions/${var.lambda_invoke_arn}/invocations"
}

# API Gateway Method: DELETE /api/v1/feed-events
resource "aws_api_gateway_method" "delete_feed_events_method" {
  rest_api_id   = aws_api_gateway_rest_api.this.id
  resource_id   = aws_api_gateway_resource.feed_events_resource.id
  http_method   = "DELETE"
  authorization = local.authorization_type
  authorizer_id = local.authorizer_id
}

resource "aws_api_gateway_integration" "delete_feed_events_integration" {
  rest_api_id             = aws_api_gateway_rest_api.this.id
  resource_id             = aws_api_gateway_resource.feed_events_resource.id
  http_method             = aws_api_gateway_method.delete_feed_events_method.http_method
  integration_http_method = "POST"
  type                    = "AWS_PROXY"
  uri                     = "arn:aws:apigateway:${var.aws_region}:lambda:path/2015-03-31/functions/${var.lambda_invoke_arn}/invocations"
}

# --- CORS for /api/v1/feed-events ---
resource "aws_api_gateway_method" "options_feed_events_method" {
  rest_api_id   = aws_api_gateway_rest_api.this.id
  resource_id   = aws_api_gateway_resource.feed_events_resource.id
  http_method   = "OPTIONS"
  authorization = "NONE"
  request_models = {
    "application/json" = "Error"
  }
}

resource "aws_api_gateway_integration" "options_feed_events_integration" {
  rest_api_id             = aws_api_gateway_rest_api.this.id
  resource_id             = aws_api_gateway_resource.feed_events_resource.id
  http_method             = aws_api_gateway_method.options_feed_events_method.http_method
  type                    = "MOCK"
  request_templates = {
    "application/json" = "{ \"statusCode\": 200 }"
  }
}

resource "aws_api_gateway_method_response" "options_feed_events_200" {
  rest_api_id = aws_api_gateway_rest_api.this.id
  resource_id = aws_api_gateway_resource.feed_events_resource.id
  http_method = aws_api_gateway_method.options_feed_events_method.http_method
  status_code = "200"
  response_parameters = {
    "method.response.header.Access-Control-Allow-Headers" = true,
    "method.response.header.Access-Control-Allow-Methods" = true,
    "method.response.header.Access-Control-Allow-Origin"  = true
  }
}

resource "aws_api_gateway_integration_response" "options_feed_events_integration_200" {
  rest_api_id = aws_api_gateway_rest_api.this.id
  resource_id = aws_api_gateway_resource.feed_events_resource.id
  http_method = aws_api_gateway_method.options_feed_events_method.http_method
  status_code = aws_api_gateway_method_response.options_feed_events_200.status_code
  response_templates = {
    "application/json" = ""
  }
  response_parameters = {
    "method.response.header.Access-Control-Allow-Headers" = "'Content-Type,X-Amz-Date,Authorization,X-Api-Key,X-Amz-Security-Token,X-Amz-User-Agent'",
    "method.response.header.Access-Control-Allow-Methods" = "'OPTIONS,GET,DELETE'",
    "method.response.header.Access-Control-Allow-Origin"  = "'*'"
  }
  depends_on = [aws_api_gateway_integration.options_feed_events_integration]
}
# --- End CORS for /api/v1/feed-events ---


# delete_all endpoint removed for security


# --- NEW: API Gateway Methods for /api/v1/schedules ---
# GET /api/v1/schedules (list schedules)
resource "aws_api_gateway_method" "get_schedules_method" {
  rest_api_id   = aws_api_gateway_rest_api.this.id
  resource_id   = aws_api_gateway_resource.schedules_resource.id
  http_method   = "GET"
  authorization = local.authorization_type
  authorizer_id = local.authorizer_id
}

resource "aws_api_gateway_integration" "get_schedules_integration" {
  rest_api_id             = aws_api_gateway_rest_api.this.id
  resource_id             = aws_api_gateway_resource.schedules_resource.id
  http_method             = aws_api_gateway_method.get_schedules_method.http_method
  integration_http_method = "POST"
  type                    = "AWS_PROXY"
  uri                     = "arn:aws:apigateway:${var.aws_region}:lambda:path/2015-03-31/functions/${var.lambda_invoke_arn}/invocations"
}

# POST /api/v1/schedules (create schedule)
resource "aws_api_gateway_method" "post_schedules_method" {
  rest_api_id   = aws_api_gateway_rest_api.this.id
  resource_id   = aws_api_gateway_resource.schedules_resource.id
  http_method   = "POST"
  authorization = local.authorization_type
  authorizer_id = local.authorizer_id
}

resource "aws_api_gateway_integration" "post_schedules_integration" {
  rest_api_id             = aws_api_gateway_rest_api.this.id
  resource_id             = aws_api_gateway_resource.schedules_resource.id
  http_method             = aws_api_gateway_method.post_schedules_method.http_method
  integration_http_method = "POST"
  type                    = "AWS_PROXY"
  uri                     = "arn:aws:apigateway:${var.aws_region}:lambda:path/2015-03-31/functions/${var.lambda_invoke_arn}/invocations"
}

# ANY /api/v1/schedules/{proxy+} (catch-all for GET/PUT/DELETE/PATCH /{id})
resource "aws_api_gateway_method" "any_schedules_proxy_method" {
  rest_api_id   = aws_api_gateway_rest_api.this.id
  resource_id   = aws_api_gateway_resource.schedules_proxy_resource.id
  http_method   = "ANY"
  authorization = local.authorization_type
  authorizer_id = local.authorizer_id
}

resource "aws_api_gateway_integration" "any_schedules_proxy_integration" {
  rest_api_id             = aws_api_gateway_rest_api.this.id
  resource_id             = aws_api_gateway_resource.schedules_proxy_resource.id
  http_method             = aws_api_gateway_method.any_schedules_proxy_method.http_method
  integration_http_method = "POST"
  type                    = "AWS_PROXY"
  uri                     = "arn:aws:apigateway:${var.aws_region}:lambda:path/2015-03-31/functions/${var.lambda_invoke_arn}/invocations"
}

# --- CORS for /api/v1/schedules ---
resource "aws_api_gateway_method" "options_schedules_method" {
  rest_api_id   = aws_api_gateway_rest_api.this.id
  resource_id   = aws_api_gateway_resource.schedules_resource.id
  http_method   = "OPTIONS"
  authorization = "NONE"
  request_models = {
    "application/json" = "Error"
  }
}

resource "aws_api_gateway_integration" "options_schedules_integration" {
  rest_api_id             = aws_api_gateway_rest_api.this.id
  resource_id             = aws_api_gateway_resource.schedules_resource.id
  http_method             = aws_api_gateway_method.options_schedules_method.http_method
  type                    = "MOCK"
  request_templates = {
    "application/json" = "{ \"statusCode\": 200 }"
  }
}

resource "aws_api_gateway_method_response" "options_schedules_200" {
  rest_api_id = aws_api_gateway_rest_api.this.id
  resource_id = aws_api_gateway_resource.schedules_resource.id
  http_method = aws_api_gateway_method.options_schedules_method.http_method
  status_code = "200"
  response_parameters = {
    "method.response.header.Access-Control-Allow-Headers" = true,
    "method.response.header.Access-Control-Allow-Methods" = true,
    "method.response.header.Access-Control-Allow-Origin"  = true
  }
}

resource "aws_api_gateway_integration_response" "options_schedules_integration_200" {
  rest_api_id = aws_api_gateway_rest_api.this.id
  resource_id = aws_api_gateway_resource.schedules_resource.id
  http_method = aws_api_gateway_method.options_schedules_method.http_method
  status_code = aws_api_gateway_method_response.options_schedules_200.status_code
  response_templates = {
    "application/json" = ""
  }
  response_parameters = {
    "method.response.header.Access-Control-Allow-Headers" = "'Content-Type,X-Amz-Date,Authorization,X-Api-Key,X-Amz-Security-Token,X-Amz-User-Agent'",
    "method.response.header.Access-Control-Allow-Methods" = "'OPTIONS,GET,POST,PUT,DELETE,PATCH'",
    "method.response.header.Access-Control-Allow-Origin"  = "'*'"
  }
  depends_on = [aws_api_gateway_integration.options_schedules_integration]
}

# CORS for /api/v1/schedules/{proxy+}
resource "aws_api_gateway_method" "options_schedules_proxy_method" {
  rest_api_id   = aws_api_gateway_rest_api.this.id
  resource_id   = aws_api_gateway_resource.schedules_proxy_resource.id
  http_method   = "OPTIONS"
  authorization = "NONE"
  request_models = {
    "application/json" = "Error"
  }
}

resource "aws_api_gateway_integration" "options_schedules_proxy_integration" {
  rest_api_id             = aws_api_gateway_rest_api.this.id
  resource_id             = aws_api_gateway_resource.schedules_proxy_resource.id
  http_method             = aws_api_gateway_method.options_schedules_proxy_method.http_method
  type                    = "MOCK"
  request_templates = {
    "application/json" = "{ \"statusCode\": 200 }"
  }
}

resource "aws_api_gateway_method_response" "options_schedules_proxy_200" {
  rest_api_id = aws_api_gateway_rest_api.this.id
  resource_id = aws_api_gateway_resource.schedules_proxy_resource.id
  http_method = aws_api_gateway_method.options_schedules_proxy_method.http_method
  status_code = "200"
  response_parameters = {
    "method.response.header.Access-Control-Allow-Headers" = true,
    "method.response.header.Access-Control-Allow-Methods" = true,
    "method.response.header.Access-Control-Allow-Origin"  = true
  }
}

resource "aws_api_gateway_integration_response" "options_schedules_proxy_integration_200" {
  rest_api_id = aws_api_gateway_rest_api.this.id
  resource_id = aws_api_gateway_resource.schedules_proxy_resource.id
  http_method = aws_api_gateway_method.options_schedules_proxy_method.http_method
  status_code = aws_api_gateway_method_response.options_schedules_proxy_200.status_code
  response_templates = {
    "application/json" = ""
  }
  response_parameters = {
    "method.response.header.Access-Control-Allow-Headers" = "'Content-Type,X-Amz-Date,Authorization,X-Api-Key,X-Amz-Security-Token,X-Amz-User-Agent'",
    "method.response.header.Access-Control-Allow-Methods" = "'OPTIONS,GET,POST,PUT,DELETE,PATCH'",
    "method.response.header.Access-Control-Allow-Origin"  = "'*'"
  }
  depends_on = [aws_api_gateway_integration.options_schedules_proxy_integration]
}
# --- END CORS for /api/v1/schedules ---

resource "aws_api_gateway_method" "get_config_key_method" {
  rest_api_id   = aws_api_gateway_rest_api.this.id
  resource_id   = aws_api_gateway_resource.config_key_resource.id
  http_method   = "GET"
  authorization = local.authorization_type
  authorizer_id = local.authorizer_id
}

resource "aws_api_gateway_integration" "get_config_key_integration" {
  rest_api_id             = aws_api_gateway_rest_api.this.id
  resource_id             = aws_api_gateway_resource.config_key_resource.id
  http_method             = aws_api_gateway_method.get_config_key_method.http_method
  integration_http_method = "POST"
  type                    = "AWS_PROXY"
  uri                     = "arn:aws:apigateway:${var.aws_region}:lambda:path/2015-03-31/functions/${var.lambda_invoke_arn}/invocations"
}

# API Gateway Method: PUT /api/v1/config/{key}
resource "aws_api_gateway_method" "put_config_key_method" {
  rest_api_id   = aws_api_gateway_rest_api.this.id
  resource_id   = aws_api_gateway_resource.config_key_resource.id
  http_method   = "PUT"
  authorization = local.authorization_type
  authorizer_id = local.authorizer_id
}

resource "aws_api_gateway_integration" "put_config_key_integration" {
  rest_api_id             = aws_api_gateway_rest_api.this.id
  resource_id             = aws_api_gateway_resource.config_key_resource.id
  http_method             = aws_api_gateway_method.put_config_key_method.http_method
  integration_http_method = "POST"
  type                    = "AWS_PROXY"
  uri                     = "arn:aws:apigateway:${var.aws_region}:lambda:path/2015-03-31/functions/${var.lambda_invoke_arn}/invocations"
}

# --- CORS for /api/v1/config/{key} (OPTIONS) ---
resource "aws_api_gateway_method" "options_config_key_method" {
  rest_api_id   = aws_api_gateway_rest_api.this.id
  resource_id   = aws_api_gateway_resource.config_key_resource.id
  http_method   = "OPTIONS"
  authorization = "NONE"
  request_models = {
    "application/json" = "Error"
  }
}

resource "aws_api_gateway_integration" "options_config_key_integration" {
  rest_api_id             = aws_api_gateway_rest_api.this.id
  resource_id             = aws_api_gateway_resource.config_key_resource.id
  http_method             = aws_api_gateway_method.options_config_key_method.http_method
  type                    = "MOCK"
  request_templates = {
    "application/json" = "{ \"statusCode\": 200 }"
  }
}

resource "aws_api_gateway_method_response" "options_config_key_200" {
  rest_api_id = aws_api_gateway_rest_api.this.id
  resource_id = aws_api_gateway_resource.config_key_resource.id
  http_method = aws_api_gateway_method.options_config_key_method.http_method
  status_code = "200"
  response_parameters = {
    "method.response.header.Access-Control-Allow-Headers" = true,
    "method.response.header.Access-Control-Allow-Methods" = true,
    "method.response.header.Access-Control-Allow-Origin"  = true
  }
}

resource "aws_api_gateway_integration_response" "options_config_key_integration_200" {
  rest_api_id = aws_api_gateway_rest_api.this.id
  resource_id = aws_api_gateway_resource.config_key_resource.id
  http_method = aws_api_gateway_method.options_config_key_method.http_method
  status_code = aws_api_gateway_method_response.options_config_key_200.status_code
  response_templates = {
    "application/json" = ""
  }
  response_parameters = {
    "method.response.header.Access-Control-Allow-Headers" = "'Content-Type,X-Amz-Date,Authorization,X-Api-Key,X-Amz-Security-Token,X-Amz-User-Agent'",
    "method.response.header.Access-Control-Allow-Methods" = "'OPTIONS,GET,PUT'",
    "method.response.header.Access-Control-Allow-Origin"  = "'*'"
  }
  depends_on = [aws_api_gateway_integration.options_config_key_integration]
}


# API Gateway Method: GET /api/v1/status
resource "aws_api_gateway_method" "get_status_method" {
  rest_api_id   = aws_api_gateway_rest_api.this.id
  resource_id   = aws_api_gateway_resource.status_resource.id
  http_method   = "GET"
  authorization = local.authorization_type
  authorizer_id = local.authorizer_id
}

resource "aws_api_gateway_integration" "get_status_integration" {
  rest_api_id             = aws_api_gateway_rest_api.this.id
  resource_id             = aws_api_gateway_resource.status_resource.id
  http_method             = aws_api_gateway_method.get_status_method.http_method
  integration_http_method = "POST"
  type                    = "AWS_PROXY"
  uri                     = "arn:aws:apigateway:${var.aws_region}:lambda:path/2015-03-31/functions/${var.lambda_invoke_arn}/invocations"
}

# API Gateway Method: PUT /api/v1/status (replaces POST /status/request)
resource "aws_api_gateway_method" "put_status_method" {
  rest_api_id   = aws_api_gateway_rest_api.this.id
  resource_id   = aws_api_gateway_resource.status_resource.id
  http_method   = "PUT"
  authorization = local.authorization_type
  authorizer_id = local.authorizer_id
}

resource "aws_api_gateway_integration" "put_status_integration" {
  rest_api_id             = aws_api_gateway_rest_api.this.id
  resource_id             = aws_api_gateway_resource.status_resource.id
  http_method             = aws_api_gateway_method.put_status_method.http_method
  integration_http_method = "POST"
  type                    = "AWS_PROXY"
  uri                     = "arn:aws:apigateway:${var.aws_region}:lambda:path/2015-03-31/functions/${var.lambda_invoke_arn}/invocations"
}

# --- CORS for /api/v1/status ---
resource "aws_api_gateway_method" "options_status_method" {
  rest_api_id   = aws_api_gateway_rest_api.this.id
  resource_id   = aws_api_gateway_resource.status_resource.id
  http_method   = "OPTIONS"
  authorization = "NONE"
  request_models = {
    "application/json" = "Error"
  }
}

resource "aws_api_gateway_integration" "options_status_integration" {
  rest_api_id             = aws_api_gateway_rest_api.this.id
  resource_id             = aws_api_gateway_resource.status_resource.id
  http_method             = aws_api_gateway_method.options_status_method.http_method
  type                    = "MOCK"
  request_templates = {
    "application/json" = "{ \"statusCode\": 200 }"
  }
}

resource "aws_api_gateway_method_response" "options_status_200" {
  rest_api_id = aws_api_gateway_rest_api.this.id
  resource_id = aws_api_gateway_resource.status_resource.id
  http_method = aws_api_gateway_method.options_status_method.http_method
  status_code = "200"
  response_parameters = {
    "method.response.header.Access-Control-Allow-Headers" = true,
    "method.response.header.Access-Control-Allow-Methods" = true,
    "method.response.header.Access-Control-Allow-Origin"  = true
  }
}

resource "aws_api_gateway_integration_response" "options_status_integration_200" {
  rest_api_id = aws_api_gateway_rest_api.this.id
  resource_id = aws_api_gateway_resource.status_resource.id
  http_method = aws_api_gateway_method.options_status_method.http_method
  status_code = aws_api_gateway_method_response.options_status_200.status_code
  response_templates = {
    "application/json" = ""
  }
  response_parameters = {
    "method.response.header.Access-Control-Allow-Headers" = "'Content-Type,X-Amz-Date,Authorization,X-Api-Key,X-Amz-Security-Token,X-Amz-User-Agent'",
    "method.response.header.Access-Control-Allow-Methods" = "'OPTIONS,GET,PUT'",
    "method.response.header.Access-Control-Allow-Origin"  = "'*'"
  }
  depends_on = [aws_api_gateway_integration.options_status_integration]
}
# --- End CORS for /api/v1/status ---


# --- NEW: Notifications Methods ---
# POST /api/v1/notifications/subscribe (and other POST endpoints)
resource "aws_api_gateway_method" "post_notifications_proxy_method" {
  rest_api_id   = aws_api_gateway_rest_api.this.id
  resource_id   = aws_api_gateway_resource.notifications_proxy_resource.id
  http_method   = "POST"
  authorization = local.authorization_type
  authorizer_id = local.authorizer_id
}

resource "aws_api_gateway_integration" "post_notifications_proxy_integration" {
  rest_api_id             = aws_api_gateway_rest_api.this.id
  resource_id             = aws_api_gateway_resource.notifications_proxy_resource.id
  http_method             = aws_api_gateway_method.post_notifications_proxy_method.http_method
  integration_http_method = "POST"
  type                    = "AWS_PROXY"
  uri                     = "arn:aws:apigateway:${var.aws_region}:lambda:path/2015-03-31/functions/${var.lambda_invoke_arn}/invocations"
}

# GET /api/v1/notifications/{proxy+}
resource "aws_api_gateway_method" "get_notifications_proxy_method" {
  rest_api_id   = aws_api_gateway_rest_api.this.id
  resource_id   = aws_api_gateway_resource.notifications_proxy_resource.id
  http_method   = "GET"
  authorization = local.authorization_type
  authorizer_id = local.authorizer_id
}

resource "aws_api_gateway_integration" "get_notifications_proxy_integration" {
  rest_api_id             = aws_api_gateway_rest_api.this.id
  resource_id             = aws_api_gateway_resource.notifications_proxy_resource.id
  http_method             = aws_api_gateway_method.get_notifications_proxy_method.http_method
  integration_http_method = "POST"
  type                    = "AWS_PROXY"
  uri                     = "arn:aws:apigateway:${var.aws_region}:lambda:path/2015-03-31/functions/${var.lambda_invoke_arn}/invocations"
}

# OPTIONS /api/v1/notifications/{proxy+} (CORS preflight)
resource "aws_api_gateway_method" "options_notifications_proxy_method" {
  rest_api_id   = aws_api_gateway_rest_api.this.id
  resource_id   = aws_api_gateway_resource.notifications_proxy_resource.id
  http_method   = "OPTIONS"
  authorization = "NONE"
  request_models = {
    "application/json" = "Error"
  }
}

resource "aws_api_gateway_integration" "options_notifications_proxy_integration" {
  rest_api_id = aws_api_gateway_rest_api.this.id
  resource_id = aws_api_gateway_resource.notifications_proxy_resource.id
  http_method = aws_api_gateway_method.options_notifications_proxy_method.http_method
  type        = "MOCK"
  request_templates = {
    "application/json" = "{ \"statusCode\": 200 }"
  }
}

resource "aws_api_gateway_method_response" "options_notifications_proxy_200" {
  rest_api_id = aws_api_gateway_rest_api.this.id
  resource_id = aws_api_gateway_resource.notifications_proxy_resource.id
  http_method = aws_api_gateway_method.options_notifications_proxy_method.http_method
  status_code = "200"
  response_parameters = {
    "method.response.header.Access-Control-Allow-Headers" = true,
    "method.response.header.Access-Control-Allow-Methods" = true,
    "method.response.header.Access-Control-Allow-Origin"  = true
  }
}

resource "aws_api_gateway_integration_response" "options_notifications_proxy_integration_200" {
  rest_api_id = aws_api_gateway_rest_api.this.id
  resource_id = aws_api_gateway_resource.notifications_proxy_resource.id
  http_method = aws_api_gateway_method.options_notifications_proxy_method.http_method
  status_code = aws_api_gateway_method_response.options_notifications_proxy_200.status_code
  response_templates = {
    "application/json" = ""
  }
  response_parameters = {
    "method.response.header.Access-Control-Allow-Headers" = "'Content-Type,X-Amz-Date,Authorization,X-Api-Key,X-Amz-Security-Token,X-Amz-User-Agent'",
    "method.response.header.Access-Control-Allow-Methods" = "'OPTIONS,GET,POST'",
    "method.response.header.Access-Control-Allow-Origin"  = "'*'"
  }
  depends_on = [aws_api_gateway_integration.options_notifications_proxy_integration]
}
# --- END NEW Notifications Methods ---


# --- NEW: Users Resources (for user management) ---
resource "aws_api_gateway_resource" "users_resource" {
  rest_api_id = aws_api_gateway_rest_api.this.id
  parent_id   = aws_api_gateway_resource.v1_resource.id
  path_part   = "users"
}

# /api/v1/users/request-access (public endpoint for requesting access)
resource "aws_api_gateway_resource" "users_request_access_resource" {
  rest_api_id = aws_api_gateway_rest_api.this.id
  parent_id   = aws_api_gateway_resource.users_resource.id
  path_part   = "request-access"
}

# /api/v1/users/pending (admin endpoint for viewing pending requests)
resource "aws_api_gateway_resource" "users_pending_resource" {
  rest_api_id = aws_api_gateway_rest_api.this.id
  parent_id   = aws_api_gateway_resource.users_resource.id
  path_part   = "pending"
}

# /api/v1/users/{proxy+} (catch-all for approve/{id}, reject/{id}, {email})
resource "aws_api_gateway_resource" "users_proxy_resource" {
  rest_api_id = aws_api_gateway_rest_api.this.id
  parent_id   = aws_api_gateway_resource.users_resource.id
  path_part   = "{proxy+}"
}

# GET /api/v1/users (list all users - admin only)
resource "aws_api_gateway_method" "get_users_method" {
  rest_api_id   = aws_api_gateway_rest_api.this.id
  resource_id   = aws_api_gateway_resource.users_resource.id
  http_method   = "GET"
  authorization = local.authorization_type
  authorizer_id = local.authorizer_id
}

resource "aws_api_gateway_integration" "get_users_integration" {
  rest_api_id             = aws_api_gateway_rest_api.this.id
  resource_id             = aws_api_gateway_resource.users_resource.id
  http_method             = aws_api_gateway_method.get_users_method.http_method
  integration_http_method = "POST"
  type                    = "AWS_PROXY"
  uri                     = "arn:aws:apigateway:${var.aws_region}:lambda:path/2015-03-31/functions/${var.lambda_invoke_arn}/invocations"
}

# POST /api/v1/users/request-access (PUBLIC - NO AUTH REQUIRED)
resource "aws_api_gateway_method" "post_users_request_access_method" {
  rest_api_id   = aws_api_gateway_rest_api.this.id
  resource_id   = aws_api_gateway_resource.users_request_access_resource.id
  http_method   = "POST"
  authorization = "NONE"  # PUBLIC ENDPOINT - no authentication required
}

resource "aws_api_gateway_integration" "post_users_request_access_integration" {
  rest_api_id             = aws_api_gateway_rest_api.this.id
  resource_id             = aws_api_gateway_resource.users_request_access_resource.id
  http_method             = aws_api_gateway_method.post_users_request_access_method.http_method
  integration_http_method = "POST"
  type                    = "AWS_PROXY"
  uri                     = "arn:aws:apigateway:${var.aws_region}:lambda:path/2015-03-31/functions/${var.lambda_invoke_arn}/invocations"
}

# GET /api/v1/users/pending (view pending requests - admin only)
resource "aws_api_gateway_method" "get_users_pending_method" {
  rest_api_id   = aws_api_gateway_rest_api.this.id
  resource_id   = aws_api_gateway_resource.users_pending_resource.id
  http_method   = "GET"
  authorization = local.authorization_type
  authorizer_id = local.authorizer_id
}

resource "aws_api_gateway_integration" "get_users_pending_integration" {
  rest_api_id             = aws_api_gateway_rest_api.this.id
  resource_id             = aws_api_gateway_resource.users_pending_resource.id
  http_method             = aws_api_gateway_method.get_users_pending_method.http_method
  integration_http_method = "POST"
  type                    = "AWS_PROXY"
  uri                     = "arn:aws:apigateway:${var.aws_region}:lambda:path/2015-03-31/functions/${var.lambda_invoke_arn}/invocations"
}

# ANY /api/v1/users/{proxy+} (approve/{id}, reject/{id}, {email} DELETE - admin only)
resource "aws_api_gateway_method" "any_users_proxy_method" {
  rest_api_id   = aws_api_gateway_rest_api.this.id
  resource_id   = aws_api_gateway_resource.users_proxy_resource.id
  http_method   = "ANY"
  authorization = local.authorization_type
  authorizer_id = local.authorizer_id
}

resource "aws_api_gateway_integration" "any_users_proxy_integration" {
  rest_api_id             = aws_api_gateway_rest_api.this.id
  resource_id             = aws_api_gateway_resource.users_proxy_resource.id
  http_method             = aws_api_gateway_method.any_users_proxy_method.http_method
  integration_http_method = "POST"
  type                    = "AWS_PROXY"
  uri                     = "arn:aws:apigateway:${var.aws_region}:lambda:path/2015-03-31/functions/${var.lambda_invoke_arn}/invocations"
}

# --- CORS for /api/v1/users ---
resource "aws_api_gateway_method" "options_users_method" {
  rest_api_id   = aws_api_gateway_rest_api.this.id
  resource_id   = aws_api_gateway_resource.users_resource.id
  http_method   = "OPTIONS"
  authorization = "NONE"
  request_models = {
    "application/json" = "Error"
  }
}

resource "aws_api_gateway_integration" "options_users_integration" {
  rest_api_id = aws_api_gateway_rest_api.this.id
  resource_id = aws_api_gateway_resource.users_resource.id
  http_method = aws_api_gateway_method.options_users_method.http_method
  type        = "MOCK"
  request_templates = {
    "application/json" = "{ \"statusCode\": 200 }"
  }
}

resource "aws_api_gateway_method_response" "options_users_200" {
  rest_api_id = aws_api_gateway_rest_api.this.id
  resource_id = aws_api_gateway_resource.users_resource.id
  http_method = aws_api_gateway_method.options_users_method.http_method
  status_code = "200"
  response_parameters = {
    "method.response.header.Access-Control-Allow-Headers" = true,
    "method.response.header.Access-Control-Allow-Methods" = true,
    "method.response.header.Access-Control-Allow-Origin"  = true
  }
}

resource "aws_api_gateway_integration_response" "options_users_integration_200" {
  rest_api_id = aws_api_gateway_rest_api.this.id
  resource_id = aws_api_gateway_resource.users_resource.id
  http_method = aws_api_gateway_method.options_users_method.http_method
  status_code = aws_api_gateway_method_response.options_users_200.status_code
  response_templates = {
    "application/json" = ""
  }
  response_parameters = {
    "method.response.header.Access-Control-Allow-Headers" = "'Content-Type,X-Amz-Date,Authorization,X-Api-Key,X-Amz-Security-Token,X-Amz-User-Agent'",
    "method.response.header.Access-Control-Allow-Methods" = "'OPTIONS,GET'",
    "method.response.header.Access-Control-Allow-Origin"  = "'*'"
  }
  depends_on = [aws_api_gateway_integration.options_users_integration]
}

# CORS for /api/v1/users/request-access (PUBLIC endpoint)
resource "aws_api_gateway_method" "options_users_request_access_method" {
  rest_api_id   = aws_api_gateway_rest_api.this.id
  resource_id   = aws_api_gateway_resource.users_request_access_resource.id
  http_method   = "OPTIONS"
  authorization = "NONE"
  request_models = {
    "application/json" = "Error"
  }
}

resource "aws_api_gateway_integration" "options_users_request_access_integration" {
  rest_api_id = aws_api_gateway_rest_api.this.id
  resource_id = aws_api_gateway_resource.users_request_access_resource.id
  http_method = aws_api_gateway_method.options_users_request_access_method.http_method
  type        = "MOCK"
  request_templates = {
    "application/json" = "{ \"statusCode\": 200 }"
  }
}

resource "aws_api_gateway_method_response" "options_users_request_access_200" {
  rest_api_id = aws_api_gateway_rest_api.this.id
  resource_id = aws_api_gateway_resource.users_request_access_resource.id
  http_method = aws_api_gateway_method.options_users_request_access_method.http_method
  status_code = "200"
  response_parameters = {
    "method.response.header.Access-Control-Allow-Headers" = true,
    "method.response.header.Access-Control-Allow-Methods" = true,
    "method.response.header.Access-Control-Allow-Origin"  = true
  }
}

resource "aws_api_gateway_integration_response" "options_users_request_access_integration_200" {
  rest_api_id = aws_api_gateway_rest_api.this.id
  resource_id = aws_api_gateway_resource.users_request_access_resource.id
  http_method = aws_api_gateway_method.options_users_request_access_method.http_method
  status_code = aws_api_gateway_method_response.options_users_request_access_200.status_code
  response_templates = {
    "application/json" = ""
  }
  response_parameters = {
    "method.response.header.Access-Control-Allow-Headers" = "'Content-Type,X-Amz-Date,Authorization,X-Api-Key,X-Amz-Security-Token,X-Amz-User-Agent'",
    "method.response.header.Access-Control-Allow-Methods" = "'OPTIONS,POST'",
    "method.response.header.Access-Control-Allow-Origin"  = "'*'"
  }
  depends_on = [aws_api_gateway_integration.options_users_request_access_integration]
}

# CORS for /api/v1/users/pending
resource "aws_api_gateway_method" "options_users_pending_method" {
  rest_api_id   = aws_api_gateway_rest_api.this.id
  resource_id   = aws_api_gateway_resource.users_pending_resource.id
  http_method   = "OPTIONS"
  authorization = "NONE"
  request_models = {
    "application/json" = "Error"
  }
}

resource "aws_api_gateway_integration" "options_users_pending_integration" {
  rest_api_id = aws_api_gateway_rest_api.this.id
  resource_id = aws_api_gateway_resource.users_pending_resource.id
  http_method = aws_api_gateway_method.options_users_pending_method.http_method
  type        = "MOCK"
  request_templates = {
    "application/json" = "{ \"statusCode\": 200 }"
  }
}

resource "aws_api_gateway_method_response" "options_users_pending_200" {
  rest_api_id = aws_api_gateway_rest_api.this.id
  resource_id = aws_api_gateway_resource.users_pending_resource.id
  http_method = aws_api_gateway_method.options_users_pending_method.http_method
  status_code = "200"
  response_parameters = {
    "method.response.header.Access-Control-Allow-Headers" = true,
    "method.response.header.Access-Control-Allow-Methods" = true,
    "method.response.header.Access-Control-Allow-Origin"  = true
  }
}

resource "aws_api_gateway_integration_response" "options_users_pending_integration_200" {
  rest_api_id = aws_api_gateway_rest_api.this.id
  resource_id = aws_api_gateway_resource.users_pending_resource.id
  http_method = aws_api_gateway_method.options_users_pending_method.http_method
  status_code = aws_api_gateway_method_response.options_users_pending_200.status_code
  response_templates = {
    "application/json" = ""
  }
  response_parameters = {
    "method.response.header.Access-Control-Allow-Headers" = "'Content-Type,X-Amz-Date,Authorization,X-Api-Key,X-Amz-Security-Token,X-Amz-User-Agent'",
    "method.response.header.Access-Control-Allow-Methods" = "'OPTIONS,GET'",
    "method.response.header.Access-Control-Allow-Origin"  = "'*'"
  }
  depends_on = [aws_api_gateway_integration.options_users_pending_integration]
}

# CORS for /api/v1/users/{proxy+}
resource "aws_api_gateway_method" "options_users_proxy_method" {
  rest_api_id   = aws_api_gateway_rest_api.this.id
  resource_id   = aws_api_gateway_resource.users_proxy_resource.id
  http_method   = "OPTIONS"
  authorization = "NONE"
  request_models = {
    "application/json" = "Error"
  }
}

resource "aws_api_gateway_integration" "options_users_proxy_integration" {
  rest_api_id = aws_api_gateway_rest_api.this.id
  resource_id = aws_api_gateway_resource.users_proxy_resource.id
  http_method = aws_api_gateway_method.options_users_proxy_method.http_method
  type        = "MOCK"
  request_templates = {
    "application/json" = "{ \"statusCode\": 200 }"
  }
}

resource "aws_api_gateway_method_response" "options_users_proxy_200" {
  rest_api_id = aws_api_gateway_rest_api.this.id
  resource_id = aws_api_gateway_resource.users_proxy_resource.id
  http_method = aws_api_gateway_method.options_users_proxy_method.http_method
  status_code = "200"
  response_parameters = {
    "method.response.header.Access-Control-Allow-Headers" = true,
    "method.response.header.Access-Control-Allow-Methods" = true,
    "method.response.header.Access-Control-Allow-Origin"  = true
  }
}

resource "aws_api_gateway_integration_response" "options_users_proxy_integration_200" {
  rest_api_id = aws_api_gateway_rest_api.this.id
  resource_id = aws_api_gateway_resource.users_proxy_resource.id
  http_method = aws_api_gateway_method.options_users_proxy_method.http_method
  status_code = aws_api_gateway_method_response.options_users_proxy_200.status_code
  response_templates = {
    "application/json" = ""
  }
  response_parameters = {
    "method.response.header.Access-Control-Allow-Headers" = "'Content-Type,X-Amz-Date,Authorization,X-Api-Key,X-Amz-Security-Token,X-Amz-User-Agent'",
    "method.response.header.Access-Control-Allow-Methods" = "'OPTIONS,GET,POST,PUT,DELETE'",
    "method.response.header.Access-Control-Allow-Origin"  = "'*'"
  }
  depends_on = [aws_api_gateway_integration.options_users_proxy_integration]
}
# --- END CORS for users ---
# --- END NEW Users Resources ---


# Lambda Permission to allow API Gateway to invoke it
resource "aws_lambda_permission" "apigw_lambda_permission" {
  statement_id  = "AllowAPIGatewayInvokeLambda"
  action        = "lambda:InvokeFunction"
  function_name = var.lambda_function_name
  principal     = "apigateway.amazonaws.com"
  source_arn    = "${aws_api_gateway_rest_api.this.execution_arn}/*/*"
}

resource "aws_api_gateway_deployment" "this" {
  depends_on = [
    aws_api_gateway_integration.get_docs_integration,
    aws_api_gateway_integration.options_docs_integration,
    aws_api_gateway_integration.get_redoc_integration,
    aws_api_gateway_integration.options_redoc_integration,
    aws_api_gateway_integration.get_openapi_json_integration,
    aws_api_gateway_integration.options_openapi_json_integration,
    aws_api_gateway_integration.post_feeds_integration,
    aws_api_gateway_integration.get_feed_events_integration,
    aws_api_gateway_integration.delete_feed_events_integration,
    aws_api_gateway_integration.get_status_integration,
    aws_api_gateway_integration.put_status_integration,
    aws_api_gateway_integration.options_feeds_integration,
    aws_api_gateway_integration.options_status_integration,
    aws_api_gateway_integration.get_schedules_integration,
    aws_api_gateway_integration.post_schedules_integration,
    aws_api_gateway_integration.any_schedules_proxy_integration,
    aws_api_gateway_integration.options_schedules_integration,
    aws_api_gateway_integration.options_schedules_proxy_integration,
    aws_api_gateway_integration.options_feed_events_integration,
    aws_api_gateway_integration.get_config_key_integration,
    aws_api_gateway_integration.put_config_key_integration,
    aws_api_gateway_integration.options_config_key_integration,
    aws_api_gateway_integration.post_notifications_proxy_integration,
    aws_api_gateway_integration.get_notifications_proxy_integration,
    aws_api_gateway_integration.options_notifications_proxy_integration,
    aws_api_gateway_integration.get_users_integration,
    aws_api_gateway_integration.post_users_request_access_integration,
    aws_api_gateway_integration.get_users_pending_integration,
    aws_api_gateway_integration.any_users_proxy_integration,
    aws_api_gateway_integration.options_users_integration,
    aws_api_gateway_integration.options_users_request_access_integration,
    aws_api_gateway_integration.options_users_pending_integration,
    aws_api_gateway_integration.options_users_proxy_integration
  ]

  rest_api_id = aws_api_gateway_rest_api.this.id
  triggers = {
    redeployment = sha1(jsonencode([
      aws_api_gateway_resource.docs_resource.id,
      aws_api_gateway_resource.redoc_resource.id,
      aws_api_gateway_resource.openapi_json_resource.id,
      aws_api_gateway_resource.api_resource.id,
      aws_api_gateway_resource.v1_resource.id,
      aws_api_gateway_resource.feeds_resource.id,
      aws_api_gateway_resource.feed_events_resource.id,
      aws_api_gateway_resource.schedules_resource.id,
      aws_api_gateway_resource.schedules_proxy_resource.id,
      aws_api_gateway_resource.status_resource.id,
      aws_api_gateway_resource.config_resource.id,
      aws_api_gateway_resource.config_key_resource.id,
      aws_api_gateway_resource.notifications_resource.id,
      aws_api_gateway_resource.notifications_proxy_resource.id,
      aws_api_gateway_resource.users_resource.id,
      aws_api_gateway_resource.users_request_access_resource.id,
      aws_api_gateway_resource.users_pending_resource.id,
      aws_api_gateway_resource.users_proxy_resource.id,
      aws_api_gateway_method.get_docs_method.id,
      aws_api_gateway_method.options_docs_method.id,
      aws_api_gateway_method.get_redoc_method.id,
      aws_api_gateway_method.options_redoc_method.id,
      aws_api_gateway_method.get_openapi_json_method.id,
      aws_api_gateway_method.options_openapi_json_method.id,
      aws_api_gateway_method.post_feeds_method.id,
      aws_api_gateway_method.get_feed_events_method.id,
      aws_api_gateway_method.delete_feed_events_method.id,
      aws_api_gateway_method.get_status_method.id,
      aws_api_gateway_method.put_status_method.id,
      aws_api_gateway_method.options_feeds_method.id,
      aws_api_gateway_method.options_status_method.id,
      aws_api_gateway_method.get_schedules_method.id,
      aws_api_gateway_method.post_schedules_method.id,
      aws_api_gateway_method.any_schedules_proxy_method.id,
      aws_api_gateway_method.options_schedules_method.id,
      aws_api_gateway_method.options_schedules_proxy_method.id,
      aws_api_gateway_method.options_feed_events_method.id,
      aws_api_gateway_method.get_config_key_method.id,
      aws_api_gateway_method.put_config_key_method.id,
      aws_api_gateway_method.options_config_key_method.id,
      aws_api_gateway_method.post_notifications_proxy_method.id,
      aws_api_gateway_method.get_notifications_proxy_method.id,
      aws_api_gateway_method.options_notifications_proxy_method.id,
      aws_api_gateway_method.get_users_method.id,
      aws_api_gateway_method.post_users_request_access_method.id,
      aws_api_gateway_method.get_users_pending_method.id,
      aws_api_gateway_method.any_users_proxy_method.id,
      aws_api_gateway_method.options_users_method.id,
      aws_api_gateway_method.options_users_request_access_method.id,
      aws_api_gateway_method.options_users_pending_method.id,
      aws_api_gateway_method.options_users_proxy_method.id
    ]))
  }

  lifecycle {
    create_before_destroy = true
  }
}

resource "aws_api_gateway_stage" "this" {
  deployment_id = aws_api_gateway_deployment.this.id
  rest_api_id   = aws_api_gateway_rest_api.this.id
  stage_name    = var.stage_name

  tags = {
    Project = var.project_name
  }
}

resource "aws_api_gateway_method_settings" "cors_settings_root" {
  rest_api_id = aws_api_gateway_rest_api.this.id
  stage_name  = aws_api_gateway_stage.this.stage_name
  method_path = "*/*"

  settings {
    metrics_enabled = true
    logging_level   = "OFF"  # Disabled to avoid needing CloudWatch role setup
    require_authorization_for_cache_control = false

    # Rate limiting: 3000 requests per hour GLOBAL (all users combined)
    # 3000 req/hour = 0.833 req/sec
    # Burst limit = 20 (allows polling spikes from multiple users)
    throttling_burst_limit = 20    # Handle polling spikes
    throttling_rate_limit  = 0.833 # ~3000 req/hour total across all users
  }
}

# Custom Domain Name with TLS 1.2+ support (only created if custom_domain_name is provided)
# TLS_1_2 policy supports both TLS 1.2 and TLS 1.3 (minimum TLS 1.2 required)
resource "aws_api_gateway_domain_name" "this" {
  count = var.custom_domain_name != "" ? 1 : 0

  domain_name              = var.custom_domain_name
  regional_certificate_arn = var.certificate_arn
  security_policy          = "TLS_1_2"

  endpoint_configuration {
    types = ["REGIONAL"]
  }

  tags = {
    Project = var.project_name
  }
}

# Base Path Mapping to connect custom domain to API stage
resource "aws_api_gateway_base_path_mapping" "this" {
  count = var.custom_domain_name != "" ? 1 : 0

  api_id      = aws_api_gateway_rest_api.this.id
  stage_name  = aws_api_gateway_stage.this.stage_name
  domain_name = aws_api_gateway_domain_name.this[0].domain_name
}
