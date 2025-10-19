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

resource "aws_api_gateway_resource" "feed_resource" {
  rest_api_id = aws_api_gateway_rest_api.this.id
  parent_id   = aws_api_gateway_resource.v1_resource.id
  path_part   = "feed"
}

resource "aws_api_gateway_resource" "feed_history_resource" {
  rest_api_id = aws_api_gateway_rest_api.this.id
  parent_id   = aws_api_gateway_resource.v1_resource.id
  path_part   = "feed_history"
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
  parent_id   = aws_api_gateway_rest_api.this.root_resource_id # Directly under root
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

# API Gateway Method: POST /api/v1/feed
resource "aws_api_gateway_method" "post_feed_method" {
  rest_api_id   = aws_api_gateway_rest_api.this.id
  resource_id   = aws_api_gateway_resource.feed_resource.id
  http_method   = "POST"
  authorization = "NONE"
}

resource "aws_api_gateway_integration" "post_feed_integration" {
  rest_api_id             = aws_api_gateway_rest_api.this.id
  resource_id             = aws_api_gateway_resource.feed_resource.id
  http_method             = aws_api_gateway_method.post_feed_method.http_method
  integration_http_method = "POST"
  type                    = "AWS_PROXY"
  uri                     = "arn:aws:apigateway:${var.aws_region}:lambda:path/2015-03-31/functions/${var.lambda_invoke_arn}/invocations"
}

# --- CORS for /api/v1/feed ---
resource "aws_api_gateway_method" "options_feed_method" {
  rest_api_id   = aws_api_gateway_rest_api.this.id
  resource_id   = aws_api_gateway_resource.feed_resource.id
  http_method   = "OPTIONS"
  authorization = "NONE"
  request_models = {
    "application/json" = "Error"
  }
}

resource "aws_api_gateway_integration" "options_feed_integration" {
  rest_api_id             = aws_api_gateway_rest_api.this.id
  resource_id             = aws_api_gateway_resource.feed_resource.id
  http_method             = aws_api_gateway_method.options_feed_method.http_method
  type                    = "MOCK"
  request_templates = {
    "application/json" = "{ \"statusCode\": 200 }"
  }
}

resource "aws_api_gateway_method_response" "options_feed_200" {
  rest_api_id = aws_api_gateway_rest_api.this.id
  resource_id = aws_api_gateway_resource.feed_resource.id
  http_method = aws_api_gateway_method.options_feed_method.http_method
  status_code = "200"
  response_parameters = {
    "method.response.header.Access-Control-Allow-Headers" = true,
    "method.response.header.Access-Control-Allow-Methods" = true,
    "method.response.header.Access-Control-Allow-Origin"  = true
  }
}

resource "aws_api_gateway_integration_response" "options_feed_integration_200" {
  rest_api_id = aws_api_gateway_rest_api.this.id
  resource_id = aws_api_gateway_resource.feed_resource.id
  http_method = aws_api_gateway_method.options_feed_method.http_method
  status_code = aws_api_gateway_method_response.options_feed_200.status_code
  response_templates = {
    "application/json" = ""
  }
  response_parameters = {
    "method.response.header.Access-Control-Allow-Headers" = "'Content-Type,X-Amz-Date,Authorization,X-Api-Key,X-Amz-Security-Token,X-Amz-User-Agent'",
    "method.response.header.Access-Control-Allow-Methods" = "'OPTIONS,POST,GET'",
    "method.response.header.Access-Control-Allow-Origin"  = "'*'" # <<< CHANGED TO WILDCARD
  }
  depends_on = [aws_api_gateway_integration.options_feed_integration]
}
# --- End CORS for /api/v1/feed ---


# API Gateway Method: GET /api/v1/feed_history
resource "aws_api_gateway_method" "get_feed_history_method" {
  rest_api_id   = aws_api_gateway_rest_api.this.id
  resource_id   = aws_api_gateway_resource.feed_history_resource.id
  http_method   = "GET"
  authorization = "NONE"
}

resource "aws_api_gateway_integration" "get_feed_history_integration" {
  rest_api_id             = aws_api_gateway_rest_api.this.id
  resource_id             = aws_api_gateway_resource.feed_history_resource.id
  http_method             = aws_api_gateway_method.get_feed_history_method.http_method
  integration_http_method = "POST"
  type                    = "AWS_PROXY"
  uri                     = "arn:aws:apigateway:${var.aws_region}:lambda:path/2015-03-31/functions/${var.lambda_invoke_arn}/invocations"
}

# --- CORS for /api/v1/feed_history ---
resource "aws_api_gateway_method" "options_feed_history_method" {
  rest_api_id   = aws_api_gateway_rest_api.this.id
  resource_id   = aws_api_gateway_resource.feed_history_resource.id
  http_method   = "OPTIONS"
  authorization = "NONE"
  request_models = {
    "application/json" = "Error"
  }
}

resource "aws_api_gateway_integration" "options_feed_history_integration" {
  rest_api_id             = aws_api_gateway_rest_api.this.id
  resource_id             = aws_api_gateway_resource.feed_history_resource.id
  http_method             = aws_api_gateway_method.options_feed_history_method.http_method
  type                    = "MOCK"
  request_templates = {
    "application/json" = "{ \"statusCode\": 200 }"
  }
}

resource "aws_api_gateway_method_response" "options_feed_history_200" {
  rest_api_id = aws_api_gateway_rest_api.this.id
  resource_id = aws_api_gateway_resource.feed_history_resource.id
  http_method = aws_api_gateway_method.options_feed_history_method.http_method
  status_code = "200"
  response_parameters = {
    "method.response.header.Access-Control-Allow-Headers" = true,
    "method.response.header.Access-Control-Allow-Methods" = true,
    "method.response.header.Access-Control-Allow-Origin"  = true
  }
}

resource "aws_api_gateway_integration_response" "options_feed_history_integration_200" {
  rest_api_id = aws_api_gateway_rest_api.this.id
  resource_id = aws_api_gateway_resource.feed_history_resource.id
  http_method = aws_api_gateway_method.options_feed_history_method.http_method
  status_code = aws_api_gateway_method_response.options_feed_history_200.status_code
  response_templates = {
    "application/json" = ""
  }
  response_parameters = {
    "method.response.header.Access-Control-Allow-Headers" = "'Content-Type,X-Amz-Date,Authorization,X-Api-Key,X-Amz-Security-Token,X-Amz-User-Agent'",
    "method.response.header.Access-Control-Allow-Methods" = "'OPTIONS,GET'",
    "method.response.header.Access-Control-Allow-Origin"  = "'*'" # <<< CHANGED TO WILDCARD
  }
  depends_on = [aws_api_gateway_integration.options_feed_history_integration]
}
# --- End CORS for /api/v1/feed_history ---


# --- NEW: API Gateway Methods for /api/v1/schedules ---
# GET /api/v1/schedules (list schedules)
resource "aws_api_gateway_method" "get_schedules_method" {
  rest_api_id   = aws_api_gateway_rest_api.this.id
  resource_id   = aws_api_gateway_resource.schedules_resource.id
  http_method   = "GET"
  authorization = "NONE"
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
  authorization = "NONE"
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
  authorization = "NONE"
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
  authorization = "NONE"
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
  authorization = "NONE"
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


# API Gateway Method: GET /status (actual GET method, not OPTIONS)
resource "aws_api_gateway_method" "get_status_method" {
  rest_api_id   = aws_api_gateway_rest_api.this.id
  resource_id   = aws_api_gateway_resource.status_resource.id
  http_method   = "GET"
  authorization = "NONE"
}

resource "aws_api_gateway_integration" "get_status_integration" {
  rest_api_id             = aws_api_gateway_rest_api.this.id
  resource_id             = aws_api_gateway_resource.status_resource.id
  http_method             = aws_api_gateway_method.get_status_method.http_method
  integration_http_method = "POST"
  type                    = "AWS_PROXY"
  uri                     = "arn:aws:apigateway:${var.aws_region}:lambda:path/2015-03-31/functions/${var.lambda_invoke_arn}/invocations"
}

# --- CORS for /status ---
# Moved these definitions below the GET method for status
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
    "method.response.header.Access-Control-Allow-Methods" = "'OPTIONS,GET'",
    "method.response.header.Access-Control-Allow-Origin"  = "'*'" # <<< CHANGED TO WILDCARD
  }
  depends_on = [aws_api_gateway_integration.options_status_integration]
}
# --- End CORS for /status ---


