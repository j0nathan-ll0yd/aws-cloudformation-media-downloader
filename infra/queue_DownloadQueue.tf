# Ejected: added enable_dlq_alarm = false to disable CloudWatch alarm on DLQ

# SQS queue: DownloadQueue
module "queue_DownloadQueue" {
  source                     = "../../mantle/modules/queue"
  queue_name                 = "DownloadQueue"
  name_prefix                = module.core.name_prefix
  tags                       = module.core.common_tags
  visibility_timeout_seconds = 900
  enable_dlq_alarm           = false
}
