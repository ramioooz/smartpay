variable "aws_region" {
  description = "AWS region where SmartPay will be deployed"
  type        = string
  default     = "us-east-1"
}

variable "environment" {
  description = "Environment name used for tagging and resource naming"
  type        = string
  default     = "dev"
}

variable "project_name" {
  description = "Project name prefix for AWS resources"
  type        = string
  default     = "smartpay"
}

variable "vpc_cidr" {
  description = "Primary CIDR block for the SmartPay VPC"
  type        = string
  default     = "10.40.0.0/16"
}

variable "public_subnet_cidrs" {
  description = "Public subnet CIDR blocks used for ALB and NAT gateways"
  type        = list(string)
  default     = ["10.40.0.0/24", "10.40.1.0/24", "10.40.2.0/24"]
}

variable "private_subnet_cidrs" {
  description = "Private subnet CIDR blocks used by ECS tasks and data services"
  type        = list(string)
  default     = ["10.40.10.0/24", "10.40.11.0/24", "10.40.12.0/24"]
}

variable "ecs_task_cpu" {
  description = "Default CPU units for non-payment ECS task definitions"
  type        = number
  default     = 256
}

variable "ecs_task_memory" {
  description = "Default memory (MiB) for non-payment ECS task definitions"
  type        = number
  default     = 512
}

variable "payment_task_cpu" {
  description = "CPU units for payment-srv task definition"
  type        = number
  default     = 512
}

variable "payment_task_memory" {
  description = "Memory (MiB) for payment-srv task definition"
  type        = number
  default     = 1024
}

variable "service_desired_count" {
  description = "Desired ECS service replica count per microservice"
  type        = number
  default     = 2
}

variable "container_images" {
  description = "Container image URIs per service"
  type = object({
    api_gateway        = string
    payment_srv        = string
    fx_srv             = string
    merchant_srv       = string
    routing_srv        = string
    reconciliation_srv = string
  })
  default = {
    api_gateway        = "ghcr.io/ramioooz/smartpay-api-gateway:latest"
    payment_srv        = "ghcr.io/ramioooz/smartpay-payment-srv:latest"
    fx_srv             = "ghcr.io/ramioooz/smartpay-fx-srv:latest"
    merchant_srv       = "ghcr.io/ramioooz/smartpay-merchant-srv:latest"
    routing_srv        = "ghcr.io/ramioooz/smartpay-routing-srv:latest"
    reconciliation_srv = "ghcr.io/ramioooz/smartpay-reconciliation-srv:latest"
  }
}

variable "postgres_instance_class" {
  description = "RDS PostgreSQL instance class"
  type        = string
  default     = "db.t4g.medium"
}

variable "postgres_allocated_storage" {
  description = "RDS allocated storage in GiB"
  type        = number
  default     = 50
}

variable "postgres_db_name" {
  description = "Primary PostgreSQL database name"
  type        = string
  default     = "smartpay"
}

variable "postgres_username" {
  description = "PostgreSQL admin username"
  type        = string
  default     = "smartpay_admin"
}

variable "postgres_password" {
  description = "PostgreSQL admin password"
  type        = string
  sensitive   = true
}

variable "postgres_multi_az" {
  description = "Enable Multi-AZ deployment for PostgreSQL"
  type        = bool
  default     = true
}

variable "rds_proxy_secret_arn" {
  description = "Secrets Manager ARN containing DB credentials used by RDS Proxy"
  type        = string
}

variable "msk_broker_nodes" {
  description = "Number of broker nodes in MSK cluster"
  type        = number
  default     = 3
}

variable "msk_instance_type" {
  description = "MSK broker instance type"
  type        = string
  default     = "kafka.m5.large"
}

variable "msk_kafka_version" {
  description = "Kafka version for MSK"
  type        = string
  default     = "3.6.0"
}

variable "redis_node_type" {
  description = "ElastiCache node type"
  type        = string
  default     = "cache.t4g.small"
}

variable "redis_engine_version" {
  description = "ElastiCache Redis engine version"
  type        = string
  default     = "7.1"
}

variable "redis_num_cache_clusters" {
  description = "Number of cache nodes in replication group"
  type        = number
  default     = 2
}

variable "tags" {
  description = "Additional tags applied to all resources"
  type        = map(string)
  default     = {}
}
