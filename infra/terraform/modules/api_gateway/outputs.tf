output "api_gateway_invoke_url" {
  description = "The invoke URL for the API Gateway."
  value       = aws_api_gateway_stage.this.invoke_url
}

output "rest_api_name" {
  description = "The name of the REST API."
  value       = aws_api_gateway_rest_api.this.name
}

output "custom_domain_name" {
  description = "The custom domain name for the API Gateway (if configured)"
  value       = var.custom_domain_name != "" ? aws_api_gateway_domain_name.this[0].domain_name : null
}

output "regional_domain_name" {
  description = "The regional domain name for DNS configuration (use this for Route53 ALIAS record)"
  value       = var.custom_domain_name != "" ? aws_api_gateway_domain_name.this[0].regional_domain_name : null
}

output "regional_zone_id" {
  description = "The regional zone ID for DNS configuration (use this for Route53 ALIAS record)"
  value       = var.custom_domain_name != "" ? aws_api_gateway_domain_name.this[0].regional_zone_id : null
}
