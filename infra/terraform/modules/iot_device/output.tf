output "thing_name" {
  description = "The name of the AWS IoT Thing created."
  value       = aws_iot_thing.this.name
}

output "certificate_arn" {
  description = "The ARN of the generated AWS IoT certificate."
  value       = aws_iot_certificate.this.arn
}

# Outputs for Secrets Manager ARNs instead of raw PEMs
output "certificate_pem_secret_arn" {
  description = "The ARN of the AWS Secrets Manager secret storing the client certificate PEM."
  value       = aws_secretsmanager_secret.certificate_pem_secret.arn
}

output "private_key_pem_secret_arn" {
  description = "The ARN of the AWS Secrets Manager secret storing the private key PEM."
  value       = aws_secretsmanager_secret.private_key_pem_secret.arn
}

output "aws_iot_root_ca_url_info" {
  description = "You need to manually download the Amazon Root CA 1 certificate. Search for 'Amazon Root CA 1' on AWS IoT documentation or use this link for direct download: https://www.amazontrust.com/repository/AmazonRootCA1.pem"
  value       = "https://www.amazontrust.com/repository/AmazonRootCA1.pem"
}

# From infra/terraform/environments/dev/outputs.tf (relevant data source for endpoint is in main.tf of environment)

output "iot_data_plane_endpoint" {
  description = "The AWS IoT Data Plane endpoint. Use this in your ESP32 firmware to connect to AWS IoT."
  value       = data.aws_iot_endpoint.iot_data_endpoint.endpoint_address
}
