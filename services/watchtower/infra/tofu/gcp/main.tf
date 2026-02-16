terraform {
  required_version = ">= 1.0.0"

  required_providers {
    google = {
      source  = "hashicorp/google"
      version = "~> 5.0"
    }
  }
}

provider "google" {
  project = var.project_id
  region  = var.region
}

# Service Account for Cloud Run
resource "google_service_account" "watchtower" {
  account_id   = "${var.service_name}-sa"
  display_name = "IRSB Watchtower Service Account"
  description  = "Service account for IRSB Watchtower Cloud Run service"
}

# Grant Secret Manager access to service account
resource "google_project_iam_member" "secret_accessor" {
  project = var.project_id
  role    = "roles/secretmanager.secretAccessor"
  member  = "serviceAccount:${google_service_account.watchtower.email}"
}

# Cloud Run Service
resource "google_cloud_run_v2_service" "watchtower" {
  name     = var.service_name
  location = var.region

  template {
    service_account = google_service_account.watchtower.email

    containers {
      image = var.image

      ports {
        container_port = 3000
      }

      env {
        name  = "NODE_ENV"
        value = "production"
      }

      env {
        name  = "LOG_FORMAT"
        value = "json"
      }

      env {
        name  = "LOG_LEVEL"
        value = var.log_level
      }

      env {
        name  = "API_PORT"
        value = "3000"
      }

      env {
        name  = "API_HOST"
        value = "0.0.0.0"
      }

      env {
        name  = "CHAIN_ID"
        value = var.chain_id
      }

      env {
        name  = "ENABLE_ACTIONS"
        value = var.enable_actions ? "true" : "false"
      }

      # RPC URL from Secret Manager (if provided)
      dynamic "env" {
        for_each = var.rpc_url_secret != "" ? [1] : []
        content {
          name = "RPC_URL"
          value_source {
            secret_key_ref {
              secret  = var.rpc_url_secret
              version = "latest"
            }
          }
        }
      }

      # RPC URL from variable (if no secret)
      dynamic "env" {
        for_each = var.rpc_url_secret == "" && var.rpc_url != "" ? [1] : []
        content {
          name  = "RPC_URL"
          value = var.rpc_url
        }
      }

      # IRSB Contract Addresses
      env {
        name  = "SOLVER_REGISTRY_ADDRESS"
        value = var.solver_registry_address
      }

      env {
        name  = "INTENT_RECEIPT_HUB_ADDRESS"
        value = var.intent_receipt_hub_address
      }

      env {
        name  = "DISPUTE_MODULE_ADDRESS"
        value = var.dispute_module_address
      }

      resources {
        limits = {
          cpu    = var.cpu_limit
          memory = var.memory_limit
        }
      }

      startup_probe {
        http_get {
          path = "/health"
          port = 3000
        }
        initial_delay_seconds = 5
        period_seconds        = 5
        failure_threshold     = 3
      }

      liveness_probe {
        http_get {
          path = "/health"
          port = 3000
        }
        period_seconds    = 10
        failure_threshold = 3
      }
    }

    scaling {
      min_instance_count = var.min_instances
      max_instance_count = var.max_instances
    }
  }

  traffic {
    type    = "TRAFFIC_TARGET_ALLOCATION_TYPE_LATEST"
    percent = 100
  }
}

# Allow unauthenticated access (optional - remove for private service)
resource "google_cloud_run_v2_service_iam_member" "noauth" {
  count    = var.allow_unauthenticated ? 1 : 0
  location = google_cloud_run_v2_service.watchtower.location
  name     = google_cloud_run_v2_service.watchtower.name
  role     = "roles/run.invoker"
  member   = "allUsers"
}

# Cloud Scheduler for periodic scans (optional)
resource "google_cloud_scheduler_job" "scan" {
  count            = var.scan_schedule != "" ? 1 : 0
  name             = "${var.service_name}-scan"
  description      = "Trigger periodic IRSB scans"
  schedule         = var.scan_schedule
  time_zone        = "UTC"
  attempt_deadline = "180s"

  http_target {
    http_method = "POST"
    uri         = "${google_cloud_run_v2_service.watchtower.uri}/scan"

    oidc_token {
      service_account_email = google_service_account.watchtower.email
    }
  }
}
