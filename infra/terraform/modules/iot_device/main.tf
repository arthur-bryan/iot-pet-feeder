resource "aws_iot_thing" "this" {
  name = var.thing_name

  attributes = {
    model = "ESP32-Feeder"
    version = "1.0"
  }

  tags = {
    Project = var.project_name
  }
}

resource "aws_iot_certificate" "this" {
  active = true
}

resource "aws_iot_policy" "this" {
  name = var.policy_name

  policy = jsonencode({
    Version = "2012-10-17",
    Statement = [
      {
        Action = [
          "iot:Connect"
        ],
        Effect = "Allow",
        Resource = "arn:aws:iot:${var.aws_region}:${var.aws_account_id}:client/${var.thing_name}"
      },
      {
        Action = [
          "iot:Publish"
        ],
        Effect = "Allow",
        Resource = [
          "arn:aws:iot:${var.aws_region}:${var.aws_account_id}:topic/${var.publish_topic}",
          "arn:aws:iot:${var.aws_region}:${var.aws_account_id}:topic/${var.subscribe_topic}"
        ]
      },
      {
        Action = [
          "iot:Receive",
          "iot:Subscribe"
        ],
        Effect = "Allow",
        Resource = [
          "arn:aws:iot:${var.aws_region}:${var.aws_account_id}:topicfilter/${var.publish_topic}",
          "arn:aws:iot:${var.aws_region}:${var.aws_account_id}:topicfilter/${var.subscribe_topic}"
        ]
      }
    ]
  })
}

resource "aws_iot_policy_attachment" "this" {
  policy = aws_iot_policy.this.name
  target  = aws_iot_certificate.this.arn
}

resource "aws_iot_thing_principal_attachment" "this" {
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