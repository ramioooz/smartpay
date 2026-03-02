# ECS cluster runs all SmartPay microservices as isolated Fargate tasks.
resource "aws_ecs_cluster" "smartpay" {
  name = "${local.name_prefix}-ecs"

  setting {
    name  = "containerInsights"
    value = "enabled"
  }

  tags = local.default_tags
}

# Log groups are created per service for clean observability boundaries.
resource "aws_cloudwatch_log_group" "service_logs" {
  for_each = toset([
    "api-gateway",
    "payment-srv",
    "fx-srv",
    "merchant-srv",
    "routing-srv",
    "reconciliation-srv",
  ])

  name              = "/ecs/${local.name_prefix}/${each.value}"
  retention_in_days = 30
  tags              = local.default_tags
}

resource "aws_iam_role" "ecs_task_execution" {
  name = "${local.name_prefix}-ecs-task-execution"

  assume_role_policy = jsonencode({
    Version = "2012-10-17"
    Statement = [
      {
        Effect = "Allow"
        Principal = {
          Service = "ecs-tasks.amazonaws.com"
        }
        Action = "sts:AssumeRole"
      }
    ]
  })

  tags = local.default_tags
}

resource "aws_iam_role_policy_attachment" "ecs_task_execution" {
  role       = aws_iam_role.ecs_task_execution.name
  policy_arn = "arn:aws:iam::aws:policy/service-role/AmazonECSTaskExecutionRolePolicy"
}

resource "aws_iam_role" "ecs_task_runtime" {
  name = "${local.name_prefix}-ecs-task-runtime"

  assume_role_policy = aws_iam_role.ecs_task_execution.assume_role_policy
  tags               = local.default_tags
}

locals {
  service_configs = {
    api-gateway = {
      image = var.container_images.api_gateway
      port  = 3000
      cpu   = var.ecs_task_cpu
      mem   = var.ecs_task_memory
      env = {
        NODE_ENV         = "production"
        PORT             = "3000"
        REDIS_HOST       = aws_elasticache_replication_group.redis.primary_endpoint_address
        REDIS_PORT       = "6379"
        PAYMENT_SRV_URL  = "http://payment-srv:3001"
        FX_SRV_URL       = "http://fx-srv:3002"
        MERCHANT_SRV_URL = "http://merchant-srv:3003"
      }
    }
    payment-srv = {
      image = var.container_images.payment_srv
      port  = 3001
      cpu   = var.payment_task_cpu
      mem   = var.payment_task_memory
      env = {
        NODE_ENV            = "production"
        PORT                = "3001"
        PAYMENT_DATABASE_URL = "postgresql://${var.postgres_username}:${var.postgres_password}@${aws_db_proxy.smartpay.endpoint}:5432/${var.postgres_db_name}?schema=payments_schema&pgbouncer=true"
        MONGO_URI           = "mongodb://documentdb-not-yet-provisioned:27017/smartpay"
        REDIS_HOST          = aws_elasticache_replication_group.redis.primary_endpoint_address
        REDIS_PORT          = "6379"
        KAFKA_BROKERS       = aws_msk_cluster.smartpay.bootstrap_brokers
        ROUTING_SRV_URL     = "http://routing-srv:3004"
        FX_SRV_URL          = "http://fx-srv:3002"
      }
    }
    fx-srv = {
      image = var.container_images.fx_srv
      port  = 3002
      cpu   = var.ecs_task_cpu
      mem   = var.ecs_task_memory
      env = {
        NODE_ENV                    = "production"
        PORT                        = "3002"
        REDIS_HOST                  = aws_elasticache_replication_group.redis.primary_endpoint_address
        REDIS_PORT                  = "6379"
        KAFKA_BROKERS               = aws_msk_cluster.smartpay.bootstrap_brokers
        FX_PRIMARY_PROVIDER         = "frankfurter"
        FX_FALLBACK_PROVIDER        = "simulated"
        FRANKFURTER_BASE_URL        = "https://api.frankfurter.dev/v1"
        FX_RATE_REFRESH_INTERVAL_MS = "5000"
        FX_RATE_CACHE_TTL_SECONDS   = "30"
      }
    }
    merchant-srv = {
      image = var.container_images.merchant_srv
      port  = 3003
      cpu   = var.ecs_task_cpu
      mem   = var.ecs_task_memory
      env = {
        NODE_ENV             = "production"
        PORT                 = "3003"
        MERCHANT_DATABASE_URL = "postgresql://${var.postgres_username}:${var.postgres_password}@${aws_db_proxy.smartpay.endpoint}:5432/${var.postgres_db_name}?schema=merchants_schema&pgbouncer=true"
        MONGO_URI            = "mongodb://documentdb-not-yet-provisioned:27017/smartpay"
        REDIS_HOST           = aws_elasticache_replication_group.redis.primary_endpoint_address
        REDIS_PORT           = "6379"
        KAFKA_BROKERS        = aws_msk_cluster.smartpay.bootstrap_brokers
      }
    }
    routing-srv = {
      image = var.container_images.routing_srv
      port  = 3004
      cpu   = var.ecs_task_cpu
      mem   = var.ecs_task_memory
      env = {
        NODE_ENV            = "production"
        PORT                = "3004"
        ROUTING_DATABASE_URL = "postgresql://${var.postgres_username}:${var.postgres_password}@${aws_db_proxy.smartpay.endpoint}:5432/${var.postgres_db_name}?schema=routing_schema&pgbouncer=true"
        MONGO_URI           = "mongodb://documentdb-not-yet-provisioned:27017/smartpay"
        REDIS_HOST          = aws_elasticache_replication_group.redis.primary_endpoint_address
        REDIS_PORT          = "6379"
        KAFKA_BROKERS       = aws_msk_cluster.smartpay.bootstrap_brokers
      }
    }
    reconciliation-srv = {
      image = var.container_images.reconciliation_srv
      port  = 3005
      cpu   = var.ecs_task_cpu
      mem   = var.ecs_task_memory
      env = {
        NODE_ENV                      = "production"
        PORT                          = "3005"
        MONGO_URI                     = "mongodb://documentdb-not-yet-provisioned:27017/smartpay"
        REDIS_HOST                    = aws_elasticache_replication_group.redis.primary_endpoint_address
        REDIS_PORT                    = "6379"
        KAFKA_BROKERS                 = aws_msk_cluster.smartpay.bootstrap_brokers
        RECON_HOURLY_CRON             = "0 * * * *"
        RECON_DAILY_CRON              = "30 0 * * *"
        RECON_DEFAULT_LOOKBACK_MINUTES = "60"
      }
    }
  }
}

