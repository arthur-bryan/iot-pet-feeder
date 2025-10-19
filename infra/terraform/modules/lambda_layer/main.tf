# infra/terraform/modules/lambda_layer/main.tf
# Creates a Lambda Layer from requirements.txt

# Null resource to build the layer locally
resource "null_resource" "pip_install" {
  triggers = {
    requirements_hash = filemd5(var.requirements_file)
  }

  provisioner "local-exec" {
    command = <<-EOT
      set -e
      mkdir -p ${path.module}/layer_build/python
      python3 -m pip install -r ${var.requirements_file} -t ${path.module}/layer_build/python --upgrade --platform manylinux2014_x86_64 --only-binary=:all:
    EOT
  }
}

# Create zip file for the layer
data "archive_file" "layer_zip" {
  type        = "zip"
  source_dir  = "${path.module}/layer_build"
  output_path = "${path.module}/${var.layer_name}.zip"

  depends_on = [null_resource.pip_install]
}

# Upload layer zip to S3
resource "aws_s3_object" "layer_package" {
  bucket = var.s3_bucket_id
  key    = "${var.layer_name}.zip"
  source = data.archive_file.layer_zip.output_path
  etag   = data.archive_file.layer_zip.output_md5

  depends_on = [data.archive_file.layer_zip]
}

# Create Lambda Layer
resource "aws_lambda_layer_version" "this" {
  layer_name          = var.layer_name
  s3_bucket           = aws_s3_object.layer_package.bucket
  s3_key              = aws_s3_object.layer_package.key
  compatible_runtimes = [var.runtime]
  description         = "Python dependencies for ${var.project_name}"

  depends_on = [aws_s3_object.layer_package]
}
