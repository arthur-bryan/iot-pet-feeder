terraform {
  backend "s3" {
    # These values will be passed dynamically by the setup script
    # Do NOT hardcode bucket, key, region, dynamodb_table here
    # They are placeholders for terraform init -backend-config
  }
}
