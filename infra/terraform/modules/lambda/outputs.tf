output "lambda_arn" {
  description = "The ARN of the Lambda function."
  value       = aws_lambda_function.this.arn
}

output "lambda_function_name" {
  description = "The name of the Lambda function."
  value       = aws_lambda_function.this.function_name
}

output "lambda_execution_role_arn" {
  description = "The ARN of the Lambda execution role."
  value       = aws_iam_role.execution_role.arn
}
