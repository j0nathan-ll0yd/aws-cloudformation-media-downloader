# Temporary moved blocks for hand-written → CLI-generated migration
# Remove after first successful apply

# /files resource was inline in lambda_files_get.tf, now shared in api_routes.tf
moved {
  from = aws_api_gateway_resource.files_get
  to   = aws_api_gateway_resource.path_files
}

moved {
  from = aws_api_gateway_resource.file_delete
  to   = aws_api_gateway_resource.path_files_file_id
}

moved {
  from = aws_api_gateway_method.file_delete
  to   = aws_api_gateway_method.files_by_id_delete
}

moved {
  from = aws_api_gateway_integration.file_delete
  to   = aws_api_gateway_integration.files_by_id_delete
}

moved {
  from = module.lambda_file_delete
  to   = module.lambda_files_by_id_delete
}
