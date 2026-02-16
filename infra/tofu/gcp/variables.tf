variable "project_id" {
  description = "GCP project ID"
  type        = string
}

variable "region" {
  description = "GCP region for deployment"
  type        = string
  default     = "us-central1"
}

variable "service_name" {
  description = "Cloud Run service name"
  type        = string
  default     = "irsb-watchtower"
}

variable "image" {
  description = "Container image URL"
  type        = string
}

# Chain Configuration

variable "rpc_url" {
  description = "RPC endpoint URL (use rpc_url_secret for sensitive URLs)"
  type        = string
  default     = ""
}

variable "rpc_url_secret" {
  description = "Secret Manager secret name for RPC URL"
  type        = string
  default     = ""
}

variable "chain_id" {
  description = "Chain ID (11155111 for Sepolia)"
  type        = string
  default     = "11155111"
}

# IRSB Contract Addresses (Sepolia defaults)

variable "solver_registry_address" {
  description = "SolverRegistry contract address"
  type        = string
  default     = "0xB6ab964832808E49635fF82D1996D6a888ecB745"
}

variable "intent_receipt_hub_address" {
  description = "IntentReceiptHub contract address"
  type        = string
  default     = "0xD66A1e880AA3939CA066a9EA1dD37ad3d01D977c"
}

variable "dispute_module_address" {
  description = "DisputeModule contract address"
  type        = string
  default     = "0x144DfEcB57B08471e2A75E78fc0d2A74A89DB79D"
}

# Service Configuration

variable "enable_actions" {
  description = "Enable on-chain actions (disputes, evidence submission)"
  type        = bool
  default     = false
}

variable "log_level" {
  description = "Log level (trace, debug, info, warn, error, fatal)"
  type        = string
  default     = "info"
}

# Resource Limits

variable "cpu_limit" {
  description = "CPU limit for Cloud Run"
  type        = string
  default     = "1"
}

variable "memory_limit" {
  description = "Memory limit for Cloud Run"
  type        = string
  default     = "512Mi"
}

variable "min_instances" {
  description = "Minimum number of instances"
  type        = number
  default     = 0
}

variable "max_instances" {
  description = "Maximum number of instances"
  type        = number
  default     = 10
}

# Access Control

variable "allow_unauthenticated" {
  description = "Allow unauthenticated access to the service"
  type        = bool
  default     = false
}

# Scheduling

variable "scan_schedule" {
  description = "Cron schedule for periodic scans (empty to disable)"
  type        = string
  default     = ""
  # Example: "*/5 * * * *" for every 5 minutes
}