resource "aws_ecs_task_definition" "services" {
  for_each = local.service_configs

  family                   = "${local.name_prefix}-${each.key}"
  network_mode             = "awsvpc"
  requires_compatibilities = ["FARGATE"]
  cpu                      = tostring(each.value.cpu)
  memory                   = tostring(each.value.mem)
  execution_role_arn       = aws_iam_role.ecs_task_execution.arn
  task_role_arn            = aws_iam_role.ecs_task_runtime.arn

  container_definitions = jsonencode([
    {
      name      = each.key
      image     = each.value.image
      essential = true
      portMappings = [
        {
          containerPort = each.value.port
          hostPort      = each.value.port
          protocol      = "tcp"
        }
      ]
      environment = [
        for key, value in each.value.env : {
          name  = key
          value = tostring(value)
        }
      ]
      logConfiguration = {
        logDriver = "awslogs"
        options = {
          awslogs-group         = aws_cloudwatch_log_group.service_logs[each.key].name
          awslogs-region        = var.aws_region
          awslogs-stream-prefix = "ecs"
        }
      }
    }
  ])

  tags = local.default_tags
}

# Internet-facing load balancer for api-gateway service.
resource "aws_lb" "api" {
  name               = "${local.name_prefix}-alb"
  load_balancer_type = "application"
  security_groups    = [aws_security_group.alb.id]
  subnets            = module.vpc.public_subnets
  tags               = local.default_tags
}

resource "aws_lb_target_group" "api_gateway" {
  name        = substr("${local.name_prefix}-api-tg", 0, 32)
  port        = 3000
  protocol    = "HTTP"
  vpc_id      = module.vpc.vpc_id
  target_type = "ip"

  health_check {
    path                = "/health"
    matcher             = "200"
    healthy_threshold   = 2
    unhealthy_threshold = 3
    timeout             = 5
    interval            = 15
  }

  tags = local.default_tags
}

resource "aws_lb_listener" "http" {
  load_balancer_arn = aws_lb.api.arn
  port              = 80
  protocol          = "HTTP"

  default_action {
    type             = "forward"
    target_group_arn = aws_lb_target_group.api_gateway.arn
  }
}

resource "aws_ecs_service" "services" {
  for_each = local.service_configs

  name            = each.key
  cluster         = aws_ecs_cluster.smartpay.id
  task_definition = aws_ecs_task_definition.services[each.key].arn
  desired_count   = var.service_desired_count
  launch_type     = "FARGATE"

  network_configuration {
    subnets         = module.vpc.private_subnets
    security_groups = [aws_security_group.ecs_tasks.id]
    assign_public_ip = false
  }

  dynamic "load_balancer" {
    for_each = each.key == "api-gateway" ? [1] : []
    content {
      target_group_arn = aws_lb_target_group.api_gateway.arn
      container_name   = each.key
      container_port   = each.value.port
    }
  }

  depends_on = [aws_lb_listener.http]

  tags = local.default_tags
}
