resource "aws_dynamodb_table" "this" {
  name             = var.table_name
  billing_mode     = "PAY_PER_REQUEST"
  hash_key         = var.hash_key

  attribute {
    name = var.hash_key
    type = var.hash_key_type
  }

  # Enable DynamoDB Streams if specified
  stream_enabled   = var.enable_streams
  stream_view_type = var.enable_streams ? var.stream_view_type : null

  # Enable Point-in-Time Recovery for backups
  point_in_time_recovery {
    enabled = var.enable_point_in_time_recovery
  }

  tags = {
    Project = var.project_name
  }
}