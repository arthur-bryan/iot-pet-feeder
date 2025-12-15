output "api_gateway_invoke_url" {
  description = "The invoke URL for the API Gateway."
  value       = module.api_gateway.api_gateway_invoke_url
}

output "lambda_deployment_bucket_name" {
  description = "Name of the S3 bucket for Lambda deployment packages."
  value       = aws_s3_bucket.lambda_deployment_bucket.id
}

output "iot_thing_name" {
  description = "The name of the AWS IoT Thing created."
  value       = module.iot_device.thing_name
}

output "iot_certificate_arn" {
  description = "The ARN of the generated AWS IoT certificate."
  value       = module.iot_device.certificate_arn
}

output "iot_certificate_pem_secret_arn" {
  description = "The ARN of the AWS Secrets Manager secret storing the client certificate PEM. Retrieve this securely."
  value       = module.iot_device.certificate_pem_secret_arn
}

output "iot_private_key_pem_secret_arn" {
  description = "The ARN of the AWS Secrets Manager secret storing the private key PEM. Retrieve this securely."
  value       = module.iot_device.private_key_pem_secret_arn
}

output "aws_iot_root_ca_url_info" {
  description = "You need to manually download the Amazon Root CA 1 certificate. Search for 'Amazon Root CA 1' on AWS IoT documentation or use this link for direct download: https://www.amazontrust.com/repository/AmazonRootCA1.pem"
  value       = module.iot_device.aws_iot_root_ca_url_info
}

output "iot_data_plane_endpoint" {
  description = "The AWS IoT Data Plane endpoint. Use this in your ESP32 firmware to connect to AWS IoT."
  value       = data.aws_iot_endpoint.iot_data_endpoint.endpoint_address
}

output "amplify_frontend_url" { # <<< NEW OUTPUT
  description = "The URL of the deployed Amplify frontend application."
  value       = "https://${var.environment}.${module.amplify_app.amplify_app_default_domain}"
}

output "amplify_app_id" {
  description = "The Amplify App ID"
  value       = module.amplify_app.amplify_app_id
}

# Cognito outputs (only for non-demo environments)
output "cognito_user_pool_id" {
  description = "Cognito User Pool ID"
  value       = var.environment != "demo" ? module.cognito_user_pool[0].user_pool_id : "N/A - Demo environment"
}

output "cognito_admin_email" {
  description = "Admin user email address"
  value       = var.environment != "demo" ? var.admin_email : "N/A - Demo environment"
}

output "admin_password_retrieval_info" {
  description = "How to retrieve the admin temporary password if you missed it"
  value       = var.environment != "demo" ? "The admin password was displayed during 'terraform apply'. If you missed it, check CloudWatch Logs: aws logs tail /aws/lambda/${module.admin_user_creator_lambda[0].lambda_function_name} --region ${var.aws_region} --since 1h | grep TEMPORARY" : "N/A - Demo environment"
}

# Monitoring outputs
output "alarm_notification_topic_arn" {
  description = "SNS Topic ARN for CloudWatch alarm notifications. Subscribe to receive alerts."
  value       = aws_sns_topic.alarm_notifications.arn
}

output "alarm_subscription_command" {
  description = "Command to subscribe your email to alarm notifications"
  value       = "aws sns subscribe --topic-arn ${aws_sns_topic.alarm_notifications.arn} --protocol email --notification-endpoint YOUR_EMAIL@example.com --region ${var.aws_region}"
}

# DynamoDB Tables
output "dynamodb_tables" {
  description = "List of DynamoDB tables created"
  value = {
    feed_history             = module.feed_history_table.table_name
    device_status            = module.device_status_table.table_name
    feed_schedules           = module.feed_schedule_table.table_name
    feed_config              = module.feed_config_table.table_name
    schedule_execution_history = module.schedule_execution_history_table.table_name
    pending_users            = var.environment != "demo" ? module.pending_users_table[0].table_name : "N/A - Demo environment"
  }
}
