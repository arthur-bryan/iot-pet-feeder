# AWS SES Configuration for Pet Feeder Email Notifications

# SES SANDBOX vs PRODUCTION MODE
#
# SANDBOX MODE (default):
# - Can only send TO verified email addresses
# - Can only send FROM verified email addresses/domains
# - Limited to 200 emails per day
# - Maximum send rate: 1 email per second
# - No AWS approval required
#
# PRODUCTION MODE (requires approval):
# - Can send TO any email address (no verification needed)
# - Can send FROM verified addresses/domains
# - Higher limits: 50,000 emails per day (can request increases)
# - Higher send rate: 14 emails per second (can request increases)
# - Requires AWS approval (usually 24-48 hours)
#
# COST: Same for both modes
# - First 62,000 emails/month: FREE (AWS Free Tier, first 12 months)
# - After free tier: $0.10 per 1,000 emails
# - No additional charges for production mode
#
# To enable production access, set ses_request_production_access = true

# SES Production Access Request
# NOTE: Production access must be requested via AWS CLI (Terraform doesn't support this resource)
# To request production access, run:
#
# aws sesv2 put-account-details \
#   --region us-east-2 \
#   --production-access-enabled \
#   --mail-type TRANSACTIONAL \
#   --website-url "https://dev.d2w2idwvj381w0.amplifyapp.com" \
#   --use-case-description "IoT Pet Feeder application that sends transactional emails: user approval notifications with temporary passwords, feed notifications, and system alerts. Estimated volume: 10-50 emails per day." \
#   --additional-contact-email-addresses "your-email@example.com"
#
# Check status: aws sesv2 get-account --region us-east-2 --query 'ProductionAccessEnabled'

# Verify domain identity in SES
# Once verified, allows sending from ANY email address on this domain
resource "aws_ses_domain_identity" "main" {
  domain = var.domain_name
}

# DKIM configuration for better deliverability
resource "aws_ses_domain_dkim" "main" {
  domain = aws_ses_domain_identity.main.domain
}

# Route53 records for domain verification
resource "aws_route53_record" "ses_verification" {
  count   = var.create_route53_records ? 1 : 0
  zone_id = var.route53_zone_id
  name    = "_amazonses.${var.domain_name}"
  type    = "TXT"
  ttl     = 600
  records = [aws_ses_domain_identity.main.verification_token]
}

# Route53 DKIM records (3 records for email authentication)
resource "aws_route53_record" "ses_dkim" {
  count   = var.create_route53_records ? 3 : 0
  zone_id = var.route53_zone_id
  name    = "${aws_ses_domain_dkim.main.dkim_tokens[count.index]}._domainkey.${var.domain_name}"
  type    = "CNAME"
  ttl     = 600
  records = ["${aws_ses_domain_dkim.main.dkim_tokens[count.index]}.dkim.amazonses.com"]
}

# Configuration set for tracking email metrics (optional but recommended)
resource "aws_ses_configuration_set" "main" {
  name = "${var.project_name}-emails-${var.environment}"

  delivery_options {
    tls_policy = "Require"
  }

  reputation_metrics_enabled = true
}

# IAM policy for Lambda to send emails via SES
resource "aws_iam_policy" "ses_send_email" {
  name        = "${var.project_name}-ses-send-email-${var.environment}"
  description = "Allow Lambda to send emails via SES (domain verified, can send from any address)"

  policy = jsonencode({
    Version = "2012-10-17"
    Statement = [
      {
        Effect = "Allow"
        Action = [
          "ses:SendEmail",
          "ses:SendRawEmail"
        ]
        Resource = aws_ses_domain_identity.main.arn
      }
    ]
  })

  tags = {
    Project     = var.project_name
    Environment = var.environment
  }
}

# Outputs for verification
output "ses_domain_verification_token" {
  description = "SES domain verification token (add to Route53 if not using auto-creation)"
  value       = aws_ses_domain_identity.main.verification_token
}

output "ses_dkim_tokens" {
  description = "DKIM tokens for email authentication"
  value       = aws_ses_domain_dkim.main.dkim_tokens
}

output "ses_sender_email" {
  description = "SES sender email address (domain verified)"
  value       = "iot-pet-feeder@${var.domain_name}"
}

output "ses_domain_identity_arn" {
  description = "ARN of the SES domain identity"
  value       = aws_ses_domain_identity.main.arn
}
