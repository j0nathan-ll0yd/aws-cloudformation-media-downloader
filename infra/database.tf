# Aurora DSQL Database (ejected — uses dsql_deletion_protection variable)

module "database" {
  source = "../../mantle/modules/database/aurora-dsql"

  name_prefix         = module.core.name_prefix
  tags                = module.core.common_tags
  deletion_protection = var.dsql_deletion_protection
}
