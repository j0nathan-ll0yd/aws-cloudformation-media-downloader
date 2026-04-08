# Ejected: added enable_dlq_alarm = false to disable CloudWatch alarm on DLQ

# SQS queue: SendPushNotification
module "queue_SendPushNotification" {
  source           = "../../mantle/modules/queue"
  queue_name       = "SendPushNotification"
  name_prefix      = module.core.name_prefix
  tags             = module.core.common_tags
  enable_dlq_alarm = false
}
