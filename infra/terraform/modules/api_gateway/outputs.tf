output "api_gateway_invoke_url" {
  description = "The invoke URL for the API Gateway."
  value       = aws_api_gateway_stage.this.invoke_url
}
