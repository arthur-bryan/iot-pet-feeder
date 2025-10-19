# infra/terraform/modules/lambda_layer/variables.tf

variable "project_name" {
  description = "Project name"
  type        = string
}

variable "layer_name" {
  description = "Lambda layer name"
  type        = string
}

variable "s3_bucket_id" {
  description = "S3 bucket for layer package"
  type        = string
}

variable "requirements_file" {
  description = "Path to requirements.txt"
  type        = string
}

variable "runtime" {
  description = "Python runtime version"
  type        = string
  default     = "python3.12"
}
