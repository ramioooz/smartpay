# RDS Proxy replaces PgBouncer in AWS and centralizes pooled DB connectivity.
resource "aws_iam_role" "rds_proxy" {
  name = "${local.name_prefix}-rds-proxy-role"

  assume_role_policy = jsonencode({
    Version = "2012-10-17"
    Statement = [
      {
        Effect = "Allow"
        Principal = {
          Service = "rds.amazonaws.com"
        }
        Action = "sts:AssumeRole"
      }
    ]
  })

  tags = local.default_tags
}

resource "aws_iam_role_policy_attachment" "rds_proxy_service" {
  role       = aws_iam_role.rds_proxy.name
  policy_arn = "arn:aws:iam::aws:policy/service-role/AmazonRDSProxyServiceRolePolicy"
}

resource "aws_db_proxy" "smartpay" {
  name                   = "${local.name_prefix}-rds-proxy"
  engine_family          = "POSTGRESQL"
  role_arn               = aws_iam_role.rds_proxy.arn
  vpc_subnet_ids         = module.vpc.private_subnets
  vpc_security_group_ids = [aws_security_group.rds.id]
  require_tls            = true
  idle_client_timeout    = 1800

  auth {
    auth_scheme = "SECRETS"
    secret_arn  = var.rds_proxy_secret_arn
    iam_auth    = "REQUIRED"
  }

  tags = local.default_tags
}

resource "aws_db_proxy_default_target_group" "smartpay" {
  db_proxy_name = aws_db_proxy.smartpay.name

  connection_pool_config {
    connection_borrow_timeout    = 120
    max_connections_percent      = 90
    max_idle_connections_percent = 30
  }
}

resource "aws_db_proxy_target" "postgres" {
  db_proxy_name         = aws_db_proxy.smartpay.name
  target_group_name     = aws_db_proxy_default_target_group.smartpay.name
  db_instance_identifier = aws_db_instance.postgres.identifier
}
