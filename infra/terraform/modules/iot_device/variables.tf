variable "project_name" {
  description = "Name of the project."
  type        = string
}

variable "aws_region" {
  description = "AWS region."
  type        = string
}

variable "aws_account_id" {
  description = "AWS account ID."
  type        = string
}

variable "thing_name" {
  description = "The AWS IoT Thing Name (MQTT Client ID) of your pet feeder device."
  type        = string
}

variable "policy_name" {
  description = "Name of the AWS IoT policy for the device."
  type        = string
}

variable "publish_topic" {
  description = "The MQTT topic for publishing commands to the feeder."
  type        = string
}

variable "subscribe_topic" {
  description = "The MQTT topic the device publishes status to."
  type        = string
}
