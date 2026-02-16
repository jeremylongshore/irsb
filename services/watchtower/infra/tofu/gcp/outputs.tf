output "service_url" {
  description = "Cloud Run service URL"
  value       = google_cloud_run_v2_service.watchtower.uri
}

output "service_name" {
  description = "Cloud Run service name"
  value       = google_cloud_run_v2_service.watchtower.name
}

output "service_account_email" {
  description = "Service account email"
  value       = google_service_account.watchtower.email
}

output "health_endpoint" {
  description = "Health check endpoint URL"
  value       = "${google_cloud_run_v2_service.watchtower.uri}/health"
}

output "scan_endpoint" {
  description = "Scan endpoint URL"
  value       = "${google_cloud_run_v2_service.watchtower.uri}/scan"
}