# --- NEW: Notifications Methods ---
# POST /api/v1/notifications/subscribe (and other POST endpoints)
resource "aws_api_gateway_method" "post_notifications_proxy_method" {
  rest_api_id   = aws_api_gateway_rest_api.this.id
  resource_id   = aws_api_gateway_resource.notifications_proxy_resource.id
  http_method   = "POST"
  authorization = "NONE"
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
  authorization = "NONE"
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
    aws_api_gateway_integration.post_feed_integration,
    aws_api_gateway_integration.get_feed_history_integration,
    aws_api_gateway_integration.get_status_integration,
    aws_api_gateway_integration.options_feed_integration,
    aws_api_gateway_integration.options_status_integration,
    aws_api_gateway_integration.get_schedules_integration,
    aws_api_gateway_integration.post_schedules_integration,
    aws_api_gateway_integration.any_schedules_proxy_integration,
    aws_api_gateway_integration.options_schedules_integration,
    aws_api_gateway_integration.options_schedules_proxy_integration,
    aws_api_gateway_integration.options_feed_history_integration,
    aws_api_gateway_integration.get_config_key_integration,
    aws_api_gateway_integration.put_config_key_integration,
    aws_api_gateway_integration.options_config_key_integration,
    aws_api_gateway_integration.post_notifications_proxy_integration,
    aws_api_gateway_integration.get_notifications_proxy_integration,
    aws_api_gateway_integration.options_notifications_proxy_integration
  ]

  rest_api_id = aws_api_gateway_rest_api.this.id
  triggers = {
    redeployment = sha1(jsonencode([
      aws_api_gateway_resource.api_resource.id,
      aws_api_gateway_resource.v1_resource.id,
      aws_api_gateway_resource.feed_resource.id,
      aws_api_gateway_resource.feed_history_resource.id,
      aws_api_gateway_resource.schedules_resource.id,
      aws_api_gateway_resource.schedules_proxy_resource.id,
      aws_api_gateway_resource.status_resource.id,
      aws_api_gateway_resource.config_resource.id,
      aws_api_gateway_resource.config_key_resource.id,
      aws_api_gateway_resource.notifications_resource.id,
      aws_api_gateway_resource.notifications_proxy_resource.id,
      aws_api_gateway_method.post_feed_method.id,
      aws_api_gateway_method.get_feed_history_method.id,
      aws_api_gateway_method.get_status_method.id,
      aws_api_gateway_method.options_feed_method.id,
      aws_api_gateway_method.options_status_method.id,
      aws_api_gateway_method.get_schedules_method.id,
      aws_api_gateway_method.post_schedules_method.id,
      aws_api_gateway_method.any_schedules_proxy_method.id,
      aws_api_gateway_method.options_schedules_method.id,
      aws_api_gateway_method.options_schedules_proxy_method.id,
      aws_api_gateway_method.options_feed_history_method.id,
      aws_api_gateway_method.get_config_key_method.id,
      aws_api_gateway_method.put_config_key_method.id,
      aws_api_gateway_method.options_config_key_method.id,
      aws_api_gateway_method.post_notifications_proxy_method.id,
      aws_api_gateway_method.get_notifications_proxy_method.id,
      aws_api_gateway_method.options_notifications_proxy_method.id
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
    metrics_enabled = false
    logging_level   = "OFF"
    require_authorization_for_cache_control = false
  }
}
