export namespace TerraformPlan {
  export interface ApiGatewayApiKey {
    sensitive: boolean
    value: string
  }

  export interface ApiGatewayRegion {
    sensitive: boolean
    value: string
  }

  export interface ApiGatewayStage {
    sensitive: boolean
    value: string
  }

  export interface ApiGatewaySubdomain {
    sensitive: boolean
    value: string
  }

  export interface CloudfrontDistributionDomain {
    sensitive: boolean
    value: string
  }

  export interface PublicIp {
    sensitive: boolean
    value: string
  }

  export interface Outputs {
    api_gateway_api_key: ApiGatewayApiKey
    api_gateway_region: ApiGatewayRegion
    api_gateway_stage: ApiGatewayStage
    api_gateway_subdomain: ApiGatewaySubdomain
    cloudfront_distribution_domain: CloudfrontDistributionDomain
    public_ip: PublicIp
  }

  export interface ThrottleSetting {
    burst_limit: number
    rate_limit: number
  }

  export interface Tags {
    Environment: string
  }

  export interface Triggers {
    redeployment: string
  }

  // eslint-disable-next-line @typescript-eslint/no-empty-interface
  export interface Variables {}

  // eslint-disable-next-line @typescript-eslint/no-empty-interface
  export interface ResponseParameters {}

  export interface ResponseTemplates {
    'application/json': string
  }

  // eslint-disable-next-line @typescript-eslint/no-empty-interface
  export interface RequestParameters {}

  // eslint-disable-next-line @typescript-eslint/no-empty-interface
  export interface RequestTemplates {}

  // eslint-disable-next-line @typescript-eslint/no-empty-interface
  export interface RequestModels {}

  export interface Setting {
    cache_data_encrypted: boolean
    cache_ttl_in_seconds: number
    caching_enabled: boolean
    data_trace_enabled: boolean
    logging_level: string
    metrics_enabled: boolean
    require_authorization_for_cache_control: boolean
    throttling_burst_limit: number
    throttling_rate_limit: number
    unauthorized_cache_control_header_strategy: string
  }

  export interface EndpointConfiguration {
    types: string[]
    vpc_endpoint_ids: any[]
  }

  export interface ApiStage {
    api_id: string
    stage: string
  }

  export interface Cooky {
    forward: string
    whitelisted_names: any[]
  }

  export interface ForwardedValue {
    cookies: Cooky[]
    headers: string[]
    query_string: boolean
    query_string_cache_keys: any[]
  }

  export interface DefaultCacheBehavior {
    allowed_methods: string[]
    cached_methods: string[]
    compress: boolean
    default_ttl: number
    field_level_encryption_id: string
    forwarded_values: ForwardedValue[]
    lambda_function_association: any[]
    max_ttl: number
    min_ttl: number
    smooth_streaming: boolean
    target_origin_id: string
    trusted_signers: any[]
    viewer_protocol_policy: string
  }

  export interface Cooky2 {
    forward: string
    whitelisted_names: any[]
  }

  export interface ForwardedValue2 {
    cookies: Cooky2[]
    headers: string[]
    query_string: boolean
    query_string_cache_keys: any[]
  }

  export interface LambdaFunctionAssociation {
    event_type: string
    include_body: boolean
    lambda_arn: string
  }

  export interface OrderedCacheBehavior {
    allowed_methods: string[]
    cached_methods: string[]
    compress: boolean
    default_ttl: number
    field_level_encryption_id: string
    forwarded_values: ForwardedValue2[]
    lambda_function_association: LambdaFunctionAssociation[]
    max_ttl: number
    min_ttl: number
    path_pattern: string
    smooth_streaming: boolean
    target_origin_id: string
    trusted_signers: any[]
    viewer_protocol_policy: string
  }

  export interface CustomHeader {
    name: string
    value: string
  }

  export interface CustomOriginConfig {
    http_port: number
    https_port: number
    origin_keepalive_timeout: number
    origin_protocol_policy: string
    origin_read_timeout: number
    origin_ssl_protocols: string[]
  }

  export interface Origin {
    custom_header: CustomHeader[]
    custom_origin_config: CustomOriginConfig[]
    domain_name: string
    origin_id: string
    origin_path: string
    s3_origin_config: any[]
  }

  export interface GeoRestriction {
    locations: string[]
    restriction_type: string
  }

  export interface Restriction {
    geo_restriction: GeoRestriction[]
  }

  export interface TrustedSigner {
    enabled: boolean
    items: any[]
  }

  export interface ViewerCertificate {
    acm_certificate_arn: string
    cloudfront_default_certificate: boolean
    iam_certificate_id: string
    minimum_protocol_version: string
    ssl_support_method: string
  }

  export interface Attribute {
    name: string
    type: string
  }

  export interface PointInTimeRecovery {
    enabled: boolean
  }

  export interface Ttl {
    attribute_name: string
    enabled: boolean
  }

