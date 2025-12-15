# CloudWatch Alarms for Lambda and API Gateway monitoring

# Lambda Error Alarms - one per function
resource "aws_cloudwatch_metric_alarm" "lambda_errors" {
  for_each = toset(var.lambda_function_names)

  alarm_name          = "${var.project_name}-${each.value}-errors-${var.environment}"
  comparison_operator = "GreaterThanOrEqualToThreshold"
  evaluation_periods  = var.evaluation_periods
  metric_name         = "Errors"
  namespace           = "AWS/Lambda"
  period              = var.period_seconds
  statistic           = "Sum"
  threshold           = var.lambda_error_threshold
  alarm_description   = "Lambda function ${each.value} errors exceeded threshold"
  treat_missing_data  = "notBreaching"

  dimensions = {
    FunctionName = each.value
  }

  alarm_actions = var.alarm_actions
  ok_actions    = var.alarm_actions

  tags = {
    Project     = var.project_name
    Environment = var.environment
  }
}

# Lambda Throttle Alarms - one per function
resource "aws_cloudwatch_metric_alarm" "lambda_throttles" {
  for_each = toset(var.lambda_function_names)

  alarm_name          = "${var.project_name}-${each.value}-throttles-${var.environment}"
  comparison_operator = "GreaterThanOrEqualToThreshold"
  evaluation_periods  = var.evaluation_periods
  metric_name         = "Throttles"
  namespace           = "AWS/Lambda"
  period              = var.period_seconds
  statistic           = "Sum"
  threshold           = 1
  alarm_description   = "Lambda function ${each.value} is being throttled"
  treat_missing_data  = "notBreaching"

  dimensions = {
    FunctionName = each.value
  }

  alarm_actions = var.alarm_actions
  ok_actions    = var.alarm_actions

  tags = {
    Project     = var.project_name
    Environment = var.environment
  }
}

# API Gateway 5xx Error Alarm
resource "aws_cloudwatch_metric_alarm" "api_5xx_errors" {
  alarm_name          = "${var.project_name}-api-5xx-errors-${var.environment}"
  comparison_operator = "GreaterThanOrEqualToThreshold"
  evaluation_periods  = var.evaluation_periods
  metric_name         = "5XXError"
  namespace           = "AWS/ApiGateway"
  period              = var.period_seconds
  statistic           = "Sum"
  threshold           = var.api_5xx_threshold
  alarm_description   = "API Gateway 5xx errors exceeded threshold"
  treat_missing_data  = "notBreaching"

  dimensions = {
    ApiName = var.api_gateway_name
    Stage   = var.api_gateway_stage
  }

  alarm_actions = var.alarm_actions
  ok_actions    = var.alarm_actions

  tags = {
    Project     = var.project_name
    Environment = var.environment
  }
}

# API Gateway 4xx Error Alarm (high rate indicates potential issues)
resource "aws_cloudwatch_metric_alarm" "api_4xx_errors" {
  alarm_name          = "${var.project_name}-api-4xx-errors-${var.environment}"
  comparison_operator = "GreaterThanOrEqualToThreshold"
  evaluation_periods  = var.evaluation_periods
  metric_name         = "4XXError"
  namespace           = "AWS/ApiGateway"
  period              = var.period_seconds
  statistic           = "Sum"
  threshold           = var.api_4xx_threshold
  alarm_description   = "API Gateway 4xx errors exceeded threshold (potential attack or misconfiguration)"
  treat_missing_data  = "notBreaching"

  dimensions = {
    ApiName = var.api_gateway_name
    Stage   = var.api_gateway_stage
  }

  alarm_actions = var.alarm_actions
  ok_actions    = var.alarm_actions

  tags = {
    Project     = var.project_name
    Environment = var.environment
  }
}

# API Gateway Latency Alarm
resource "aws_cloudwatch_metric_alarm" "api_latency" {
  alarm_name          = "${var.project_name}-api-high-latency-${var.environment}"
  comparison_operator = "GreaterThanOrEqualToThreshold"
  evaluation_periods  = var.evaluation_periods
  metric_name         = "Latency"
  namespace           = "AWS/ApiGateway"
  period              = var.period_seconds
  extended_statistic  = "p95"
  threshold           = 5000  # 5 seconds
  alarm_description   = "API Gateway p95 latency exceeded 5 seconds"
  treat_missing_data  = "notBreaching"

  dimensions = {
    ApiName = var.api_gateway_name
    Stage   = var.api_gateway_stage
  }

  alarm_actions = var.alarm_actions
  ok_actions    = var.alarm_actions

  tags = {
    Project     = var.project_name
    Environment = var.environment
  }
}
