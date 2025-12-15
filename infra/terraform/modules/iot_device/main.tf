# infra/terraform/modules/iot_device/main.tf
resource "aws_iot_thing" "this" {
  name = var.thing_name

  attributes = {
    model   = "ESP32-Feeder"
    version = "1.0"
  }
  # The 'tags' argument is not supported directly on aws_iot_thing resource.
  # Tags are typically applied at a higher level (e.g., Thing Group) or via other mechanisms.
}

resource "aws_iot_certificate" "this" {
  # Terraform is explicitly asking for 'active' and rejecting 'active_when_created'.
  # This might indicate a specific AWS provider version or a cached state issue.
  # Setting 'active = true' to directly address the error.
  # If issues persist, please ensure your AWS provider version is compatible with this syntax.
  active = true # <<< CORRECTED THIS: Using 'active' as per the error message
}

resource "aws_iot_policy" "this" {
  name = var.policy_name

  policy = jsonencode({
    Version = "2012-10-17",
    Statement = [
      {
        Effect = "Allow",
        Action = ["iot:Connect"],
        Resource = "arn:aws:iot:${var.aws_region}:${var.aws_account_id}:client/${var.thing_name}"
      },
      {
        Effect = "Allow",
        Action = ["iot:Publish"],
        Resource = [
          "arn:aws:iot:${var.aws_region}:${var.aws_account_id}:topic/petfeeder/status",
          "arn:aws:iot:${var.aws_region}:${var.aws_account_id}:topic/petfeeder/feed_event",
          "arn:aws:iot:${var.aws_region}:${var.aws_account_id}:topic/$aws/things/${var.thing_name}/shadow/update",
          "arn:aws:iot:${var.aws_region}:${var.aws_account_id}:topic/$aws/things/${var.thing_name}/shadow/get"
        ]
      },
      {
        Effect = "Allow",
        Action = ["iot:Subscribe"],
        Resource = [
          "arn:aws:iot:${var.aws_region}:${var.aws_account_id}:topicfilter/petfeeder/commands",
          "arn:aws:iot:${var.aws_region}:${var.aws_account_id}:topicfilter/petfeeder/config",
          "arn:aws:iot:${var.aws_region}:${var.aws_account_id}:topicfilter/$aws/things/${var.thing_name}/shadow/update/delta",
          "arn:aws:iot:${var.aws_region}:${var.aws_account_id}:topicfilter/$aws/things/${var.thing_name}/shadow/update/accepted",
          "arn:aws:iot:${var.aws_region}:${var.aws_account_id}:topicfilter/$aws/things/${var.thing_name}/shadow/update/rejected",
          "arn:aws:iot:${var.aws_region}:${var.aws_account_id}:topicfilter/$aws/things/${var.thing_name}/shadow/get/accepted",
          "arn:aws:iot:${var.aws_region}:${var.aws_account_id}:topicfilter/$aws/things/${var.thing_name}/shadow/get/rejected"
        ]
      },
      {
        Effect = "Allow",
        Action = ["iot:Receive"],
        Resource = [
          "arn:aws:iot:${var.aws_region}:${var.aws_account_id}:topic/petfeeder/commands",
          "arn:aws:iot:${var.aws_region}:${var.aws_account_id}:topic/petfeeder/config",
          "arn:aws:iot:${var.aws_region}:${var.aws_account_id}:topic/$aws/things/${var.thing_name}/shadow/update/delta",
          "arn:aws:iot:${var.aws_region}:${var.aws_account_id}:topic/$aws/things/${var.thing_name}/shadow/update/accepted",
          "arn:aws:iot:${var.aws_region}:${var.aws_account_id}:topic/$aws/things/${var.thing_name}/shadow/update/rejected",
          "arn:aws:iot:${var.aws_region}:${var.aws_account_id}:topic/$aws/things/${var.thing_name}/shadow/get/accepted",
          "arn:aws:iot:${var.aws_region}:${var.aws_account_id}:topic/$aws/things/${var.thing_name}/shadow/get/rejected"
        ]
      }
    ]
  })
  tags = {
    Project = var.project_name
  }
}

resource "aws_iot_policy_attachment" "cert_policy_attach" {
  policy = aws_iot_policy.this.name
  target = aws_iot_certificate.this.arn
}

resource "aws_iot_thing_principal_attachment" "thing_cert_attach" {
  thing = aws_iot_thing.this.name
  principal  = aws_iot_certificate.this.arn
}

# Store certificate PEM in Secrets Manager
resource "aws_secretsmanager_secret" "certificate_pem_secret" {
  name        = "${var.project_name}/${var.thing_name}/certificate_pem"
  description = "AWS IoT Core client certificate PEM for ${var.thing_name}"
  recovery_window_in_days = 0 # Set to 0 to allow immediate deletion for testing/dev
  tags = {
    Project = var.project_name
  }
}

resource "aws_secretsmanager_secret_version" "certificate_pem_secret_version" {
  secret_id     = aws_secretsmanager_secret.certificate_pem_secret.id
  secret_string = aws_iot_certificate.this.certificate_pem
}

# Store private key PEM in Secrets Manager
resource "aws_secretsmanager_secret" "private_key_pem_secret" {
  name        = "${var.project_name}/${var.thing_name}/private_key_pem"
  description = "AWS IoT Core private key PEM for ${var.thing_name}"
  recovery_window_in_days = 0 # Set to 0 to allow immediate deletion for testing/dev
  tags = {
    Project = var.project_name
  }
}

resource "aws_secretsmanager_secret_version" "private_key_pem_secret_version" {
  secret_id     = aws_secretsmanager_secret.private_key_pem_secret.id
  secret_string = aws_iot_certificate.this.private_key
}

data "aws_iot_endpoint" "iot_data_endpoint" {
  endpoint_type = "iot:Data-ATS"
}
