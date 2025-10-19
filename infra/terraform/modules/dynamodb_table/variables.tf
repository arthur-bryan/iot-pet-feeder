variable "project_name" {
  description = "Name of the project."
  type        = string
}

variable "table_name" {
  description = "Name of the DynamoDB table."
  type        = string
}

variable "hash_key" {
  description = "The name of the hash key for the table."
  type        = string
}

variable "hash_key_type" {
  description = "The type of the hash key (S, N, or B)."
  type        = string
  validation {
    condition     = contains(["S", "N", "B"], var.hash_key_type)
    error_message = "Hash key type must be 'S' (String), 'N' (Number), or 'B' (Binary)."
  }
}

variable "enable_streams" {
  description = "Enable DynamoDB Streams for this table"
  type        = bool
  default     = false
}

variable "stream_view_type" {
  description = "Stream view type (KEYS_ONLY, NEW_IMAGE, OLD_IMAGE, NEW_AND_OLD_IMAGES)"
  type        = string
  default     = "NEW_IMAGE"
}
