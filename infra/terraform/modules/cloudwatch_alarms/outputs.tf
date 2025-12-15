output "lambda_error_alarm_arns" {
  description = "ARNs of the Lambda error alarms"
  value       = { for k, v in aws_cloudwatch_metric_alarm.lambda_errors : k => v.arn }
}

output "lambda_throttle_alarm_arns" {
  description = "ARNs of the Lambda throttle alarms"
  value       = { for k, v in aws_cloudwatch_metric_alarm.lambda_throttles : k => v.arn }
}

output "api_5xx_alarm_arn" {
  description = "ARN of the API Gateway 5xx error alarm"
  value       = aws_cloudwatch_metric_alarm.api_5xx_errors.arn
}

output "api_4xx_alarm_arn" {
  description = "ARN of the API Gateway 4xx error alarm"
  value       = aws_cloudwatch_metric_alarm.api_4xx_errors.arn
}

output "api_latency_alarm_arn" {
  description = "ARN of the API Gateway latency alarm"
  value       = aws_cloudwatch_metric_alarm.api_latency.arn
}