  export interface Variables2 {
    Bucket: string
    DynamoDBTable: string
    StateMachineArn: string
    DefaultFileContentType: string
    DefaultFileName: string
    DefaultFileSize: string
    DefaultFileUrl: string
    DynamoTableFiles: string
    DynamoTableUserFiles: string
    DynamoDBTableUsers: string
    EncryptionKeySecretId: string
    DynamoDBTableUserDevices: string
    PlatformApplicationArn: string
    PushNotificationTopicArn: string
    DynamoDBTableFiles: string
    DynamoDBTableUserFiles: string
    SNSQueueUrl: string
  }

  export interface Environment {
    variables: Variables2
  }

  export interface TracingConfig {
    mode: string
  }

  export interface Versioning {
    enabled: boolean
    mfa_delete: boolean
  }

  export interface LambdaFunction {
    events: string[]
    filter_prefix: string
    filter_suffix: string
    id: string
    lambda_function_arn: string
  }

  // eslint-disable-next-line @typescript-eslint/no-empty-interface
  export interface Metadata {}

  export interface Principal {
    identifiers: string[]
    type: string
  }

  export interface Statement {
    actions: string[]
    condition: any[]
    effect: string
    not_actions: any[]
    not_principals: any[]
    not_resources: any[]
    principals: Principal[]
    resources: string[]
    sid: string
  }

  export interface ResponseHeaders {
    'Access-Control-Allow-Methods': string
    'Access-Control-Allow-Origin': string
    'Alt-Svc': string
    'Cf-Ray': string
    'Cf-Request-Id': string
    'Content-Length': string
    'Content-Type': string
    Date: string
    Server: string
    'Set-Cookie': string
    Vary: string
    'X-Otter': string
    'X-Rtfm': string
    'X-Thank-You': string
  }

