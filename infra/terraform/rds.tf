# PostgreSQL stores transactional payment data where ACID guarantees are critical.
resource "aws_db_subnet_group" "postgres" {
  name       = "${local.name_prefix}-postgres-subnets"
  subnet_ids = module.vpc.private_subnets
  tags       = local.default_tags
}

resource "aws_db_instance" "postgres" {
  identifier              = "${local.name_prefix}-postgres"
  engine                  = "postgres"
  engine_version          = "15.8"
  instance_class          = var.postgres_instance_class
  allocated_storage       = var.postgres_allocated_storage
  max_allocated_storage   = var.postgres_allocated_storage * 2
  db_name                 = var.postgres_db_name
  username                = var.postgres_username
  password                = var.postgres_password
  db_subnet_group_name    = aws_db_subnet_group.postgres.name
  vpc_security_group_ids  = [aws_security_group.rds.id]
  multi_az                = var.postgres_multi_az
  backup_retention_period = 7
  deletion_protection     = true
  skip_final_snapshot     = false
  final_snapshot_identifier = "${local.name_prefix}-postgres-final"

  tags = local.default_tags
}
