output "iot_rule_arn" {
  description = "The ARN of the IoT Topic Rule."
  value       = aws_iot_topic_rule.this.arn
}