  export interface Values2 {
    cloudwatch_role_arn: string
    id: string
    throttle_settings: ThrottleSetting[]
    arn: string
    created_date?: Date
    description: string
    enabled?: boolean
    last_updated_date?: Date
    name: string
    tags: Tags
    value: string
    execution_arn: string
    invoke_url: string
    rest_api_id: string
    stage_description?: any
    stage_name: string
    triggers: Triggers
    variables: Variables
    response_parameters: ResponseParameters
    response_templates: ResponseTemplates
    response_type: string
    status_code: string
    cache_key_parameters: any[]
    cache_namespace: string
    connection_id: string
    connection_type: string
    content_handling: string
    credentials: string
    http_method: string
    integration_http_method: string
    passthrough_behavior: string
    request_parameters: RequestParameters
    request_templates: RequestTemplates
    resource_id: string
    timeout_milliseconds?: number
    type: string
    uri: string
    api_key_required?: boolean
    authorization: string
    authorization_scopes: any[]
    authorizer_id: string
    request_models: RequestModels
    request_validator_id: string
    method_path: string
    settings: Setting[]
    parent_id: string
    path: string
    path_part: string
    api_key_source: string
    binary_media_types: any[]
    body: string
    endpoint_configuration: EndpointConfiguration[]
    minimum_compression_size?: number
    policy: string
    root_resource_id: string
    access_log_settings: any[]
    cache_cluster_enabled?: boolean
    cache_cluster_size: string
    client_certificate_id: string
    deployment_id: string
    documentation_version: string
    xray_tracing_enabled?: boolean
    api_stages: ApiStage[]
    product_code: string
    quota_settings: any[]
    key_id: string
    key_type: string
    usage_plan_id: string
    aliases: any[]
    caller_reference: string
    comment?: any
    custom_error_response: any[]
    default_cache_behavior: DefaultCacheBehavior[]
    default_root_object: string
    domain_name: string
    etag: string
    hosted_zone_id: string
    http_version: string
    in_progress_validation_batches?: number
    is_ipv6_enabled?: boolean
    last_modified_time: string
    logging_config: any[]
    ordered_cache_behavior: OrderedCacheBehavior[]
    origin: Origin[]
    origin_group: any[]
    price_class: string
    restrictions: Restriction[]
    retain_on_delete?: boolean
    status: string
    trusted_signers: TrustedSigner[]
    viewer_certificate: ViewerCertificate[]
    wait_for_deployment?: boolean
    web_acl_id: string
    event_bus_name: string
    event_pattern?: any
    is_enabled?: boolean
    name_prefix: string
    role_arn: string
    schedule_expression: string
    batch_target: any[]
    ecs_target: any[]
    input: string
    input_path: string
    input_transformer: any[]
    kinesis_target: any[]
    rule: string
    run_command_targets: any[]
    sqs_target: any[]
    target_id: string
    kms_key_id: string
    retention_in_days?: number
    attribute: Attribute[]
    billing_mode: string
    global_secondary_index: any[]
    hash_key: string
    local_secondary_index: any[]
    point_in_time_recovery: PointInTimeRecovery[]
    range_key?: any
    read_capacity?: number
    replica: any[]
    server_side_encryption: any
    stream_arn: string
    stream_enabled?: boolean
    stream_label: string
    stream_view_type: string
    timeouts?: any
    ttl: Ttl[]
    write_capacity?: number
    assume_role_policy: string
    create_date?: Date
    force_detach_policies?: boolean
    max_session_duration?: number
    permissions_boundary?: any
    unique_id: string
    policy_arn: string
    role: string
    batch_size?: number
    bisect_batch_on_function_error?: boolean
    destination_config: any[]
    event_source_arn: string
    function_arn: string
    function_name: string
    last_modified?: Date
    last_processing_result: string
    maximum_batching_window_in_seconds?: number
    maximum_record_age_in_seconds?: number
    maximum_retry_attempts?: number
    parallelization_factor?: number
    starting_position?: any
    starting_position_timestamp?: any
    state: string
    state_transition_reason: string
    uuid: string
    code_signing_config_arn: string
    dead_letter_config: any[]
    environment: Environment[]
    file_system_config: any[]
    filename: string
    handler: string
    image_config: any[]
    image_uri: string
    invoke_arn: string
    kms_key_arn: string
    layers: any[]
    memory_size?: number
    package_type: string
    publish?: boolean
    qualified_arn: string
    reserved_concurrent_executions?: number
    runtime: string
    s3_bucket?: any
    s3_key?: any
    s3_object_version?: any
    signing_job_arn: string
    signing_profile_version_arn: string
    source_code_hash: string
    source_code_size?: number
    timeout?: number
    tracing_config: TracingConfig[]
    version: string
    vpc_config: any[]
    action: string
    event_source_token?: any
    principal: string
    qualifier: string
    source_account?: any
    source_arn: string
    statement_id: string
    statement_id_prefix?: any
    acceleration_status: string
    acl: string
    bucket: string
    bucket_domain_name: string
    bucket_prefix?: any
    bucket_regional_domain_name: string
    cors_rule: any[]
    force_destroy?: boolean
    grant: any[]
    lifecycle_rule: any[]
    logging: any[]
    object_lock_configuration: any[]
    region: string
    replication_configuration: any[]
    request_payer: string
    server_side_encryption_configuration: any[]
    versioning: Versioning[]
    website: any[]
    website_domain?: any
    website_endpoint?: any
    lambda_function: LambdaFunction[]
    queue: any[]
    topic: any[]
    cache_control: string
    content: string
    content_base64: string
    content_disposition: string
    content_encoding: string
    content_language: string
    content_type: string
    key: string
    metadata: Metadata
    object_lock_legal_hold_status: string
    object_lock_mode: string
    object_lock_retain_until_date: string
    source: any
    storage_class: string
    version_id: string
    website_redirect: string
    recovery_window_in_days?: number
    rotation_enabled?: boolean
    rotation_lambda_arn: string
    rotation_rules: any[]
    secret_binary: string
    secret_id: string
    secret_string: string
    version_stages: string[]
    creation_date?: Date
    definition: string
    event_delivery_failure_topic_arn?: any
    event_endpoint_created_topic_arn?: any
    event_endpoint_deleted_topic_arn?: any
    event_endpoint_updated_topic_arn?: any
    failure_feedback_role_arn: string
    platform: string
    platform_credential: string
    platform_principal: string
    success_feedback_role_arn: string
    success_feedback_sample_rate?: any
    application_failure_feedback_role_arn: string
    application_success_feedback_role_arn: string
    application_success_feedback_sample_rate?: any
    delivery_policy: string
    display_name: string
    http_failure_feedback_role_arn: string
    http_success_feedback_role_arn: string
    http_success_feedback_sample_rate?: any
    kms_master_key_id: string
    lambda_failure_feedback_role_arn: string
    lambda_success_feedback_role_arn: string
    lambda_success_feedback_sample_rate?: any
    sqs_failure_feedback_role_arn: string
    sqs_success_feedback_role_arn: string
    sqs_success_feedback_sample_rate?: any
    content_based_deduplication?: boolean
    delay_seconds?: number
    fifo_queue?: boolean
    kms_data_key_reuse_period_seconds?: number
    max_message_size?: number
    message_retention_seconds?: number
    receive_wait_time_seconds?: number
    redrive_policy: string
    visibility_timeout_seconds?: number
    excludes?: any
    output_base64sha256: string
    output_md5: string
    output_path: string
    output_sha: string
    output_size?: number
    source_content?: any
    source_content_filename?: any
    source_dir?: any
    source_file: string
    account_id: string
    user_id: string
    json: string
    override_json?: any
    policy_id?: any
    source_json?: any
    statement: Statement[]
    endpoint: string
    request_headers?: any
    response_headers: ResponseHeaders
    url: string
    keepers?: any
    length?: number
    lower?: boolean
    min_lower?: number
    min_numeric?: number
    min_special?: number
    min_upper?: number
    number?: boolean
    override_special?: any
    result: string
    special?: boolean
    upper?: boolean
  }

  export interface Resource {
    comment: string
    address: string
    mode: string
    type: string
    name: string
    provider_name: string
    schema_version: number
    values: Values2
    depends_on: string[]
    index?: number
  }

  export interface RootModule {
    resources: Resource[]
  }

  export interface Values {
    outputs: Outputs
    root_module: RootModule
  }

  export interface RootObject {
    format_version: string
    terraform_version: string
    values: Values
  }
}
