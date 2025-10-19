.PHONY: help setup validate plan deploy destroy clean esp32-config status logs test

# Default target
.DEFAULT_GOAL := help

# Project paths
TERRAFORM_DIR := infra/terraform/environments/dev
SCRIPTS_DIR := infra/scripts
BACKEND_DIR := backend

help: ## Show this help message
	@echo "IoT Pet Feeder - Available Commands"
	@echo "===================================="
	@echo ""
	@grep -E '^[a-zA-Z_-]+:.*?## .*$$' $(MAKEFILE_LIST) | awk 'BEGIN {FS = ":.*?## "}; {printf "  \033[36m%-20s\033[0m %s\n", $$1, $$2}'
	@echo ""
	@echo "Quick Start:"
	@echo "  1. make setup      - Complete deployment (first time)"
	@echo "  2. make esp32-config - Generate ESP32 credentials"
	@echo "  3. Edit firmware/esp32-feeder/iot-pet-feeder/secrets.h"
	@echo "  4. Flash ESP32 with Arduino IDE"
	@echo ""

setup: ## Complete setup (validation + terraform + post-deploy)
	@bash $(SCRIPTS_DIR)/setup.sh

validate: ## Run pre-deployment validation checks
	@bash $(SCRIPTS_DIR)/validate.sh

plan: ## Preview infrastructure changes
	@cd $(TERRAFORM_DIR) && terraform plan

deploy: ## Deploy infrastructure changes
	@bash $(BACKEND_DIR)/deploy_via_terraform.sh

destroy: ## Destroy all infrastructure (WARNING: destructive)
	@echo "⚠️  WARNING: This will destroy ALL infrastructure"
	@read -p "Are you sure? Type 'yes' to confirm: " confirm && [ "$$confirm" = "yes" ]
	@cd $(TERRAFORM_DIR) && terraform destroy

init: ## Initialize Terraform
	@cd $(TERRAFORM_DIR) && terraform init

clean: ## Clean build artifacts and temp files
	@echo "Cleaning build artifacts..."
	@rm -rf $(BACKEND_DIR)/lambda_deploy_package
	@rm -f $(BACKEND_DIR)/lambda_package.zip
	@rm -f $(TERRAFORM_DIR)/*.tfplan
	@rm -f $(TERRAFORM_DIR)/plan
	@find . -type d -name "__pycache__" -exec rm -rf {} + 2>/dev/null || true
	@find . -type d -name "*.egg-info" -exec rm -rf {} + 2>/dev/null || true
	@echo "✓ Cleanup complete"

esp32-config: ## Generate ESP32 configuration (secrets.h)
	@bash $(SCRIPTS_DIR)/generate-esp32-config.sh

status: ## Show deployment status and URLs
	@echo "Deployment Status"
	@echo "================="
	@echo ""
	@cd $(TERRAFORM_DIR) && terraform output

outputs: status ## Alias for status

logs: ## Tail API Gateway logs (CloudWatch)
	@echo "Fetching recent API logs..."
	@bash -c 'source .env 2>/dev/null || true; aws logs tail /aws/lambda/iot-pet-feeder-api-dev --follow --region $${AWS_REGION:-us-east-2}'

amplify-rebuild: ## Trigger Amplify rebuild manually
	@bash $(SCRIPTS_DIR)/post-deploy.sh

test: ## Run backend tests (if available)
	@if [ -f $(BACKEND_DIR)/requirements-dev.txt ]; then \
		cd $(BACKEND_DIR) && python -m pytest tests/; \
	else \
		echo "⚠  No tests configured yet"; \
	fi

fmt: ## Format Terraform and Python code
	@echo "Formatting Terraform files..."
	@cd $(TERRAFORM_DIR) && terraform fmt -recursive ../..
	@echo "Formatting Python files..."
	@cd $(BACKEND_DIR) && python -m black . 2>/dev/null || echo "⚠  black not installed, skipping"
	@echo "✓ Formatting complete"

config: ## Show current configuration files
	@echo "Configuration Files:"
	@echo "===================="
	@echo ""
	@echo ".env:"
	@[ -f .env ] && echo "  ✓ exists" || echo "  ✗ missing (copy from .env.example)"
	@echo ""
	@echo "terraform.tfvars:"
	@[ -f $(TERRAFORM_DIR)/terraform.tfvars ] && echo "  ✓ exists" || echo "  ✗ missing (copy from terraform.tfvars.example)"
	@echo ""
	@echo "ESP32 secrets.h:"
	@[ -f firmware/esp32-feeder/iot-pet-feeder/secrets.h ] && echo "  ✓ exists" || echo "  ✗ missing (run: make esp32-config)"

check: validate config ## Run all checks (validation + config)

# Development helpers
dev-logs-api: ## Tail API Lambda logs
	@bash -c 'source .env 2>/dev/null || true; aws logs tail /aws/lambda/iot-pet-feeder-api-dev --follow --region $${AWS_REGION:-us-east-2}'

dev-logs-status: ## Tail Status Updater Lambda logs
	@bash -c 'source .env 2>/dev/null || true; aws logs tail /aws/lambda/iot-pet-feeder-iot-status-updater-dev --follow --region $${AWS_REGION:-us-east-2}'

dev-logs-feed: ## Tail Feed Logger Lambda logs
	@bash -c 'source .env 2>/dev/null || true; aws logs tail /aws/lambda/iot-pet-feeder-feed-event-logger-dev --follow --region $${AWS_REGION:-us-east-2}'

refresh: ## Refresh Terraform state
	@cd $(TERRAFORM_DIR) && terraform refresh

graph: ## Generate Terraform dependency graph
	@cd $(TERRAFORM_DIR) && terraform graph | dot -Tpng > infrastructure-graph.png
	@echo "✓ Graph saved to $(TERRAFORM_DIR)/infrastructure-graph.png"
