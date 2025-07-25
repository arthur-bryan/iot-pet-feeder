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
  value       = "https://${module.amplify_app.amplify_app_default_domain}"
}