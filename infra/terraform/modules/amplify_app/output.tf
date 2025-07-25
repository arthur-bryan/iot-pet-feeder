output "amplify_app_id" {
  description = "The ID of the Amplify App."
  value       = aws_amplify_app.this.id
}

output "amplify_app_arn" {
  description = "The ARN of the Amplify App."
  value       = aws_amplify_app.this.arn
}

output "amplify_app_default_domain" {
  description = "The default domain URL for the Amplify App."
  value       = aws_amplify_app.this.default_domain
}