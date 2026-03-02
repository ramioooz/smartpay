# MSK provides managed Kafka for service decoupling and event streaming.
resource "aws_msk_configuration" "smartpay" {
  name           = "${local.name_prefix}-msk-config"
  kafka_versions = [var.msk_kafka_version]

  server_properties = <<PROPERTIES
auto.create.topics.enable=true
num.partitions=6
default.replication.factor=2
min.insync.replicas=2
PROPERTIES
}

resource "aws_msk_cluster" "smartpay" {
  cluster_name           = "${local.name_prefix}-msk"
  kafka_version          = var.msk_kafka_version
  number_of_broker_nodes = var.msk_broker_nodes

  broker_node_group_info {
    instance_type   = var.msk_instance_type
    client_subnets  = module.vpc.private_subnets
    security_groups = [aws_security_group.msk.id]

    storage_info {
      ebs_storage_info {
        volume_size = 100
      }
    }
  }

  configuration_info {
    arn      = aws_msk_configuration.smartpay.arn
    revision = aws_msk_configuration.smartpay.latest_revision
  }

  encryption_info {
    encryption_in_transit {
      client_broker = "TLS"
      in_cluster    = true
    }
  }

  tags = local.default_tags
}
