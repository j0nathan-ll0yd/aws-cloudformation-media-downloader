// @ts-nocheck
// To parse this data:
//
//   import { Convert, InfrastructureD } from "./file";
//
//   const infrastructureD = Convert.toInfrastructureD(json);
//
// These functions will throw an error if the JSON doesn't
// match the expected interface, even if the JSON is valid.

export interface InfrastructureD {
    data:      Data;
    locals:    Local[];
    output:    Output;
    provider:  Provider;
    resource:  Resource;
    terraform: Terraform[];
    variable:  Variable;
}

export interface Data {
    archive_file:            { [key: string]: ArchiveFile[] };
    aws_caller_identity:     Aws;
    aws_iam_policy_document: AwsIamPolicyDocument;
    aws_lambda_invocation:   AwsLambdaInvocation;
    aws_region:              Aws;
    http:                    HTTP;
    local_file:              LocalFile;
    sops_file:               SopsFile;
}

export interface ArchiveFile {
    output_path: string;
    source_dir:  string;
    type:        Type;
    depends_on?: string[];
}

export enum Type {
    Zip = "zip",
}

export interface Aws {
    current: Current[];
}

export interface Current {
}

export interface AwsIamPolicyDocument {
    ApiGatewayAuthorizer:           APIGatewayAuthorizerInvocationElement[];
    ApiGatewayAuthorizerInvocation: APIGatewayAuthorizerInvocationElement[];
    ApiGatewayCloudwatch:           APIGatewayCloudwatch[];
    CommonLambdaXRay:               APIGatewayAuthorizerInvocationElement[];
    LambdaAssumeRole:               AssumeRole[];
    LambdaGatewayAssumeRole:        AssumeRole[];
    LamdbaEdgeAssumeRole:           AssumeRole[];
    MultipartUpload:                MultipartUpload[];
    PruneDevices:                   PruneDevice[];
    RegisterDevice:                 RegisterDevice[];
    S3ObjectCreated:                APIGatewayAuthorizerInvocationElement[];
    SNSAssumeRole:                  AssumeRole[];
    SendPushNotification:           AwsIamPolicyDocumentSendPushNotification[];
    StatesAssumeRole:               AssumeRole[];
    UserDelete:                     PruneDevice[];
    UserSubscribe:                  RegisterDevice[];
    WebhookFeedly:                  APIGatewayAuthorizerInvocationElement[];
    codepipeline_e2e_assume_role:   AssumeRole[];
    codepipeline_e2e_device_farm:   CodepipelineE2EDeviceFarm[];
    codepipeline_e2e_s3_access:     CodepipelineE2EDeviceFarm[];
    dsql_access:                    CodepipelineE2EDeviceFarm[];
    dsql_admin_access:              CodepipelineE2EDeviceFarm[];
}

export interface APIGatewayAuthorizerInvocationElement {
    statement: Ent[];
}

export interface Ent {
    actions:   string[];
    resources: string[];
}

export interface APIGatewayCloudwatch {
    statement: APIGatewayCloudwatchStatement[];
}

export interface APIGatewayCloudwatchStatement {
    actions:    string[];
    effect:     string;
    principals: PrincipalElement[];
}

export interface PrincipalElement {
    identifiers: string[];
    type:        string;
}

export interface AssumeRole {
    statement: LambdaAssumeRoleStatement[];
}

export interface LambdaAssumeRoleStatement {
    actions:    string[];
    principals: PrincipalElement[];
}

export interface MultipartUpload {
    statement: MultipartUploadStatement[];
}

export interface MultipartUploadStatement {
    actions:    string[];
    resources:  string[];
    condition?: Condition[];
}

export interface Condition {
    test:     string;
    values:   string[];
    variable: string;
}

export interface PruneDevice {
    dynamic: PruneDeviceDynamic;
}

export interface PruneDeviceDynamic {
    statement: DynamicStatement[];
}

export interface DynamicStatement {
    content:  Ent[];
    for_each: string;
}

export interface RegisterDevice {
    statement: RegisterDeviceStatement[];
}

export interface RegisterDeviceStatement {
    actions:   string[];
    resources: string;
}

export interface AwsIamPolicyDocumentSendPushNotification {
    dynamic:   PruneDeviceDynamic;
    statement: Ent[];
}

export interface CodepipelineE2EDeviceFarm {
    statement: CodepipelineE2EDeviceFarmStatement[];
}

export interface CodepipelineE2EDeviceFarmStatement {
    actions:   string[];
    resources: string[];
    sid:       string;
}

export interface AwsLambdaInvocation {
    run_migration: RunMigration[];
}

export interface RunMigration {
    depends_on:    string[];
    function_name: string;
    input:         string;
}

export interface HTTP {
    icanhazip: Icanhazip[];
}

export interface Icanhazip {
    url: string;
}

export interface LocalFile {
    DefaultFile: LocalFileDefaultFile[];
}

export interface LocalFileDefaultFile {
    filename: string;
}

export interface SopsFile {
    secrets: Secret[];
}

export interface Secret {
    source_file: string;
}

export interface Local {
    api_gateway_authorizer_function_name?:  string;
    cleanup_expired_records_function_name?: string;
    lambda_functions?:                      string[];
    lambda_functions_api?:                  string[];
    lambda_functions_background?:           string[];
    device_event_function_name?:            string;
    e2e_test_project_name?:                 string;
    download_queue_name?:                   string;
    download_queue_visibility_timeout?:     number;
    event_bus_name?:                        string;
    start_file_upload_function_name?:       string;
    webhook_feedly_function_name?:          string;
    s3_object_created_function_name?:       string;
    list_files_function_name?:              string;
    login_user_function_name?:              string;
    adot_layer_arn?:                        string;
    adot_layer_arn_x86_64?:                 string;
    common_lambda_env?:                     CommonLambdaEnv;
    common_tags?:                           CommonTags;
    lambda_architecture?:                   string;
    migrate_dsql_function_name?:            string;
    prune_devices_function_name?:           string;
    refresh_token_function_name?:           string;
    register_device_function_name?:         string;
    register_user_function_name?:           string;
    send_push_notification_function_name?:  string;
    user_delete_function_name?:             string;
    user_subscribe_function_name?:          string;
}

export interface CommonLambdaEnv {
    DSQL_CLUSTER_ENDPOINT:              string;
    DSQL_REGION:                        string;
    LOG_LEVEL:                          string;
    NODE_OPTIONS:                       string;
    OPENTELEMETRY_COLLECTOR_CONFIG_URI: string;
    OPENTELEMETRY_EXTENSION_LOG_LEVEL:  string;
}

export interface CommonTags {
    Environment: string;
    ManagedBy:   string;
    Project:     string;
}

export interface Output {
    api_gateway_api_key:            APIGatewayAPIKey[];
    api_gateway_stage:              APIGatewayStage[];
    api_gateway_subdomain:          APIGatewayStage[];
    cloudfront_distribution_domain: APIGatewayStage[];
    cloudfront_media_files_domain:  APIGatewayStage[];
    cloudwatch_dashboard_url:       APIGatewayStage[];
    codepipeline_e2e_arn:           APIGatewayStage[];
    codepipeline_e2e_console_url:   APIGatewayStage[];
    device_farm_device_pool_arn:    APIGatewayStage[];
    device_farm_project_arn:        APIGatewayStage[];
    device_farm_project_id:         APIGatewayStage[];
    download_queue_arn:             APIGatewayStage[];
    download_queue_url:             APIGatewayStage[];
    dsql_cluster_arn:               APIGatewayStage[];
    dsql_cluster_endpoint:          APIGatewayStage[];
    e2e_test_artifacts_bucket:      APIGatewayStage[];
    event_bus_arn:                  APIGatewayStage[];
    event_bus_name:                 APIGatewayStage[];
    idempotency_table_arn:          APIGatewayStage[];
    idempotency_table_name:         APIGatewayStage[];
    migration_result:               APIGatewayStage[];
    public_ip:                      APIGatewayStage[];
}

export interface APIGatewayAPIKey {
    description: string;
    sensitive:   boolean;
    value:       string;
}

export interface APIGatewayStage {
    description: string;
    value:       string;
}

export interface Provider {
    aws: Aw[];
}

export interface Aw {
    alias?:   string;
    region:   string;
    profile?: string;
}

export interface Resource {
    aws_api_gateway_account:                         AwsAPIGatewayAccount;
    aws_api_gateway_api_key:                         AwsAPIGatewayAPIKey;
    aws_api_gateway_authorizer:                      AwsAPIGatewayAuthorizer;
    aws_api_gateway_deployment:                      AwsAPIGatewayDeployment;
    aws_api_gateway_gateway_response:                AwsAPIGatewayGatewayResponse;
    aws_api_gateway_integration:                     AwsAPIGatewayIntegration;
    aws_api_gateway_method:                          AwsAPIGatewayMethod;
    aws_api_gateway_method_settings:                 AwsAPIGatewayMethodSettings;
    aws_api_gateway_resource:                        AwsAPIGatewayResource;
    aws_api_gateway_rest_api:                        AwsAPIGatewayRESTAPI;
    aws_api_gateway_stage:                           AwsAPIGatewayStage;
    aws_api_gateway_usage_plan:                      AwsAPIGatewayUsagePlan;
    aws_api_gateway_usage_plan_key:                  AwsAPIGatewayUsagePlanKey;
    aws_budgets_budget:                              AwsBudgetsBudget;
    aws_cloudfront_distribution:                     AwsCloudfrontDistribution;
    aws_cloudfront_origin_access_control:            AwsCloudfrontOriginAccessControl;
    aws_cloudwatch_dashboard:                        AwsCloudwatchDashboard;
    aws_cloudwatch_event_bus:                        AwsCloudwatchEventBus;
    aws_cloudwatch_event_rule:                       AwsCloudwatchEventRule;
    aws_cloudwatch_event_target:                     AwsCloudwatchEventTarget;
    aws_cloudwatch_log_group:                        { [key: string]: AwsCloudwatchLogGroup[] };
    aws_cloudwatch_metric_alarm:                     AwsCloudwatchMetricAlarm;
    aws_codepipeline:                                AwsCodepipeline;
    aws_devicefarm_device_pool:                      AwsDevicefarmDevicePool;
    aws_devicefarm_project:                          AwsDevicefarmProject;
    aws_dsql_cluster:                                AwsDsqlCluster;
    aws_dynamodb_table:                              AwsDynamodbTable;
    aws_iam_policy:                                  { [key: string]: AwsIamPolicy[] };
    aws_iam_role:                                    { [key: string]: AwsIamRole[] };
    aws_iam_role_policy:                             { [key: string]: AwsIamRolePolicy[] };
    aws_iam_role_policy_attachment:                  { [key: string]: AwsIamRolePolicyAttachment[] };
    aws_lambda_event_source_mapping:                 AwsLambdaEventSourceMapping;
    aws_lambda_function:                             AwsLambdaFunction;
    aws_lambda_layer_version:                        AwsLambdaLayerVersion;
    aws_lambda_permission:                           { [key: string]: AwsLambdaPermission[] };
    aws_s3_bucket:                                   AwsS3Bucket;
    aws_s3_bucket_intelligent_tiering_configuration: AwsS3BucketIntelligentTieringConfiguration;
    aws_s3_bucket_lifecycle_configuration:           AwsS3BucketLifecycleConfiguration;
    aws_s3_bucket_notification:                      AwsS3BucketNotification;
    aws_s3_bucket_policy:                            AwsS3BucketPolicy;
    aws_s3_bucket_public_access_block:               AwsS3BucketPublicAccessBlock;
    aws_s3_bucket_versioning:                        AwsS3BucketVersioning;
    aws_s3_object:                                   AwsS3Object;
    aws_sns_platform_application:                    AwsSnsPlatformApplication;
    aws_sns_topic:                                   AwsSnsTopic;
    aws_sqs_queue:                                   AwsSqsQueue;
    aws_sqs_queue_policy:                            AwsSqsQueuePolicy;
    null_resource:                                   NullResource;
    time_sleep:                                      TimeSleep;
}

export interface AwsAPIGatewayAccount {
    Main: AwsAPIGatewayAccountMain[];
}

export interface AwsAPIGatewayAccountMain {
    cloudwatch_role_arn: string;
}

export interface AwsAPIGatewayAPIKey {
    iOSApp: IOSApp[];
}

export interface IOSApp {
    description?:         string;
    enabled?:             boolean;
    name:                 string;
    tags:                 Tags;
    schedule_expression?: string;
    state?:               string;
}

export enum Tags {
    LocalCommonTags = "${local.common_tags}",
}

export interface AwsAPIGatewayAuthorizer {
    ApiGatewayAuthorizer: APIGatewayAuthorizer[];
}

export interface APIGatewayAuthorizer {
    authorizer_credentials:           string;
    authorizer_result_ttl_in_seconds: number;
    authorizer_uri:                   string;
    identity_source:                  string;
    name:                             string;
    rest_api_id:                      APIID;
    type:                             string;
}

export enum APIID {
    AwsAPIGatewayRESTAPIMainID = "${aws_api_gateway_rest_api.Main.id}",
}

export interface AwsAPIGatewayDeployment {
    Main: AwsAPIGatewayDeploymentMain[];
}

export interface AwsAPIGatewayDeploymentMain {
    depends_on:  string[];
    lifecycle:   Lifecycle[];
    rest_api_id: APIID;
    triggers:    MainTriggers;
}

export interface Lifecycle {
    create_before_destroy: boolean;
}

export interface MainTriggers {
    redeployment: string;
}

export interface AwsAPIGatewayGatewayResponse {
    Default400GatewayResponse: Default00GatewayResponse[];
    Default500GatewayResponse: Default00GatewayResponse[];
}

export interface Default00GatewayResponse {
    response_parameters: ResponseParameters;
    response_templates:  ResponseTemplates;
    response_type:       string;
    rest_api_id:         APIID;
}

export interface ResponseParameters {
    "gatewayresponse.header.Cache-Control":          string;
    "gatewayresponse.header.X-Content-Type-Options": string;
    "gatewayresponse.header.X-Frame-Options":        string;
    "gatewayresponse.header.X-XSS-Protection":       string;
}

export interface ResponseTemplates {
    "application/json": string;
}

export interface AwsAPIGatewayIntegration {
    DeviceEventPost:    AwsAPIGatewayIntegrationDeviceEventPost[];
    ListFilesGet:       AwsAPIGatewayIntegrationDeviceEventPost[];
    LoginUserPost:      AwsAPIGatewayIntegrationDeviceEventPost[];
    RefreshTokenPost:   AwsAPIGatewayIntegrationDeviceEventPost[];
    RegisterDevicePost: AwsAPIGatewayIntegrationDeviceEventPost[];
    RegisterUserPost:   AwsAPIGatewayIntegrationDeviceEventPost[];
    UserDelete:         AwsAPIGatewayIntegrationDeviceEventPost[];
    UserSubscribePost:  AwsAPIGatewayIntegrationDeviceEventPost[];
    WebhookFeedlyPost:  AwsAPIGatewayIntegrationDeviceEventPost[];
}

export interface AwsAPIGatewayIntegrationDeviceEventPost {
    http_method:             string;
    integration_http_method: string;
    resource_id:             string;
    rest_api_id:             APIID;
    type:                    string;
    uri:                     string;
}

export interface AwsAPIGatewayMethod {
    DeviceEventPost:    AwsAPIGatewayMethodDeviceEventPost[];
    ListFilesGet:       AwsAPIGatewayMethodDeviceEventPost[];
    LoginUserPost:      AwsAPIGatewayMethodDeviceEventPost[];
    RefreshTokenPost:   AwsAPIGatewayMethodDeviceEventPost[];
    RegisterDevicePost: AwsAPIGatewayMethodDeviceEventPost[];
    RegisterUserPost:   AwsAPIGatewayMethodDeviceEventPost[];
    UserDelete:         AwsAPIGatewayMethodDeviceEventPost[];
    UserSubscribePost:  AwsAPIGatewayMethodDeviceEventPost[];
    WebhookFeedlyPost:  AwsAPIGatewayMethodDeviceEventPost[];
}

export interface AwsAPIGatewayMethodDeviceEventPost {
    api_key_required: boolean;
    authorization:    string;
    http_method:      string;
    resource_id:      string;
    rest_api_id:      APIID;
    authorizer_id?:   string;
}

export interface AwsAPIGatewayMethodSettings {
    Production: AwsAPIGatewayMethodSettingsProduction[];
}

export interface AwsAPIGatewayMethodSettingsProduction {
    method_path: string;
    rest_api_id: APIID;
    settings:    Setting[];
    stage_name:  string;
}

export interface Setting {
    data_trace_enabled: boolean;
    logging_level:      string;
    metrics_enabled:    boolean;
}

export interface AwsAPIGatewayResource {
    Device:         Device[];
    DeviceEvent:    Device[];
    DeviceRegister: Device[];
    Feedly:         Device[];
    Files:          Device[];
    User:           Device[];
    UserLogin:      Device[];
    UserRefresh:    Device[];
    UserRegister:   Device[];
    UserSubscribe:  Device[];
}

export interface Device {
    parent_id:   ParentID;
    path_part:   string;
    rest_api_id: APIID;
}

export enum ParentID {
    AwsAPIGatewayRESTAPIMainRootResourceID = "${aws_api_gateway_rest_api.Main.root_resource_id}",
    AwsAPIGatewayResourceDeviceID = "${aws_api_gateway_resource.Device.id}",
    AwsAPIGatewayResourceUserID = "${aws_api_gateway_resource.User.id}",
}

export interface AwsAPIGatewayRESTAPI {
    Main: AwsAPIGatewayRESTAPIMain[];
}

export interface AwsAPIGatewayRESTAPIMain {
    api_key_source:         string;
    description:            string;
    endpoint_configuration: EndpointConfiguration[];
    name:                   string;
    tags:                   Tags;
}

export interface EndpointConfiguration {
    types: string[];
}

export interface AwsAPIGatewayStage {
    Production: AwsAPIGatewayStageProduction[];
}

export interface AwsAPIGatewayStageProduction {
    deployment_id:        string;
    rest_api_id:          APIID;
    stage_name:           string;
    tags:                 Tags;
    xray_tracing_enabled: boolean;
}

export interface AwsAPIGatewayUsagePlan {
    iOSApp: AwsAPIGatewayUsagePlanIOSApp[];
}

export interface AwsAPIGatewayUsagePlanIOSApp {
    api_stages:        APIStage[];
    description:       string;
    name:              string;
    quota_settings:    QuotaSetting[];
    throttle_settings: ThrottleSetting[];
}

export interface APIStage {
    api_id: APIID;
    stage:  string;
}

export interface QuotaSetting {
    limit:  number;
    period: string;
}

export interface ThrottleSetting {
    burst_limit: number;
    rate_limit:  number;
}

export interface AwsAPIGatewayUsagePlanKey {
    iOSApp: AwsAPIGatewayUsagePlanKeyIOSApp[];
}

export interface AwsAPIGatewayUsagePlanKeyIOSApp {
    key_id:        string;
    key_type:      string;
    usage_plan_id: string;
}

export interface AwsBudgetsBudget {
    device_farm: DeviceFarm[];
}

export interface DeviceFarm {
    budget_type:       string;
    cost_filter:       CostFilter[];
    count:             string;
    limit_amount:      string;
    limit_unit:        string;
    name:              string;
    notification:      Notification[];
    tags:              string;
    time_period_start: string;
    time_unit:         string;
}

export interface CostFilter {
    name:   string;
    values: string[];
}

export interface Notification {
    comparison_operator:        string;
    notification_type:          string;
    subscriber_email_addresses: string[];
    threshold:                  number;
    threshold_type:             string;
}

export interface AwsCloudfrontDistribution {
    MediaFiles: MediaFile[];
    Production: AwsCloudfrontDistributionProduction[];
}

export interface MediaFile {
    default_cache_behavior: MediaFileDefaultCacheBehavior[];
    default_root_object:    string;
    enabled:                boolean;
    origin:                 MediaFileOrigin[];
    price_class:            string;
    restrictions:           Restriction[];
    tags:                   string;
    viewer_certificate:     ViewerCertificate[];
}

export interface MediaFileDefaultCacheBehavior {
    allowed_methods:        string[];
    cached_methods:         string[];
    default_ttl:            number;
    forwarded_values:       PurpleForwardedValue[];
    max_ttl:                number;
    min_ttl:                number;
    target_origin_id:       string;
    viewer_protocol_policy: string;
}

export interface PurpleForwardedValue {
    cookies:      Cooky[];
    query_string: boolean;
}

export interface Cooky {
    forward: string;
}

export interface MediaFileOrigin {
    domain_name:              string;
    origin_access_control_id: string;
    origin_id:                string;
}

export interface Restriction {
    geo_restriction: GeoRestriction[];
}

export interface GeoRestriction {
    locations:        string[];
    restriction_type: string;
}

export interface ViewerCertificate {
    cloudfront_default_certificate: boolean;
}

export interface AwsCloudfrontDistributionProduction {
    comment:                string;
    default_cache_behavior: ProductionDefaultCacheBehavior[];
    enabled:                boolean;
    origin:                 ProductionOrigin[];
    restrictions:           Restriction[];
    tags:                   string;
    viewer_certificate:     ViewerCertificate[];
}

export interface ProductionDefaultCacheBehavior {
    allowed_methods:             string[];
    cached_methods:              string[];
    default_ttl:                 number;
    forwarded_values:            FluffyForwardedValue[];
    lambda_function_association: LambdaFunctionAssociation[];
    max_ttl:                     number;
    min_ttl:                     number;
    target_origin_id:            string;
    viewer_protocol_policy:      string;
}

export interface FluffyForwardedValue {
    cookies:      Cooky[];
    headers:      string[];
    query_string: boolean;
}

export interface LambdaFunctionAssociation {
    event_type: string;
    lambda_arn: string;
}

export interface ProductionOrigin {
    custom_origin_config: CustomOriginConfig[];
    domain_name:          string;
    origin_id:            string;
    origin_path:          string;
}

export interface CustomOriginConfig {
    http_port:              number;
    https_port:             number;
    origin_protocol_policy: string;
    origin_ssl_protocols:   string[];
}

export interface AwsCloudfrontOriginAccessControl {
    MediaFilesOAC: MediaFilesOAC[];
}

export interface MediaFilesOAC {
    description:                       string;
    name:                              string;
    origin_access_control_origin_type: string;
    signing_behavior:                  string;
    signing_protocol:                  string;
}

export interface AwsCloudwatchDashboard {
    Main: AwsCloudwatchDashboardMain[];
}

export interface AwsCloudwatchDashboardMain {
    dashboard_body: string;
    dashboard_name: string;
}

export interface AwsCloudwatchEventBus {
    MediaDownloader: MediaDownloader[];
}

export interface MediaDownloader {
    name: string;
    tags: string;
}

export interface AwsCloudwatchEventRule {
    CleanupExpiredRecords: IOSApp[];
    DownloadRequested:     DownloadRequested[];
    PruneDevices:          IOSApp[];
}

export interface DownloadRequested {
    description:    string;
    event_bus_name: string;
    event_pattern:  string;
    name:           string;
}

export interface AwsCloudwatchEventTarget {
    CleanupExpiredRecords:  CleanupExpiredRecord[];
    DownloadRequestedToSQS: DownloadRequestedToSQ[];
    PruneDevices:           CleanupExpiredRecord[];
}

export interface CleanupExpiredRecord {
    arn:  string;
    rule: string;
}

export interface DownloadRequestedToSQ {
    arn:               string;
    event_bus_name:    string;
    input_transformer: InputTransformer[];
    rule:              string;
    target_id:         string;
}

export interface InputTransformer {
    input_paths:    InputPaths;
    input_template: string;
}

export interface InputPaths {
    correlationId: string;
    fileId:        string;
    sourceUrl:     string;
    userId:        string;
}

export interface AwsCloudwatchLogGroup {
    name:              string;
    retention_in_days: number;
    tags:              Tags;
}

export interface AwsCloudwatchMetricAlarm {
    DownloadDLQMessages:          Age[];
    EventBridgeFailedInvocations: EventBridge[];
    EventBridgeThrottled:         EventBridge[];
    LambdaErrorsApi:              Lambda[];
    LambdaErrorsBackground:       Lambda[];
    LambdaThrottlesApi:           Lambda[];
    LambdaThrottlesBackground:    Lambda[];
    SqsDlqMessages:               Age[];
    SqsQueueAge:                  Age[];
}

export interface Age {
    alarm_description:   string;
    alarm_name:          string;
    comparison_operator: string;
    dimensions:          DownloadDLQMessageDimensions;
    evaluation_periods:  number;
    metric_name:         string;
    namespace:           string;
    period:              number;
    statistic:           string;
    threshold:           number;
    treat_missing_data:  string;
}

export interface DownloadDLQMessageDimensions {
    QueueName: string;
}

export interface EventBridge {
    alarm_description:   string;
    alarm_name:          string;
    comparison_operator: string;
    dimensions:          EventBridgeFailedInvocationDimensions;
    evaluation_periods:  number;
    metric_name:         string;
    namespace:           string;
    period:              number;
    statistic:           string;
    threshold:           number;
    treat_missing_data:  string;
}

export interface EventBridgeFailedInvocationDimensions {
    RuleName: string;
}

export interface Lambda {
    alarm_description:   string;
    alarm_name:          string;
    comparison_operator: string;
    dynamic:             LambdaErrorsAPIDynamic;
    evaluation_periods:  number;
    metric_query:        LambdaErrorsAPIMetricQuery[];
    threshold:           number;
    treat_missing_data:  string;
}

export interface LambdaErrorsAPIDynamic {
    metric_query: DynamicMetricQuery[];
}

export interface DynamicMetricQuery {
    content:  Content[];
    for_each: string;
}

export interface Content {
    id:     string;
    metric: Metric[];
}

export interface Metric {
    dimensions:  MetricDimensions;
    metric_name: string;
    namespace:   string;
    period:      number;
    stat:        string;
}

export interface MetricDimensions {
    FunctionName: string;
}

export interface LambdaErrorsAPIMetricQuery {
    expression:  string;
    id:          string;
    label:       string;
    return_data: boolean;
}

export interface AwsCodepipeline {
    ios_e2e_tests: AwsCodepipelineIosE2ETest[];
}

export interface AwsCodepipelineIosE2ETest {
    artifact_store: ArtifactStore[];
    name:           string;
    pipeline_type:  string;
    role_arn:       string;
    stage:          Stage[];
    tags:           string;
}

export interface ArtifactStore {
    location: string;
    type:     string;
}

export interface Stage {
    action: ActionElement[];
    name:   string;
}

export interface ActionElement {
    category:          string;
    configuration:     Configuration;
    name:              string;
    output_artifacts?: string[];
    owner:             string;
    provider:          string;
    version:           string;
    input_artifacts?:  string[];
}

export interface Configuration {
    PollForSourceChanges?: string;
    S3Bucket?:             string;
    S3ObjectKey?:          string;
    CustomData?:           string;
    ExternalEntityLink?:   string;
    App?:                  string;
    AppType?:              string;
    DevicePoolArn?:        string;
    ProjectId?:            string;
    Test?:                 string;
    TestType?:             string;
}

export interface AwsDevicefarmDevicePool {
    latest_iphone: LatestIphone[];
}

export interface LatestIphone {
    description: string;
    max_devices: number;
    name:        string;
    project_arn: string;
    rule:        LatestIphoneRule[];
    tags:        Tags;
}

export interface LatestIphoneRule {
    attribute: string;
    operator:  string;
    value:     string;
}

export interface AwsDevicefarmProject {
    ios_e2e_tests: AwsDevicefarmProjectIosE2ETest[];
}

export interface AwsDevicefarmProjectIosE2ETest {
    default_job_timeout_minutes: number;
    name:                        string;
    tags:                        string;
}

export interface AwsDsqlCluster {
    media_downloader: MediaDownloaderElement[];
}

export interface MediaDownloaderElement {
    deletion_protection_enabled: boolean;
    tags:                        string;
}

export interface AwsDynamodbTable {
    IdempotencyTable: IdempotencyTable[];
}

export interface IdempotencyTable {
    attribute:    Attribute[];
    billing_mode: string;
    hash_key:     string;
    name:         string;
    tags:         string;
    ttl:          TTL[];
}

export interface Attribute {
    name: string;
    type: string;
}

export interface TTL {
    attribute_name: string;
    enabled:        boolean;
}

export interface AwsIamPolicy {
    name:         string;
    policy:       string;
    tags:         Tags;
    description?: string;
}

export interface AwsIamRole {
    assume_role_policy: string;
    name:               string;
    tags:               Tags;
}

export interface AwsIamRolePolicy {
    name:   string;
    policy: string;
    role:   string;
}

export interface AwsIamRolePolicyAttachment {
    policy_arn: string;
    role:       string;
}

export interface AwsLambdaEventSourceMapping {
    SendPushNotification: SendPushNotification[];
    StartFileUploadSQS:   SendPushNotification[];
}

export interface SendPushNotification {
    event_source_arn:        string;
    function_name:           string;
    function_response_types: string[];
    batch_size?:             number;
}

export interface AwsLambdaFunction {
    ApiGatewayAuthorizer:  CleanupExpiredRecordElement[];
    CleanupExpiredRecords: CleanupExpiredRecordElement[];
    CloudfrontMiddleware:  CloudfrontMiddleware[];
    DeviceEvent:           CleanupExpiredRecordElement[];
    ListFiles:             CleanupExpiredRecordElement[];
    LoginUser:             CleanupExpiredRecordElement[];
    MigrateDSQL:           CleanupExpiredRecordElement[];
    PruneDevices:          CleanupExpiredRecordElement[];
    RefreshToken:          CleanupExpiredRecordElement[];
    RegisterDevice:        CleanupExpiredRecordElement[];
    RegisterUser:          CleanupExpiredRecordElement[];
    S3ObjectCreated:       CleanupExpiredRecordElement[];
    SendPushNotification:  CleanupExpiredRecordElement[];
    StartFileUpload:       CleanupExpiredRecordElement[];
    UserDelete:            CleanupExpiredRecordElement[];
    UserSubscribe:         CleanupExpiredRecordElement[];
    WebhookFeedly:         CleanupExpiredRecordElement[];
}

export interface CleanupExpiredRecordElement {
    architectures:                   Architecture[];
    depends_on:                      string[];
    description:                     string;
    environment:                     Environment[];
    filename:                        string;
    function_name:                   string;
    handler:                         Handler;
    layers:                          Layer[];
    role:                            string;
    runtime:                         Runtime;
    source_code_hash:                string;
    tags:                            string;
    timeout?:                        number;
    tracing_config:                  TracingConfig[];
    memory_size?:                    number;
    ephemeral_storage?:              EphemeralStorage[];
    reserved_concurrent_executions?: number;
}

export enum Architecture {
    LocalLambdaArchitecture = "${local.lambda_architecture}",
    X8664 = "x86_64",
}

export interface Environment {
    variables: string;
}

export interface EphemeralStorage {
    size: number;
}

export enum Handler {
    IndexHandler = "index.handler",
}

export enum Layer {
    AwsLambdaLayerVersionFfmpegArn = "${aws_lambda_layer_version.Ffmpeg.arn}",
    AwsLambdaLayerVersionYtDLPArn = "${aws_lambda_layer_version.YtDlp.arn}",
    LocalAdotLayerArn = "${local.adot_layer_arn}",
    LocalAdotLayerArnX8664 = "${local.adot_layer_arn_x86_64}",
}

export enum Runtime {
    Nodejs24X = "nodejs24.x",
}

export interface TracingConfig {
    mode: Mode;
}

export enum Mode {
    Active = "Active",
}

export interface CloudfrontMiddleware {
    description:      string;
    filename:         string;
    function_name:    string;
    handler:          Handler;
    provider:         string;
    publish:          boolean;
    role:             string;
    runtime:          Runtime;
    source_code_hash: string;
    tags:             string;
    tracing_config:   TracingConfig[];
}

export interface AwsLambdaLayerVersion {
    Ffmpeg: Ffmpeg[];
    YtDlp:  Ffmpeg[];
}

export interface Ffmpeg {
    compatible_runtimes: Runtime[];
    description:         string;
    filename:            string;
    layer_name:          string;
    source_code_hash:    string;
}

export interface AwsLambdaPermission {
    action:        ActionEnum;
    function_name: string;
    principal:     PrincipalEnum;
    source_arn?:   string;
}

export enum ActionEnum {
    LambdaInvokeFunction = "lambda:InvokeFunction",
}

export enum PrincipalEnum {
    ApigatewayAmazonawsCOM = "apigateway.amazonaws.com",
    EventsAmazonawsCOM = "events.amazonaws.com",
    S3AmazonawsCOM = "s3.amazonaws.com",
}

export interface AwsS3Bucket {
    Files:              File[];
    e2e_test_artifacts: File[];
}

export interface File {
    bucket: string;
    tags:   string;
}

export interface AwsS3BucketIntelligentTieringConfiguration {
    FilesTiering: FilesTiering[];
}

export interface FilesTiering {
    bucket:  string;
    name:    string;
    tiering: Tiering[];
}

export interface Tiering {
    access_tier: string;
    days:        number;
}

export interface AwsS3BucketLifecycleConfiguration {
    e2e_test_artifacts: AwsS3BucketLifecycleConfigurationE2ETestArtifact[];
}

export interface AwsS3BucketLifecycleConfigurationE2ETestArtifact {
    bucket: string;
    rule:   E2ETestArtifactRule[];
}

export interface E2ETestArtifactRule {
    expiration:                     Expiration[];
    filter:                         Filter[];
    id:                             string;
    noncurrent_version_expiration?: NoncurrentVersionExpiration[];
    status:                         string;
}

export interface Expiration {
    days: number;
}

export interface Filter {
    prefix: string;
}

export interface NoncurrentVersionExpiration {
    noncurrent_days: number;
}

export interface AwsS3BucketNotification {
    Files: AwsS3BucketNotificationFile[];
}

export interface AwsS3BucketNotificationFile {
    bucket:          string;
    lambda_function: LambdaFunction[];
}

export interface LambdaFunction {
    events:              string[];
    lambda_function_arn: string;
}

export interface AwsS3BucketPolicy {
    CloudfrontAccess: CloudfrontAccess[];
}

export interface CloudfrontAccess {
    bucket: string;
    policy: string;
}

export interface AwsS3BucketPublicAccessBlock {
    e2e_test_artifacts: AwsS3BucketPublicAccessBlockE2ETestArtifact[];
}

export interface AwsS3BucketPublicAccessBlockE2ETestArtifact {
    block_public_acls:       boolean;
    block_public_policy:     boolean;
    bucket:                  string;
    ignore_public_acls:      boolean;
    restrict_public_buckets: boolean;
}

export interface AwsS3BucketVersioning {
    e2e_test_artifacts: AwsS3BucketVersioningE2ETestArtifact[];
}

export interface AwsS3BucketVersioningE2ETestArtifact {
    bucket:                   string;
    versioning_configuration: VersioningConfiguration[];
}

export interface VersioningConfiguration {
    status: string;
}

export interface AwsS3Object {
    DefaultFile: AwsS3ObjectDefaultFile[];
}

export interface AwsS3ObjectDefaultFile {
    acl:          string;
    bucket:       string;
    content_type: string;
    etag:         string;
    key:          string;
    source:       string;
}

export interface AwsSnsPlatformApplication {
    OfflineMediaDownloader: OfflineMediaDownloader[];
}

export interface OfflineMediaDownloader {
    count:                     number;
    failure_feedback_role_arn: string;
    name:                      string;
    platform:                  string;
    platform_credential:       string;
    platform_principal:        string;
    success_feedback_role_arn: string;
}

export interface AwsSnsTopic {
    PushNotifications: PushNotification[];
}

export interface PushNotification {
    name: string;
}

export interface AwsSqsQueue {
    DownloadDLQ:             Dlq[];
    DownloadQueue:           DownloadQueue[];
    SendPushNotification:    AwsSqsQueueSendPushNotification[];
    SendPushNotificationDLQ: Dlq[];
}

export interface Dlq {
    message_retention_seconds: number;
    name:                      string;
    tags:                      string;
}

export interface DownloadQueue {
    delay_seconds:              number;
    max_message_size:           number;
    message_retention_seconds:  number;
    name:                       string;
    receive_wait_time_seconds:  number;
    redrive_policy:             string;
    tags:                       string;
    visibility_timeout_seconds: string;
}

export interface AwsSqsQueueSendPushNotification {
    delay_seconds:              number;
    max_message_size:           number;
    message_retention_seconds:  number;
    name:                       string;
    receive_wait_time_seconds:  number;
    redrive_policy:             string;
    tags:                       Tags;
    visibility_timeout_seconds: number;
}

export interface AwsSqsQueuePolicy {
    DownloadQueueEventBridge: DownloadQueueEventBridge[];
}

export interface DownloadQueueEventBridge {
    policy:    string;
    queue_url: string;
}

export interface NullResource {
    DownloadFfmpegBinary: DownloadBinary[];
    DownloadYtDlpBinary:  DownloadBinary[];
}

export interface DownloadBinary {
    provisioner: Provisioner;
    triggers:    DownloadFfmpegBinaryTriggers;
}

export interface Provisioner {
    "local-exec": LocalExec[];
}

export interface LocalExec {
    command: string;
}

export interface DownloadFfmpegBinaryTriggers {
    version: string;
}

export interface TimeSleep {
    wait_for_dsql: WaitForDsql[];
}

export interface WaitForDsql {
    create_duration: string;
    depends_on:      string[];
}

export interface Terraform {
    required_providers: RequiredProvider[];
}

export interface RequiredProvider {
    aws:  AwsClass;
    http: AwsClass;
    sops: AwsClass;
}

export interface AwsClass {
    source:  string;
    version: string;
}

export interface Variable {
    budget_notification_email: BudgetNotificationEmail[];
}

export interface BudgetNotificationEmail {
    default:     string;
    description: string;
    type:        string;
}

// Converts JSON strings to/from your types
// and asserts the results of JSON.parse at runtime
export class Convert {
    public static toInfrastructureD(json: string): InfrastructureD {
        return cast(JSON.parse(json), r("InfrastructureD"));
    }

    public static infrastructureDToJson(value: InfrastructureD): string {
        return JSON.stringify(uncast(value, r("InfrastructureD")), null, 2);
    }
}

function invalidValue(typ: any, val: any, key: any, parent: any = ''): never {
    const prettyTyp = prettyTypeName(typ);
    const parentText = parent ? ` on ${parent}` : '';
    const keyText = key ? ` for key "${key}"` : '';
    throw Error(`Invalid value${keyText}${parentText}. Expected ${prettyTyp} but got ${JSON.stringify(val)}`);
}

function prettyTypeName(typ: any): string {
    if (Array.isArray(typ)) {
        if (typ.length === 2 && typ[0] === undefined) {
            return `an optional ${prettyTypeName(typ[1])}`;
        } else {
            return `one of [${typ.map(a => { return prettyTypeName(a); }).join(", ")}]`;
        }
    } else if (typeof typ === "object" && typ.literal !== undefined) {
        return typ.literal;
    } else {
        return typeof typ;
    }
}

function jsonToJSProps(typ: any): any {
    if (typ.jsonToJS === undefined) {
        const map: any = {};
        typ.props.forEach((p: any) => map[p.json] = { key: p.js, typ: p.typ });
        typ.jsonToJS = map;
    }
    return typ.jsonToJS;
}

function jsToJSONProps(typ: any): any {
    if (typ.jsToJSON === undefined) {
        const map: any = {};
        typ.props.forEach((p: any) => map[p.js] = { key: p.json, typ: p.typ });
        typ.jsToJSON = map;
    }
    return typ.jsToJSON;
}

function transform(val: any, typ: any, getProps: any, key: any = '', parent: any = ''): any {
    function transformPrimitive(typ: string, val: any): any {
        if (typeof typ === typeof val) return val;
        return invalidValue(typ, val, key, parent);
    }

    function transformUnion(typs: any[], val: any): any {
        // val must validate against one typ in typs
        const l = typs.length;
        for (let i = 0; i < l; i++) {
            const typ = typs[i];
            try {
                return transform(val, typ, getProps);
            } catch (_) {}
        }
        return invalidValue(typs, val, key, parent);
    }

    function transformEnum(cases: string[], val: any): any {
        if (cases.indexOf(val) !== -1) return val;
        return invalidValue(cases.map(a => { return l(a); }), val, key, parent);
    }

    function transformArray(typ: any, val: any): any {
        // val must be an array with no invalid elements
        if (!Array.isArray(val)) return invalidValue(l("array"), val, key, parent);
        return val.map(el => transform(el, typ, getProps));
    }

    function transformDate(val: any): any {
        if (val === null) {
            return null;
        }
        const d = new Date(val);
        if (isNaN(d.valueOf())) {
            return invalidValue(l("Date"), val, key, parent);
        }
        return d;
    }

    function transformObject(props: { [k: string]: any }, additional: any, val: any): any {
        if (val === null || typeof val !== "object" || Array.isArray(val)) {
            return invalidValue(l(ref || "object"), val, key, parent);
        }
        const result: any = {};
        Object.getOwnPropertyNames(props).forEach(key => {
            const prop = props[key];
            const v = Object.prototype.hasOwnProperty.call(val, key) ? val[key] : undefined;
            result[prop.key] = transform(v, prop.typ, getProps, key, ref);
        });
        Object.getOwnPropertyNames(val).forEach(key => {
            if (!Object.prototype.hasOwnProperty.call(props, key)) {
                result[key] = transform(val[key], additional, getProps, key, ref);
            }
        });
        return result;
    }

    if (typ === "any") return val;
    if (typ === null) {
        if (val === null) return val;
        return invalidValue(typ, val, key, parent);
    }
    if (typ === false) return invalidValue(typ, val, key, parent);
    let ref: any = undefined;
    while (typeof typ === "object" && typ.ref !== undefined) {
        ref = typ.ref;
        typ = typeMap[typ.ref];
    }
    if (Array.isArray(typ)) return transformEnum(typ, val);
    if (typeof typ === "object") {
        return typ.hasOwnProperty("unionMembers") ? transformUnion(typ.unionMembers, val)
            : typ.hasOwnProperty("arrayItems")    ? transformArray(typ.arrayItems, val)
            : typ.hasOwnProperty("props")         ? transformObject(getProps(typ), typ.additional, val)
            : invalidValue(typ, val, key, parent);
    }
    // Numbers can be parsed by Date but shouldn't be.
    if (typ === Date && typeof val !== "number") return transformDate(val);
    return transformPrimitive(typ, val);
}

function cast<T>(val: any, typ: any): T {
    return transform(val, typ, jsonToJSProps);
}

function uncast<T>(val: T, typ: any): any {
    return transform(val, typ, jsToJSONProps);
}

function l(typ: any) {
    return { literal: typ };
}

function a(typ: any) {
    return { arrayItems: typ };
}

function u(...typs: any[]) {
    return { unionMembers: typs };
}

function o(props: any[], additional: any) {
    return { props, additional };
}

function m(additional: any) {
    return { props: [], additional };
}

function r(name: string) {
    return { ref: name };
}

const typeMap: any = {
    "InfrastructureD": o([
        { json: "data", js: "data", typ: r("Data") },
        { json: "locals", js: "locals", typ: a(r("Local")) },
        { json: "output", js: "output", typ: r("Output") },
        { json: "provider", js: "provider", typ: r("Provider") },
        { json: "resource", js: "resource", typ: r("Resource") },
        { json: "terraform", js: "terraform", typ: a(r("Terraform")) },
        { json: "variable", js: "variable", typ: r("Variable") },
    ], false),
    "Data": o([
        { json: "archive_file", js: "archive_file", typ: m(a(r("ArchiveFile"))) },
        { json: "aws_caller_identity", js: "aws_caller_identity", typ: r("Aws") },
        { json: "aws_iam_policy_document", js: "aws_iam_policy_document", typ: r("AwsIamPolicyDocument") },
        { json: "aws_lambda_invocation", js: "aws_lambda_invocation", typ: r("AwsLambdaInvocation") },
        { json: "aws_region", js: "aws_region", typ: r("Aws") },
        { json: "http", js: "http", typ: r("HTTP") },
        { json: "local_file", js: "local_file", typ: r("LocalFile") },
        { json: "sops_file", js: "sops_file", typ: r("SopsFile") },
    ], false),
    "ArchiveFile": o([
        { json: "output_path", js: "output_path", typ: "" },
        { json: "source_dir", js: "source_dir", typ: "" },
        { json: "type", js: "type", typ: r("Type") },
        { json: "depends_on", js: "depends_on", typ: u(undefined, a("")) },
    ], false),
    "Aws": o([
        { json: "current", js: "current", typ: a(r("Current")) },
    ], false),
    "Current": o([
    ], false),
    "AwsIamPolicyDocument": o([
        { json: "ApiGatewayAuthorizer", js: "ApiGatewayAuthorizer", typ: a(r("APIGatewayAuthorizerInvocationElement")) },
        { json: "ApiGatewayAuthorizerInvocation", js: "ApiGatewayAuthorizerInvocation", typ: a(r("APIGatewayAuthorizerInvocationElement")) },
        { json: "ApiGatewayCloudwatch", js: "ApiGatewayCloudwatch", typ: a(r("APIGatewayCloudwatch")) },
        { json: "CommonLambdaXRay", js: "CommonLambdaXRay", typ: a(r("APIGatewayAuthorizerInvocationElement")) },
        { json: "LambdaAssumeRole", js: "LambdaAssumeRole", typ: a(r("AssumeRole")) },
        { json: "LambdaGatewayAssumeRole", js: "LambdaGatewayAssumeRole", typ: a(r("AssumeRole")) },
        { json: "LamdbaEdgeAssumeRole", js: "LamdbaEdgeAssumeRole", typ: a(r("AssumeRole")) },
        { json: "MultipartUpload", js: "MultipartUpload", typ: a(r("MultipartUpload")) },
        { json: "PruneDevices", js: "PruneDevices", typ: a(r("PruneDevice")) },
        { json: "RegisterDevice", js: "RegisterDevice", typ: a(r("RegisterDevice")) },
        { json: "S3ObjectCreated", js: "S3ObjectCreated", typ: a(r("APIGatewayAuthorizerInvocationElement")) },
        { json: "SNSAssumeRole", js: "SNSAssumeRole", typ: a(r("AssumeRole")) },
        { json: "SendPushNotification", js: "SendPushNotification", typ: a(r("AwsIamPolicyDocumentSendPushNotification")) },
        { json: "StatesAssumeRole", js: "StatesAssumeRole", typ: a(r("AssumeRole")) },
        { json: "UserDelete", js: "UserDelete", typ: a(r("PruneDevice")) },
        { json: "UserSubscribe", js: "UserSubscribe", typ: a(r("RegisterDevice")) },
        { json: "WebhookFeedly", js: "WebhookFeedly", typ: a(r("APIGatewayAuthorizerInvocationElement")) },
        { json: "codepipeline_e2e_assume_role", js: "codepipeline_e2e_assume_role", typ: a(r("AssumeRole")) },
        { json: "codepipeline_e2e_device_farm", js: "codepipeline_e2e_device_farm", typ: a(r("CodepipelineE2EDeviceFarm")) },
        { json: "codepipeline_e2e_s3_access", js: "codepipeline_e2e_s3_access", typ: a(r("CodepipelineE2EDeviceFarm")) },
        { json: "dsql_access", js: "dsql_access", typ: a(r("CodepipelineE2EDeviceFarm")) },
        { json: "dsql_admin_access", js: "dsql_admin_access", typ: a(r("CodepipelineE2EDeviceFarm")) },
    ], false),
    "APIGatewayAuthorizerInvocationElement": o([
        { json: "statement", js: "statement", typ: a(r("Ent")) },
    ], false),
    "Ent": o([
        { json: "actions", js: "actions", typ: a("") },
        { json: "resources", js: "resources", typ: a("") },
    ], false),
    "APIGatewayCloudwatch": o([
        { json: "statement", js: "statement", typ: a(r("APIGatewayCloudwatchStatement")) },
    ], false),
    "APIGatewayCloudwatchStatement": o([
        { json: "actions", js: "actions", typ: a("") },
        { json: "effect", js: "effect", typ: "" },
        { json: "principals", js: "principals", typ: a(r("PrincipalElement")) },
    ], false),
    "PrincipalElement": o([
        { json: "identifiers", js: "identifiers", typ: a("") },
        { json: "type", js: "type", typ: "" },
    ], false),
    "AssumeRole": o([
        { json: "statement", js: "statement", typ: a(r("LambdaAssumeRoleStatement")) },
    ], false),
    "LambdaAssumeRoleStatement": o([
        { json: "actions", js: "actions", typ: a("") },
        { json: "principals", js: "principals", typ: a(r("PrincipalElement")) },
    ], false),
    "MultipartUpload": o([
        { json: "statement", js: "statement", typ: a(r("MultipartUploadStatement")) },
    ], false),
    "MultipartUploadStatement": o([
        { json: "actions", js: "actions", typ: a("") },
        { json: "resources", js: "resources", typ: a("") },
        { json: "condition", js: "condition", typ: u(undefined, a(r("Condition"))) },
    ], false),
    "Condition": o([
        { json: "test", js: "test", typ: "" },
        { json: "values", js: "values", typ: a("") },
        { json: "variable", js: "variable", typ: "" },
    ], false),
    "PruneDevice": o([
        { json: "dynamic", js: "dynamic", typ: r("PruneDeviceDynamic") },
    ], false),
    "PruneDeviceDynamic": o([
        { json: "statement", js: "statement", typ: a(r("DynamicStatement")) },
    ], false),
    "DynamicStatement": o([
        { json: "content", js: "content", typ: a(r("Ent")) },
        { json: "for_each", js: "for_each", typ: "" },
    ], false),
    "RegisterDevice": o([
        { json: "statement", js: "statement", typ: a(r("RegisterDeviceStatement")) },
    ], false),
    "RegisterDeviceStatement": o([
        { json: "actions", js: "actions", typ: a("") },
        { json: "resources", js: "resources", typ: "" },
    ], false),
    "AwsIamPolicyDocumentSendPushNotification": o([
        { json: "dynamic", js: "dynamic", typ: r("PruneDeviceDynamic") },
        { json: "statement", js: "statement", typ: a(r("Ent")) },
    ], false),
    "CodepipelineE2EDeviceFarm": o([
        { json: "statement", js: "statement", typ: a(r("CodepipelineE2EDeviceFarmStatement")) },
    ], false),
    "CodepipelineE2EDeviceFarmStatement": o([
        { json: "actions", js: "actions", typ: a("") },
        { json: "resources", js: "resources", typ: a("") },
        { json: "sid", js: "sid", typ: "" },
    ], false),
    "AwsLambdaInvocation": o([
        { json: "run_migration", js: "run_migration", typ: a(r("RunMigration")) },
    ], false),
    "RunMigration": o([
        { json: "depends_on", js: "depends_on", typ: a("") },
        { json: "function_name", js: "function_name", typ: "" },
        { json: "input", js: "input", typ: "" },
    ], false),
    "HTTP": o([
        { json: "icanhazip", js: "icanhazip", typ: a(r("Icanhazip")) },
    ], false),
    "Icanhazip": o([
        { json: "url", js: "url", typ: "" },
    ], false),
    "LocalFile": o([
        { json: "DefaultFile", js: "DefaultFile", typ: a(r("LocalFileDefaultFile")) },
    ], false),
    "LocalFileDefaultFile": o([
        { json: "filename", js: "filename", typ: "" },
    ], false),
    "SopsFile": o([
        { json: "secrets", js: "secrets", typ: a(r("Secret")) },
    ], false),
    "Secret": o([
        { json: "source_file", js: "source_file", typ: "" },
    ], false),
    "Local": o([
        { json: "api_gateway_authorizer_function_name", js: "api_gateway_authorizer_function_name", typ: u(undefined, "") },
        { json: "cleanup_expired_records_function_name", js: "cleanup_expired_records_function_name", typ: u(undefined, "") },
        { json: "lambda_functions", js: "lambda_functions", typ: u(undefined, a("")) },
        { json: "lambda_functions_api", js: "lambda_functions_api", typ: u(undefined, a("")) },
        { json: "lambda_functions_background", js: "lambda_functions_background", typ: u(undefined, a("")) },
        { json: "device_event_function_name", js: "device_event_function_name", typ: u(undefined, "") },
        { json: "e2e_test_project_name", js: "e2e_test_project_name", typ: u(undefined, "") },
        { json: "download_queue_name", js: "download_queue_name", typ: u(undefined, "") },
        { json: "download_queue_visibility_timeout", js: "download_queue_visibility_timeout", typ: u(undefined, 0) },
        { json: "event_bus_name", js: "event_bus_name", typ: u(undefined, "") },
        { json: "start_file_upload_function_name", js: "start_file_upload_function_name", typ: u(undefined, "") },
        { json: "webhook_feedly_function_name", js: "webhook_feedly_function_name", typ: u(undefined, "") },
        { json: "s3_object_created_function_name", js: "s3_object_created_function_name", typ: u(undefined, "") },
        { json: "list_files_function_name", js: "list_files_function_name", typ: u(undefined, "") },
        { json: "login_user_function_name", js: "login_user_function_name", typ: u(undefined, "") },
        { json: "adot_layer_arn", js: "adot_layer_arn", typ: u(undefined, "") },
        { json: "adot_layer_arn_x86_64", js: "adot_layer_arn_x86_64", typ: u(undefined, "") },
        { json: "common_lambda_env", js: "common_lambda_env", typ: u(undefined, r("CommonLambdaEnv")) },
        { json: "common_tags", js: "common_tags", typ: u(undefined, r("CommonTags")) },
        { json: "lambda_architecture", js: "lambda_architecture", typ: u(undefined, "") },
        { json: "migrate_dsql_function_name", js: "migrate_dsql_function_name", typ: u(undefined, "") },
        { json: "prune_devices_function_name", js: "prune_devices_function_name", typ: u(undefined, "") },
        { json: "refresh_token_function_name", js: "refresh_token_function_name", typ: u(undefined, "") },
        { json: "register_device_function_name", js: "register_device_function_name", typ: u(undefined, "") },
        { json: "register_user_function_name", js: "register_user_function_name", typ: u(undefined, "") },
        { json: "send_push_notification_function_name", js: "send_push_notification_function_name", typ: u(undefined, "") },
        { json: "user_delete_function_name", js: "user_delete_function_name", typ: u(undefined, "") },
        { json: "user_subscribe_function_name", js: "user_subscribe_function_name", typ: u(undefined, "") },
    ], false),
    "CommonLambdaEnv": o([
        { json: "DSQL_CLUSTER_ENDPOINT", js: "DSQL_CLUSTER_ENDPOINT", typ: "" },
        { json: "DSQL_REGION", js: "DSQL_REGION", typ: "" },
        { json: "LOG_LEVEL", js: "LOG_LEVEL", typ: "" },
        { json: "NODE_OPTIONS", js: "NODE_OPTIONS", typ: "" },
        { json: "OPENTELEMETRY_COLLECTOR_CONFIG_URI", js: "OPENTELEMETRY_COLLECTOR_CONFIG_URI", typ: "" },
        { json: "OPENTELEMETRY_EXTENSION_LOG_LEVEL", js: "OPENTELEMETRY_EXTENSION_LOG_LEVEL", typ: "" },
    ], false),
    "CommonTags": o([
        { json: "Environment", js: "Environment", typ: "" },
        { json: "ManagedBy", js: "ManagedBy", typ: "" },
        { json: "Project", js: "Project", typ: "" },
    ], false),
    "Output": o([
        { json: "api_gateway_api_key", js: "api_gateway_api_key", typ: a(r("APIGatewayAPIKey")) },
        { json: "api_gateway_stage", js: "api_gateway_stage", typ: a(r("APIGatewayStage")) },
        { json: "api_gateway_subdomain", js: "api_gateway_subdomain", typ: a(r("APIGatewayStage")) },
        { json: "cloudfront_distribution_domain", js: "cloudfront_distribution_domain", typ: a(r("APIGatewayStage")) },
        { json: "cloudfront_media_files_domain", js: "cloudfront_media_files_domain", typ: a(r("APIGatewayStage")) },
        { json: "cloudwatch_dashboard_url", js: "cloudwatch_dashboard_url", typ: a(r("APIGatewayStage")) },
        { json: "codepipeline_e2e_arn", js: "codepipeline_e2e_arn", typ: a(r("APIGatewayStage")) },
        { json: "codepipeline_e2e_console_url", js: "codepipeline_e2e_console_url", typ: a(r("APIGatewayStage")) },
        { json: "device_farm_device_pool_arn", js: "device_farm_device_pool_arn", typ: a(r("APIGatewayStage")) },
        { json: "device_farm_project_arn", js: "device_farm_project_arn", typ: a(r("APIGatewayStage")) },
        { json: "device_farm_project_id", js: "device_farm_project_id", typ: a(r("APIGatewayStage")) },
        { json: "download_queue_arn", js: "download_queue_arn", typ: a(r("APIGatewayStage")) },
        { json: "download_queue_url", js: "download_queue_url", typ: a(r("APIGatewayStage")) },
        { json: "dsql_cluster_arn", js: "dsql_cluster_arn", typ: a(r("APIGatewayStage")) },
        { json: "dsql_cluster_endpoint", js: "dsql_cluster_endpoint", typ: a(r("APIGatewayStage")) },
        { json: "e2e_test_artifacts_bucket", js: "e2e_test_artifacts_bucket", typ: a(r("APIGatewayStage")) },
        { json: "event_bus_arn", js: "event_bus_arn", typ: a(r("APIGatewayStage")) },
        { json: "event_bus_name", js: "event_bus_name", typ: a(r("APIGatewayStage")) },
        { json: "idempotency_table_arn", js: "idempotency_table_arn", typ: a(r("APIGatewayStage")) },
        { json: "idempotency_table_name", js: "idempotency_table_name", typ: a(r("APIGatewayStage")) },
        { json: "migration_result", js: "migration_result", typ: a(r("APIGatewayStage")) },
        { json: "public_ip", js: "public_ip", typ: a(r("APIGatewayStage")) },
    ], false),
    "APIGatewayAPIKey": o([
        { json: "description", js: "description", typ: "" },
        { json: "sensitive", js: "sensitive", typ: true },
        { json: "value", js: "value", typ: "" },
    ], false),
    "APIGatewayStage": o([
        { json: "description", js: "description", typ: "" },
        { json: "value", js: "value", typ: "" },
    ], false),
    "Provider": o([
        { json: "aws", js: "aws", typ: a(r("Aw")) },
    ], false),
    "Aw": o([
        { json: "alias", js: "alias", typ: u(undefined, "") },
        { json: "region", js: "region", typ: "" },
        { json: "profile", js: "profile", typ: u(undefined, "") },
    ], false),
    "Resource": o([
        { json: "aws_api_gateway_account", js: "aws_api_gateway_account", typ: r("AwsAPIGatewayAccount") },
        { json: "aws_api_gateway_api_key", js: "aws_api_gateway_api_key", typ: r("AwsAPIGatewayAPIKey") },
        { json: "aws_api_gateway_authorizer", js: "aws_api_gateway_authorizer", typ: r("AwsAPIGatewayAuthorizer") },
        { json: "aws_api_gateway_deployment", js: "aws_api_gateway_deployment", typ: r("AwsAPIGatewayDeployment") },
        { json: "aws_api_gateway_gateway_response", js: "aws_api_gateway_gateway_response", typ: r("AwsAPIGatewayGatewayResponse") },
        { json: "aws_api_gateway_integration", js: "aws_api_gateway_integration", typ: r("AwsAPIGatewayIntegration") },
        { json: "aws_api_gateway_method", js: "aws_api_gateway_method", typ: r("AwsAPIGatewayMethod") },
        { json: "aws_api_gateway_method_settings", js: "aws_api_gateway_method_settings", typ: r("AwsAPIGatewayMethodSettings") },
        { json: "aws_api_gateway_resource", js: "aws_api_gateway_resource", typ: r("AwsAPIGatewayResource") },
        { json: "aws_api_gateway_rest_api", js: "aws_api_gateway_rest_api", typ: r("AwsAPIGatewayRESTAPI") },
        { json: "aws_api_gateway_stage", js: "aws_api_gateway_stage", typ: r("AwsAPIGatewayStage") },
        { json: "aws_api_gateway_usage_plan", js: "aws_api_gateway_usage_plan", typ: r("AwsAPIGatewayUsagePlan") },
        { json: "aws_api_gateway_usage_plan_key", js: "aws_api_gateway_usage_plan_key", typ: r("AwsAPIGatewayUsagePlanKey") },
        { json: "aws_budgets_budget", js: "aws_budgets_budget", typ: r("AwsBudgetsBudget") },
        { json: "aws_cloudfront_distribution", js: "aws_cloudfront_distribution", typ: r("AwsCloudfrontDistribution") },
        { json: "aws_cloudfront_origin_access_control", js: "aws_cloudfront_origin_access_control", typ: r("AwsCloudfrontOriginAccessControl") },
        { json: "aws_cloudwatch_dashboard", js: "aws_cloudwatch_dashboard", typ: r("AwsCloudwatchDashboard") },
        { json: "aws_cloudwatch_event_bus", js: "aws_cloudwatch_event_bus", typ: r("AwsCloudwatchEventBus") },
        { json: "aws_cloudwatch_event_rule", js: "aws_cloudwatch_event_rule", typ: r("AwsCloudwatchEventRule") },
        { json: "aws_cloudwatch_event_target", js: "aws_cloudwatch_event_target", typ: r("AwsCloudwatchEventTarget") },
        { json: "aws_cloudwatch_log_group", js: "aws_cloudwatch_log_group", typ: m(a(r("AwsCloudwatchLogGroup"))) },
        { json: "aws_cloudwatch_metric_alarm", js: "aws_cloudwatch_metric_alarm", typ: r("AwsCloudwatchMetricAlarm") },
        { json: "aws_codepipeline", js: "aws_codepipeline", typ: r("AwsCodepipeline") },
        { json: "aws_devicefarm_device_pool", js: "aws_devicefarm_device_pool", typ: r("AwsDevicefarmDevicePool") },
        { json: "aws_devicefarm_project", js: "aws_devicefarm_project", typ: r("AwsDevicefarmProject") },
        { json: "aws_dsql_cluster", js: "aws_dsql_cluster", typ: r("AwsDsqlCluster") },
        { json: "aws_dynamodb_table", js: "aws_dynamodb_table", typ: r("AwsDynamodbTable") },
        { json: "aws_iam_policy", js: "aws_iam_policy", typ: m(a(r("AwsIamPolicy"))) },
        { json: "aws_iam_role", js: "aws_iam_role", typ: m(a(r("AwsIamRole"))) },
        { json: "aws_iam_role_policy", js: "aws_iam_role_policy", typ: m(a(r("AwsIamRolePolicy"))) },
        { json: "aws_iam_role_policy_attachment", js: "aws_iam_role_policy_attachment", typ: m(a(r("AwsIamRolePolicyAttachment"))) },
        { json: "aws_lambda_event_source_mapping", js: "aws_lambda_event_source_mapping", typ: r("AwsLambdaEventSourceMapping") },
        { json: "aws_lambda_function", js: "aws_lambda_function", typ: r("AwsLambdaFunction") },
        { json: "aws_lambda_layer_version", js: "aws_lambda_layer_version", typ: r("AwsLambdaLayerVersion") },
        { json: "aws_lambda_permission", js: "aws_lambda_permission", typ: m(a(r("AwsLambdaPermission"))) },
        { json: "aws_s3_bucket", js: "aws_s3_bucket", typ: r("AwsS3Bucket") },
        { json: "aws_s3_bucket_intelligent_tiering_configuration", js: "aws_s3_bucket_intelligent_tiering_configuration", typ: r("AwsS3BucketIntelligentTieringConfiguration") },
        { json: "aws_s3_bucket_lifecycle_configuration", js: "aws_s3_bucket_lifecycle_configuration", typ: r("AwsS3BucketLifecycleConfiguration") },
        { json: "aws_s3_bucket_notification", js: "aws_s3_bucket_notification", typ: r("AwsS3BucketNotification") },
        { json: "aws_s3_bucket_policy", js: "aws_s3_bucket_policy", typ: r("AwsS3BucketPolicy") },
        { json: "aws_s3_bucket_public_access_block", js: "aws_s3_bucket_public_access_block", typ: r("AwsS3BucketPublicAccessBlock") },
        { json: "aws_s3_bucket_versioning", js: "aws_s3_bucket_versioning", typ: r("AwsS3BucketVersioning") },
        { json: "aws_s3_object", js: "aws_s3_object", typ: r("AwsS3Object") },
        { json: "aws_sns_platform_application", js: "aws_sns_platform_application", typ: r("AwsSnsPlatformApplication") },
        { json: "aws_sns_topic", js: "aws_sns_topic", typ: r("AwsSnsTopic") },
        { json: "aws_sqs_queue", js: "aws_sqs_queue", typ: r("AwsSqsQueue") },
        { json: "aws_sqs_queue_policy", js: "aws_sqs_queue_policy", typ: r("AwsSqsQueuePolicy") },
        { json: "null_resource", js: "null_resource", typ: r("NullResource") },
        { json: "time_sleep", js: "time_sleep", typ: r("TimeSleep") },
    ], false),
    "AwsAPIGatewayAccount": o([
        { json: "Main", js: "Main", typ: a(r("AwsAPIGatewayAccountMain")) },
    ], false),
    "AwsAPIGatewayAccountMain": o([
        { json: "cloudwatch_role_arn", js: "cloudwatch_role_arn", typ: "" },
    ], false),
    "AwsAPIGatewayAPIKey": o([
        { json: "iOSApp", js: "iOSApp", typ: a(r("IOSApp")) },
    ], false),
    "IOSApp": o([
        { json: "description", js: "description", typ: u(undefined, "") },
        { json: "enabled", js: "enabled", typ: u(undefined, true) },
        { json: "name", js: "name", typ: "" },
        { json: "tags", js: "tags", typ: r("Tags") },
        { json: "schedule_expression", js: "schedule_expression", typ: u(undefined, "") },
        { json: "state", js: "state", typ: u(undefined, "") },
    ], false),
    "AwsAPIGatewayAuthorizer": o([
        { json: "ApiGatewayAuthorizer", js: "ApiGatewayAuthorizer", typ: a(r("APIGatewayAuthorizer")) },
    ], false),
    "APIGatewayAuthorizer": o([
        { json: "authorizer_credentials", js: "authorizer_credentials", typ: "" },
        { json: "authorizer_result_ttl_in_seconds", js: "authorizer_result_ttl_in_seconds", typ: 0 },
        { json: "authorizer_uri", js: "authorizer_uri", typ: "" },
        { json: "identity_source", js: "identity_source", typ: "" },
        { json: "name", js: "name", typ: "" },
        { json: "rest_api_id", js: "rest_api_id", typ: r("APIID") },
        { json: "type", js: "type", typ: "" },
    ], false),
    "AwsAPIGatewayDeployment": o([
        { json: "Main", js: "Main", typ: a(r("AwsAPIGatewayDeploymentMain")) },
    ], false),
    "AwsAPIGatewayDeploymentMain": o([
        { json: "depends_on", js: "depends_on", typ: a("") },
        { json: "lifecycle", js: "lifecycle", typ: a(r("Lifecycle")) },
        { json: "rest_api_id", js: "rest_api_id", typ: r("APIID") },
        { json: "triggers", js: "triggers", typ: r("MainTriggers") },
    ], false),
    "Lifecycle": o([
        { json: "create_before_destroy", js: "create_before_destroy", typ: true },
    ], false),
    "MainTriggers": o([
        { json: "redeployment", js: "redeployment", typ: "" },
    ], false),
    "AwsAPIGatewayGatewayResponse": o([
        { json: "Default400GatewayResponse", js: "Default400GatewayResponse", typ: a(r("Default00GatewayResponse")) },
        { json: "Default500GatewayResponse", js: "Default500GatewayResponse", typ: a(r("Default00GatewayResponse")) },
    ], false),
    "Default00GatewayResponse": o([
        { json: "response_parameters", js: "response_parameters", typ: r("ResponseParameters") },
        { json: "response_templates", js: "response_templates", typ: r("ResponseTemplates") },
        { json: "response_type", js: "response_type", typ: "" },
        { json: "rest_api_id", js: "rest_api_id", typ: r("APIID") },
    ], false),
    "ResponseParameters": o([
        { json: "gatewayresponse.header.Cache-Control", js: "gatewayresponse.header.Cache-Control", typ: "" },
        { json: "gatewayresponse.header.X-Content-Type-Options", js: "gatewayresponse.header.X-Content-Type-Options", typ: "" },
        { json: "gatewayresponse.header.X-Frame-Options", js: "gatewayresponse.header.X-Frame-Options", typ: "" },
        { json: "gatewayresponse.header.X-XSS-Protection", js: "gatewayresponse.header.X-XSS-Protection", typ: "" },
    ], false),
    "ResponseTemplates": o([
        { json: "application/json", js: "application/json", typ: "" },
    ], false),
    "AwsAPIGatewayIntegration": o([
        { json: "DeviceEventPost", js: "DeviceEventPost", typ: a(r("AwsAPIGatewayIntegrationDeviceEventPost")) },
        { json: "ListFilesGet", js: "ListFilesGet", typ: a(r("AwsAPIGatewayIntegrationDeviceEventPost")) },
        { json: "LoginUserPost", js: "LoginUserPost", typ: a(r("AwsAPIGatewayIntegrationDeviceEventPost")) },
        { json: "RefreshTokenPost", js: "RefreshTokenPost", typ: a(r("AwsAPIGatewayIntegrationDeviceEventPost")) },
        { json: "RegisterDevicePost", js: "RegisterDevicePost", typ: a(r("AwsAPIGatewayIntegrationDeviceEventPost")) },
        { json: "RegisterUserPost", js: "RegisterUserPost", typ: a(r("AwsAPIGatewayIntegrationDeviceEventPost")) },
        { json: "UserDelete", js: "UserDelete", typ: a(r("AwsAPIGatewayIntegrationDeviceEventPost")) },
        { json: "UserSubscribePost", js: "UserSubscribePost", typ: a(r("AwsAPIGatewayIntegrationDeviceEventPost")) },
        { json: "WebhookFeedlyPost", js: "WebhookFeedlyPost", typ: a(r("AwsAPIGatewayIntegrationDeviceEventPost")) },
    ], false),
    "AwsAPIGatewayIntegrationDeviceEventPost": o([
        { json: "http_method", js: "http_method", typ: "" },
        { json: "integration_http_method", js: "integration_http_method", typ: "" },
        { json: "resource_id", js: "resource_id", typ: "" },
        { json: "rest_api_id", js: "rest_api_id", typ: r("APIID") },
        { json: "type", js: "type", typ: "" },
        { json: "uri", js: "uri", typ: "" },
    ], false),
    "AwsAPIGatewayMethod": o([
        { json: "DeviceEventPost", js: "DeviceEventPost", typ: a(r("AwsAPIGatewayMethodDeviceEventPost")) },
        { json: "ListFilesGet", js: "ListFilesGet", typ: a(r("AwsAPIGatewayMethodDeviceEventPost")) },
        { json: "LoginUserPost", js: "LoginUserPost", typ: a(r("AwsAPIGatewayMethodDeviceEventPost")) },
        { json: "RefreshTokenPost", js: "RefreshTokenPost", typ: a(r("AwsAPIGatewayMethodDeviceEventPost")) },
        { json: "RegisterDevicePost", js: "RegisterDevicePost", typ: a(r("AwsAPIGatewayMethodDeviceEventPost")) },
        { json: "RegisterUserPost", js: "RegisterUserPost", typ: a(r("AwsAPIGatewayMethodDeviceEventPost")) },
        { json: "UserDelete", js: "UserDelete", typ: a(r("AwsAPIGatewayMethodDeviceEventPost")) },
        { json: "UserSubscribePost", js: "UserSubscribePost", typ: a(r("AwsAPIGatewayMethodDeviceEventPost")) },
        { json: "WebhookFeedlyPost", js: "WebhookFeedlyPost", typ: a(r("AwsAPIGatewayMethodDeviceEventPost")) },
    ], false),
    "AwsAPIGatewayMethodDeviceEventPost": o([
        { json: "api_key_required", js: "api_key_required", typ: true },
        { json: "authorization", js: "authorization", typ: "" },
        { json: "http_method", js: "http_method", typ: "" },
        { json: "resource_id", js: "resource_id", typ: "" },
        { json: "rest_api_id", js: "rest_api_id", typ: r("APIID") },
        { json: "authorizer_id", js: "authorizer_id", typ: u(undefined, "") },
    ], false),
    "AwsAPIGatewayMethodSettings": o([
        { json: "Production", js: "Production", typ: a(r("AwsAPIGatewayMethodSettingsProduction")) },
    ], false),
    "AwsAPIGatewayMethodSettingsProduction": o([
        { json: "method_path", js: "method_path", typ: "" },
        { json: "rest_api_id", js: "rest_api_id", typ: r("APIID") },
        { json: "settings", js: "settings", typ: a(r("Setting")) },
        { json: "stage_name", js: "stage_name", typ: "" },
    ], false),
    "Setting": o([
        { json: "data_trace_enabled", js: "data_trace_enabled", typ: true },
        { json: "logging_level", js: "logging_level", typ: "" },
        { json: "metrics_enabled", js: "metrics_enabled", typ: true },
    ], false),
    "AwsAPIGatewayResource": o([
        { json: "Device", js: "Device", typ: a(r("Device")) },
        { json: "DeviceEvent", js: "DeviceEvent", typ: a(r("Device")) },
        { json: "DeviceRegister", js: "DeviceRegister", typ: a(r("Device")) },
        { json: "Feedly", js: "Feedly", typ: a(r("Device")) },
        { json: "Files", js: "Files", typ: a(r("Device")) },
        { json: "User", js: "User", typ: a(r("Device")) },
        { json: "UserLogin", js: "UserLogin", typ: a(r("Device")) },
        { json: "UserRefresh", js: "UserRefresh", typ: a(r("Device")) },
        { json: "UserRegister", js: "UserRegister", typ: a(r("Device")) },
        { json: "UserSubscribe", js: "UserSubscribe", typ: a(r("Device")) },
    ], false),
    "Device": o([
        { json: "parent_id", js: "parent_id", typ: r("ParentID") },
        { json: "path_part", js: "path_part", typ: "" },
        { json: "rest_api_id", js: "rest_api_id", typ: r("APIID") },
    ], false),
    "AwsAPIGatewayRESTAPI": o([
        { json: "Main", js: "Main", typ: a(r("AwsAPIGatewayRESTAPIMain")) },
    ], false),
    "AwsAPIGatewayRESTAPIMain": o([
        { json: "api_key_source", js: "api_key_source", typ: "" },
        { json: "description", js: "description", typ: "" },
        { json: "endpoint_configuration", js: "endpoint_configuration", typ: a(r("EndpointConfiguration")) },
        { json: "name", js: "name", typ: "" },
        { json: "tags", js: "tags", typ: r("Tags") },
    ], false),
    "EndpointConfiguration": o([
        { json: "types", js: "types", typ: a("") },
    ], false),
    "AwsAPIGatewayStage": o([
        { json: "Production", js: "Production", typ: a(r("AwsAPIGatewayStageProduction")) },
    ], false),
    "AwsAPIGatewayStageProduction": o([
        { json: "deployment_id", js: "deployment_id", typ: "" },
        { json: "rest_api_id", js: "rest_api_id", typ: r("APIID") },
        { json: "stage_name", js: "stage_name", typ: "" },
        { json: "tags", js: "tags", typ: r("Tags") },
        { json: "xray_tracing_enabled", js: "xray_tracing_enabled", typ: true },
    ], false),
    "AwsAPIGatewayUsagePlan": o([
        { json: "iOSApp", js: "iOSApp", typ: a(r("AwsAPIGatewayUsagePlanIOSApp")) },
    ], false),
    "AwsAPIGatewayUsagePlanIOSApp": o([
        { json: "api_stages", js: "api_stages", typ: a(r("APIStage")) },
        { json: "description", js: "description", typ: "" },
        { json: "name", js: "name", typ: "" },
        { json: "quota_settings", js: "quota_settings", typ: a(r("QuotaSetting")) },
        { json: "throttle_settings", js: "throttle_settings", typ: a(r("ThrottleSetting")) },
    ], false),
    "APIStage": o([
        { json: "api_id", js: "api_id", typ: r("APIID") },
        { json: "stage", js: "stage", typ: "" },
    ], false),
    "QuotaSetting": o([
        { json: "limit", js: "limit", typ: 0 },
        { json: "period", js: "period", typ: "" },
    ], false),
    "ThrottleSetting": o([
        { json: "burst_limit", js: "burst_limit", typ: 0 },
        { json: "rate_limit", js: "rate_limit", typ: 0 },
    ], false),
    "AwsAPIGatewayUsagePlanKey": o([
        { json: "iOSApp", js: "iOSApp", typ: a(r("AwsAPIGatewayUsagePlanKeyIOSApp")) },
    ], false),
    "AwsAPIGatewayUsagePlanKeyIOSApp": o([
        { json: "key_id", js: "key_id", typ: "" },
        { json: "key_type", js: "key_type", typ: "" },
        { json: "usage_plan_id", js: "usage_plan_id", typ: "" },
    ], false),
    "AwsBudgetsBudget": o([
        { json: "device_farm", js: "device_farm", typ: a(r("DeviceFarm")) },
    ], false),
    "DeviceFarm": o([
        { json: "budget_type", js: "budget_type", typ: "" },
        { json: "cost_filter", js: "cost_filter", typ: a(r("CostFilter")) },
        { json: "count", js: "count", typ: "" },
        { json: "limit_amount", js: "limit_amount", typ: "" },
        { json: "limit_unit", js: "limit_unit", typ: "" },
        { json: "name", js: "name", typ: "" },
        { json: "notification", js: "notification", typ: a(r("Notification")) },
        { json: "tags", js: "tags", typ: "" },
        { json: "time_period_start", js: "time_period_start", typ: "" },
        { json: "time_unit", js: "time_unit", typ: "" },
    ], false),
    "CostFilter": o([
        { json: "name", js: "name", typ: "" },
        { json: "values", js: "values", typ: a("") },
    ], false),
    "Notification": o([
        { json: "comparison_operator", js: "comparison_operator", typ: "" },
        { json: "notification_type", js: "notification_type", typ: "" },
        { json: "subscriber_email_addresses", js: "subscriber_email_addresses", typ: a("") },
        { json: "threshold", js: "threshold", typ: 0 },
        { json: "threshold_type", js: "threshold_type", typ: "" },
    ], false),
    "AwsCloudfrontDistribution": o([
        { json: "MediaFiles", js: "MediaFiles", typ: a(r("MediaFile")) },
        { json: "Production", js: "Production", typ: a(r("AwsCloudfrontDistributionProduction")) },
    ], false),
    "MediaFile": o([
        { json: "default_cache_behavior", js: "default_cache_behavior", typ: a(r("MediaFileDefaultCacheBehavior")) },
        { json: "default_root_object", js: "default_root_object", typ: "" },
        { json: "enabled", js: "enabled", typ: true },
        { json: "origin", js: "origin", typ: a(r("MediaFileOrigin")) },
        { json: "price_class", js: "price_class", typ: "" },
        { json: "restrictions", js: "restrictions", typ: a(r("Restriction")) },
        { json: "tags", js: "tags", typ: "" },
        { json: "viewer_certificate", js: "viewer_certificate", typ: a(r("ViewerCertificate")) },
    ], false),
    "MediaFileDefaultCacheBehavior": o([
        { json: "allowed_methods", js: "allowed_methods", typ: a("") },
        { json: "cached_methods", js: "cached_methods", typ: a("") },
        { json: "default_ttl", js: "default_ttl", typ: 0 },
        { json: "forwarded_values", js: "forwarded_values", typ: a(r("PurpleForwardedValue")) },
        { json: "max_ttl", js: "max_ttl", typ: 0 },
        { json: "min_ttl", js: "min_ttl", typ: 0 },
        { json: "target_origin_id", js: "target_origin_id", typ: "" },
        { json: "viewer_protocol_policy", js: "viewer_protocol_policy", typ: "" },
    ], false),
    "PurpleForwardedValue": o([
        { json: "cookies", js: "cookies", typ: a(r("Cooky")) },
        { json: "query_string", js: "query_string", typ: true },
    ], false),
    "Cooky": o([
        { json: "forward", js: "forward", typ: "" },
    ], false),
    "MediaFileOrigin": o([
        { json: "domain_name", js: "domain_name", typ: "" },
        { json: "origin_access_control_id", js: "origin_access_control_id", typ: "" },
        { json: "origin_id", js: "origin_id", typ: "" },
    ], false),
    "Restriction": o([
        { json: "geo_restriction", js: "geo_restriction", typ: a(r("GeoRestriction")) },
    ], false),
    "GeoRestriction": o([
        { json: "locations", js: "locations", typ: a("") },
        { json: "restriction_type", js: "restriction_type", typ: "" },
    ], false),
    "ViewerCertificate": o([
        { json: "cloudfront_default_certificate", js: "cloudfront_default_certificate", typ: true },
    ], false),
    "AwsCloudfrontDistributionProduction": o([
        { json: "comment", js: "comment", typ: "" },
        { json: "default_cache_behavior", js: "default_cache_behavior", typ: a(r("ProductionDefaultCacheBehavior")) },
        { json: "enabled", js: "enabled", typ: true },
        { json: "origin", js: "origin", typ: a(r("ProductionOrigin")) },
        { json: "restrictions", js: "restrictions", typ: a(r("Restriction")) },
        { json: "tags", js: "tags", typ: "" },
        { json: "viewer_certificate", js: "viewer_certificate", typ: a(r("ViewerCertificate")) },
    ], false),
    "ProductionDefaultCacheBehavior": o([
        { json: "allowed_methods", js: "allowed_methods", typ: a("") },
        { json: "cached_methods", js: "cached_methods", typ: a("") },
        { json: "default_ttl", js: "default_ttl", typ: 0 },
        { json: "forwarded_values", js: "forwarded_values", typ: a(r("FluffyForwardedValue")) },
        { json: "lambda_function_association", js: "lambda_function_association", typ: a(r("LambdaFunctionAssociation")) },
        { json: "max_ttl", js: "max_ttl", typ: 0 },
        { json: "min_ttl", js: "min_ttl", typ: 0 },
        { json: "target_origin_id", js: "target_origin_id", typ: "" },
        { json: "viewer_protocol_policy", js: "viewer_protocol_policy", typ: "" },
    ], false),
    "FluffyForwardedValue": o([
        { json: "cookies", js: "cookies", typ: a(r("Cooky")) },
        { json: "headers", js: "headers", typ: a("") },
        { json: "query_string", js: "query_string", typ: true },
    ], false),
    "LambdaFunctionAssociation": o([
        { json: "event_type", js: "event_type", typ: "" },
        { json: "lambda_arn", js: "lambda_arn", typ: "" },
    ], false),
    "ProductionOrigin": o([
        { json: "custom_origin_config", js: "custom_origin_config", typ: a(r("CustomOriginConfig")) },
        { json: "domain_name", js: "domain_name", typ: "" },
        { json: "origin_id", js: "origin_id", typ: "" },
        { json: "origin_path", js: "origin_path", typ: "" },
    ], false),
    "CustomOriginConfig": o([
        { json: "http_port", js: "http_port", typ: 0 },
        { json: "https_port", js: "https_port", typ: 0 },
        { json: "origin_protocol_policy", js: "origin_protocol_policy", typ: "" },
        { json: "origin_ssl_protocols", js: "origin_ssl_protocols", typ: a("") },
    ], false),
    "AwsCloudfrontOriginAccessControl": o([
        { json: "MediaFilesOAC", js: "MediaFilesOAC", typ: a(r("MediaFilesOAC")) },
    ], false),
    "MediaFilesOAC": o([
        { json: "description", js: "description", typ: "" },
        { json: "name", js: "name", typ: "" },
        { json: "origin_access_control_origin_type", js: "origin_access_control_origin_type", typ: "" },
        { json: "signing_behavior", js: "signing_behavior", typ: "" },
        { json: "signing_protocol", js: "signing_protocol", typ: "" },
    ], false),
    "AwsCloudwatchDashboard": o([
        { json: "Main", js: "Main", typ: a(r("AwsCloudwatchDashboardMain")) },
    ], false),
    "AwsCloudwatchDashboardMain": o([
        { json: "dashboard_body", js: "dashboard_body", typ: "" },
        { json: "dashboard_name", js: "dashboard_name", typ: "" },
    ], false),
    "AwsCloudwatchEventBus": o([
        { json: "MediaDownloader", js: "MediaDownloader", typ: a(r("MediaDownloader")) },
    ], false),
    "MediaDownloader": o([
        { json: "name", js: "name", typ: "" },
        { json: "tags", js: "tags", typ: "" },
    ], false),
    "AwsCloudwatchEventRule": o([
        { json: "CleanupExpiredRecords", js: "CleanupExpiredRecords", typ: a(r("IOSApp")) },
        { json: "DownloadRequested", js: "DownloadRequested", typ: a(r("DownloadRequested")) },
        { json: "PruneDevices", js: "PruneDevices", typ: a(r("IOSApp")) },
    ], false),
    "DownloadRequested": o([
        { json: "description", js: "description", typ: "" },
        { json: "event_bus_name", js: "event_bus_name", typ: "" },
        { json: "event_pattern", js: "event_pattern", typ: "" },
        { json: "name", js: "name", typ: "" },
    ], false),
    "AwsCloudwatchEventTarget": o([
        { json: "CleanupExpiredRecords", js: "CleanupExpiredRecords", typ: a(r("CleanupExpiredRecord")) },
        { json: "DownloadRequestedToSQS", js: "DownloadRequestedToSQS", typ: a(r("DownloadRequestedToSQ")) },
        { json: "PruneDevices", js: "PruneDevices", typ: a(r("CleanupExpiredRecord")) },
    ], false),
    "CleanupExpiredRecord": o([
        { json: "arn", js: "arn", typ: "" },
        { json: "rule", js: "rule", typ: "" },
    ], false),
    "DownloadRequestedToSQ": o([
        { json: "arn", js: "arn", typ: "" },
        { json: "event_bus_name", js: "event_bus_name", typ: "" },
        { json: "input_transformer", js: "input_transformer", typ: a(r("InputTransformer")) },
        { json: "rule", js: "rule", typ: "" },
        { json: "target_id", js: "target_id", typ: "" },
    ], false),
    "InputTransformer": o([
        { json: "input_paths", js: "input_paths", typ: r("InputPaths") },
        { json: "input_template", js: "input_template", typ: "" },
    ], false),
    "InputPaths": o([
        { json: "correlationId", js: "correlationId", typ: "" },
        { json: "fileId", js: "fileId", typ: "" },
        { json: "sourceUrl", js: "sourceUrl", typ: "" },
        { json: "userId", js: "userId", typ: "" },
    ], false),
    "AwsCloudwatchLogGroup": o([
        { json: "name", js: "name", typ: "" },
        { json: "retention_in_days", js: "retention_in_days", typ: 0 },
        { json: "tags", js: "tags", typ: r("Tags") },
    ], false),
    "AwsCloudwatchMetricAlarm": o([
        { json: "DownloadDLQMessages", js: "DownloadDLQMessages", typ: a(r("Age")) },
        { json: "EventBridgeFailedInvocations", js: "EventBridgeFailedInvocations", typ: a(r("EventBridge")) },
        { json: "EventBridgeThrottled", js: "EventBridgeThrottled", typ: a(r("EventBridge")) },
        { json: "LambdaErrorsApi", js: "LambdaErrorsApi", typ: a(r("Lambda")) },
        { json: "LambdaErrorsBackground", js: "LambdaErrorsBackground", typ: a(r("Lambda")) },
        { json: "LambdaThrottlesApi", js: "LambdaThrottlesApi", typ: a(r("Lambda")) },
        { json: "LambdaThrottlesBackground", js: "LambdaThrottlesBackground", typ: a(r("Lambda")) },
        { json: "SqsDlqMessages", js: "SqsDlqMessages", typ: a(r("Age")) },
        { json: "SqsQueueAge", js: "SqsQueueAge", typ: a(r("Age")) },
    ], false),
    "Age": o([
        { json: "alarm_description", js: "alarm_description", typ: "" },
        { json: "alarm_name", js: "alarm_name", typ: "" },
        { json: "comparison_operator", js: "comparison_operator", typ: "" },
        { json: "dimensions", js: "dimensions", typ: r("DownloadDLQMessageDimensions") },
        { json: "evaluation_periods", js: "evaluation_periods", typ: 0 },
        { json: "metric_name", js: "metric_name", typ: "" },
        { json: "namespace", js: "namespace", typ: "" },
        { json: "period", js: "period", typ: 0 },
        { json: "statistic", js: "statistic", typ: "" },
        { json: "threshold", js: "threshold", typ: 0 },
        { json: "treat_missing_data", js: "treat_missing_data", typ: "" },
    ], false),
    "DownloadDLQMessageDimensions": o([
        { json: "QueueName", js: "QueueName", typ: "" },
    ], false),
    "EventBridge": o([
        { json: "alarm_description", js: "alarm_description", typ: "" },
        { json: "alarm_name", js: "alarm_name", typ: "" },
        { json: "comparison_operator", js: "comparison_operator", typ: "" },
        { json: "dimensions", js: "dimensions", typ: r("EventBridgeFailedInvocationDimensions") },
        { json: "evaluation_periods", js: "evaluation_periods", typ: 0 },
        { json: "metric_name", js: "metric_name", typ: "" },
        { json: "namespace", js: "namespace", typ: "" },
        { json: "period", js: "period", typ: 0 },
        { json: "statistic", js: "statistic", typ: "" },
        { json: "threshold", js: "threshold", typ: 0 },
        { json: "treat_missing_data", js: "treat_missing_data", typ: "" },
    ], false),
    "EventBridgeFailedInvocationDimensions": o([
        { json: "RuleName", js: "RuleName", typ: "" },
    ], false),
    "Lambda": o([
        { json: "alarm_description", js: "alarm_description", typ: "" },
        { json: "alarm_name", js: "alarm_name", typ: "" },
        { json: "comparison_operator", js: "comparison_operator", typ: "" },
        { json: "dynamic", js: "dynamic", typ: r("LambdaErrorsAPIDynamic") },
        { json: "evaluation_periods", js: "evaluation_periods", typ: 0 },
        { json: "metric_query", js: "metric_query", typ: a(r("LambdaErrorsAPIMetricQuery")) },
        { json: "threshold", js: "threshold", typ: 0 },
        { json: "treat_missing_data", js: "treat_missing_data", typ: "" },
    ], false),
    "LambdaErrorsAPIDynamic": o([
        { json: "metric_query", js: "metric_query", typ: a(r("DynamicMetricQuery")) },
    ], false),
    "DynamicMetricQuery": o([
        { json: "content", js: "content", typ: a(r("Content")) },
        { json: "for_each", js: "for_each", typ: "" },
    ], false),
    "Content": o([
        { json: "id", js: "id", typ: "" },
        { json: "metric", js: "metric", typ: a(r("Metric")) },
    ], false),
    "Metric": o([
        { json: "dimensions", js: "dimensions", typ: r("MetricDimensions") },
        { json: "metric_name", js: "metric_name", typ: "" },
        { json: "namespace", js: "namespace", typ: "" },
        { json: "period", js: "period", typ: 0 },
        { json: "stat", js: "stat", typ: "" },
    ], false),
    "MetricDimensions": o([
        { json: "FunctionName", js: "FunctionName", typ: "" },
    ], false),
    "LambdaErrorsAPIMetricQuery": o([
        { json: "expression", js: "expression", typ: "" },
        { json: "id", js: "id", typ: "" },
        { json: "label", js: "label", typ: "" },
        { json: "return_data", js: "return_data", typ: true },
    ], false),
    "AwsCodepipeline": o([
        { json: "ios_e2e_tests", js: "ios_e2e_tests", typ: a(r("AwsCodepipelineIosE2ETest")) },
    ], false),
    "AwsCodepipelineIosE2ETest": o([
        { json: "artifact_store", js: "artifact_store", typ: a(r("ArtifactStore")) },
        { json: "name", js: "name", typ: "" },
        { json: "pipeline_type", js: "pipeline_type", typ: "" },
        { json: "role_arn", js: "role_arn", typ: "" },
        { json: "stage", js: "stage", typ: a(r("Stage")) },
        { json: "tags", js: "tags", typ: "" },
    ], false),
    "ArtifactStore": o([
        { json: "location", js: "location", typ: "" },
        { json: "type", js: "type", typ: "" },
    ], false),
    "Stage": o([
        { json: "action", js: "action", typ: a(r("ActionElement")) },
        { json: "name", js: "name", typ: "" },
    ], false),
    "ActionElement": o([
        { json: "category", js: "category", typ: "" },
        { json: "configuration", js: "configuration", typ: r("Configuration") },
        { json: "name", js: "name", typ: "" },
        { json: "output_artifacts", js: "output_artifacts", typ: u(undefined, a("")) },
        { json: "owner", js: "owner", typ: "" },
        { json: "provider", js: "provider", typ: "" },
        { json: "version", js: "version", typ: "" },
        { json: "input_artifacts", js: "input_artifacts", typ: u(undefined, a("")) },
    ], false),
    "Configuration": o([
        { json: "PollForSourceChanges", js: "PollForSourceChanges", typ: u(undefined, "") },
        { json: "S3Bucket", js: "S3Bucket", typ: u(undefined, "") },
        { json: "S3ObjectKey", js: "S3ObjectKey", typ: u(undefined, "") },
        { json: "CustomData", js: "CustomData", typ: u(undefined, "") },
        { json: "ExternalEntityLink", js: "ExternalEntityLink", typ: u(undefined, "") },
        { json: "App", js: "App", typ: u(undefined, "") },
        { json: "AppType", js: "AppType", typ: u(undefined, "") },
        { json: "DevicePoolArn", js: "DevicePoolArn", typ: u(undefined, "") },
        { json: "ProjectId", js: "ProjectId", typ: u(undefined, "") },
        { json: "Test", js: "Test", typ: u(undefined, "") },
        { json: "TestType", js: "TestType", typ: u(undefined, "") },
    ], false),
    "AwsDevicefarmDevicePool": o([
        { json: "latest_iphone", js: "latest_iphone", typ: a(r("LatestIphone")) },
    ], false),
    "LatestIphone": o([
        { json: "description", js: "description", typ: "" },
        { json: "max_devices", js: "max_devices", typ: 0 },
        { json: "name", js: "name", typ: "" },
        { json: "project_arn", js: "project_arn", typ: "" },
        { json: "rule", js: "rule", typ: a(r("LatestIphoneRule")) },
        { json: "tags", js: "tags", typ: r("Tags") },
    ], false),
    "LatestIphoneRule": o([
        { json: "attribute", js: "attribute", typ: "" },
        { json: "operator", js: "operator", typ: "" },
        { json: "value", js: "value", typ: "" },
    ], false),
    "AwsDevicefarmProject": o([
        { json: "ios_e2e_tests", js: "ios_e2e_tests", typ: a(r("AwsDevicefarmProjectIosE2ETest")) },
    ], false),
    "AwsDevicefarmProjectIosE2ETest": o([
        { json: "default_job_timeout_minutes", js: "default_job_timeout_minutes", typ: 0 },
        { json: "name", js: "name", typ: "" },
        { json: "tags", js: "tags", typ: "" },
    ], false),
    "AwsDsqlCluster": o([
        { json: "media_downloader", js: "media_downloader", typ: a(r("MediaDownloaderElement")) },
    ], false),
    "MediaDownloaderElement": o([
        { json: "deletion_protection_enabled", js: "deletion_protection_enabled", typ: true },
        { json: "tags", js: "tags", typ: "" },
    ], false),
    "AwsDynamodbTable": o([
        { json: "IdempotencyTable", js: "IdempotencyTable", typ: a(r("IdempotencyTable")) },
    ], false),
    "IdempotencyTable": o([
        { json: "attribute", js: "attribute", typ: a(r("Attribute")) },
        { json: "billing_mode", js: "billing_mode", typ: "" },
        { json: "hash_key", js: "hash_key", typ: "" },
        { json: "name", js: "name", typ: "" },
        { json: "tags", js: "tags", typ: "" },
        { json: "ttl", js: "ttl", typ: a(r("TTL")) },
    ], false),
    "Attribute": o([
        { json: "name", js: "name", typ: "" },
        { json: "type", js: "type", typ: "" },
    ], false),
    "TTL": o([
        { json: "attribute_name", js: "attribute_name", typ: "" },
        { json: "enabled", js: "enabled", typ: true },
    ], false),
    "AwsIamPolicy": o([
        { json: "name", js: "name", typ: "" },
        { json: "policy", js: "policy", typ: "" },
        { json: "tags", js: "tags", typ: r("Tags") },
        { json: "description", js: "description", typ: u(undefined, "") },
    ], false),
    "AwsIamRole": o([
        { json: "assume_role_policy", js: "assume_role_policy", typ: "" },
        { json: "name", js: "name", typ: "" },
        { json: "tags", js: "tags", typ: r("Tags") },
    ], false),
    "AwsIamRolePolicy": o([
        { json: "name", js: "name", typ: "" },
        { json: "policy", js: "policy", typ: "" },
        { json: "role", js: "role", typ: "" },
    ], false),
    "AwsIamRolePolicyAttachment": o([
        { json: "policy_arn", js: "policy_arn", typ: "" },
        { json: "role", js: "role", typ: "" },
    ], false),
    "AwsLambdaEventSourceMapping": o([
        { json: "SendPushNotification", js: "SendPushNotification", typ: a(r("SendPushNotification")) },
        { json: "StartFileUploadSQS", js: "StartFileUploadSQS", typ: a(r("SendPushNotification")) },
    ], false),
    "SendPushNotification": o([
        { json: "event_source_arn", js: "event_source_arn", typ: "" },
        { json: "function_name", js: "function_name", typ: "" },
        { json: "function_response_types", js: "function_response_types", typ: a("") },
        { json: "batch_size", js: "batch_size", typ: u(undefined, 0) },
    ], false),
    "AwsLambdaFunction": o([
        { json: "ApiGatewayAuthorizer", js: "ApiGatewayAuthorizer", typ: a(r("CleanupExpiredRecordElement")) },
        { json: "CleanupExpiredRecords", js: "CleanupExpiredRecords", typ: a(r("CleanupExpiredRecordElement")) },
        { json: "CloudfrontMiddleware", js: "CloudfrontMiddleware", typ: a(r("CloudfrontMiddleware")) },
        { json: "DeviceEvent", js: "DeviceEvent", typ: a(r("CleanupExpiredRecordElement")) },
        { json: "ListFiles", js: "ListFiles", typ: a(r("CleanupExpiredRecordElement")) },
        { json: "LoginUser", js: "LoginUser", typ: a(r("CleanupExpiredRecordElement")) },
        { json: "MigrateDSQL", js: "MigrateDSQL", typ: a(r("CleanupExpiredRecordElement")) },
        { json: "PruneDevices", js: "PruneDevices", typ: a(r("CleanupExpiredRecordElement")) },
        { json: "RefreshToken", js: "RefreshToken", typ: a(r("CleanupExpiredRecordElement")) },
        { json: "RegisterDevice", js: "RegisterDevice", typ: a(r("CleanupExpiredRecordElement")) },
        { json: "RegisterUser", js: "RegisterUser", typ: a(r("CleanupExpiredRecordElement")) },
        { json: "S3ObjectCreated", js: "S3ObjectCreated", typ: a(r("CleanupExpiredRecordElement")) },
        { json: "SendPushNotification", js: "SendPushNotification", typ: a(r("CleanupExpiredRecordElement")) },
        { json: "StartFileUpload", js: "StartFileUpload", typ: a(r("CleanupExpiredRecordElement")) },
        { json: "UserDelete", js: "UserDelete", typ: a(r("CleanupExpiredRecordElement")) },
        { json: "UserSubscribe", js: "UserSubscribe", typ: a(r("CleanupExpiredRecordElement")) },
        { json: "WebhookFeedly", js: "WebhookFeedly", typ: a(r("CleanupExpiredRecordElement")) },
    ], false),
    "CleanupExpiredRecordElement": o([
        { json: "architectures", js: "architectures", typ: a(r("Architecture")) },
        { json: "depends_on", js: "depends_on", typ: a("") },
        { json: "description", js: "description", typ: "" },
        { json: "environment", js: "environment", typ: a(r("Environment")) },
        { json: "filename", js: "filename", typ: "" },
        { json: "function_name", js: "function_name", typ: "" },
        { json: "handler", js: "handler", typ: r("Handler") },
        { json: "layers", js: "layers", typ: a(r("Layer")) },
        { json: "role", js: "role", typ: "" },
        { json: "runtime", js: "runtime", typ: r("Runtime") },
        { json: "source_code_hash", js: "source_code_hash", typ: "" },
        { json: "tags", js: "tags", typ: "" },
        { json: "timeout", js: "timeout", typ: u(undefined, 0) },
        { json: "tracing_config", js: "tracing_config", typ: a(r("TracingConfig")) },
        { json: "memory_size", js: "memory_size", typ: u(undefined, 0) },
        { json: "ephemeral_storage", js: "ephemeral_storage", typ: u(undefined, a(r("EphemeralStorage"))) },
        { json: "reserved_concurrent_executions", js: "reserved_concurrent_executions", typ: u(undefined, 0) },
    ], false),
    "Environment": o([
        { json: "variables", js: "variables", typ: "" },
    ], false),
    "EphemeralStorage": o([
        { json: "size", js: "size", typ: 0 },
    ], false),
    "TracingConfig": o([
        { json: "mode", js: "mode", typ: r("Mode") },
    ], false),
    "CloudfrontMiddleware": o([
        { json: "description", js: "description", typ: "" },
        { json: "filename", js: "filename", typ: "" },
        { json: "function_name", js: "function_name", typ: "" },
        { json: "handler", js: "handler", typ: r("Handler") },
        { json: "provider", js: "provider", typ: "" },
        { json: "publish", js: "publish", typ: true },
        { json: "role", js: "role", typ: "" },
        { json: "runtime", js: "runtime", typ: r("Runtime") },
        { json: "source_code_hash", js: "source_code_hash", typ: "" },
        { json: "tags", js: "tags", typ: "" },
        { json: "tracing_config", js: "tracing_config", typ: a(r("TracingConfig")) },
    ], false),
    "AwsLambdaLayerVersion": o([
        { json: "Ffmpeg", js: "Ffmpeg", typ: a(r("Ffmpeg")) },
        { json: "YtDlp", js: "YtDlp", typ: a(r("Ffmpeg")) },
    ], false),
    "Ffmpeg": o([
        { json: "compatible_runtimes", js: "compatible_runtimes", typ: a(r("Runtime")) },
        { json: "description", js: "description", typ: "" },
        { json: "filename", js: "filename", typ: "" },
        { json: "layer_name", js: "layer_name", typ: "" },
        { json: "source_code_hash", js: "source_code_hash", typ: "" },
    ], false),
    "AwsLambdaPermission": o([
        { json: "action", js: "action", typ: r("ActionEnum") },
        { json: "function_name", js: "function_name", typ: "" },
        { json: "principal", js: "principal", typ: r("PrincipalEnum") },
        { json: "source_arn", js: "source_arn", typ: u(undefined, "") },
    ], false),
    "AwsS3Bucket": o([
        { json: "Files", js: "Files", typ: a(r("File")) },
        { json: "e2e_test_artifacts", js: "e2e_test_artifacts", typ: a(r("File")) },
    ], false),
    "File": o([
        { json: "bucket", js: "bucket", typ: "" },
        { json: "tags", js: "tags", typ: "" },
    ], false),
    "AwsS3BucketIntelligentTieringConfiguration": o([
        { json: "FilesTiering", js: "FilesTiering", typ: a(r("FilesTiering")) },
    ], false),
    "FilesTiering": o([
        { json: "bucket", js: "bucket", typ: "" },
        { json: "name", js: "name", typ: "" },
        { json: "tiering", js: "tiering", typ: a(r("Tiering")) },
    ], false),
    "Tiering": o([
        { json: "access_tier", js: "access_tier", typ: "" },
        { json: "days", js: "days", typ: 0 },
    ], false),
    "AwsS3BucketLifecycleConfiguration": o([
        { json: "e2e_test_artifacts", js: "e2e_test_artifacts", typ: a(r("AwsS3BucketLifecycleConfigurationE2ETestArtifact")) },
    ], false),
    "AwsS3BucketLifecycleConfigurationE2ETestArtifact": o([
        { json: "bucket", js: "bucket", typ: "" },
        { json: "rule", js: "rule", typ: a(r("E2ETestArtifactRule")) },
    ], false),
    "E2ETestArtifactRule": o([
        { json: "expiration", js: "expiration", typ: a(r("Expiration")) },
        { json: "filter", js: "filter", typ: a(r("Filter")) },
        { json: "id", js: "id", typ: "" },
        { json: "noncurrent_version_expiration", js: "noncurrent_version_expiration", typ: u(undefined, a(r("NoncurrentVersionExpiration"))) },
        { json: "status", js: "status", typ: "" },
    ], false),
    "Expiration": o([
        { json: "days", js: "days", typ: 0 },
    ], false),
    "Filter": o([
        { json: "prefix", js: "prefix", typ: "" },
    ], false),
    "NoncurrentVersionExpiration": o([
        { json: "noncurrent_days", js: "noncurrent_days", typ: 0 },
    ], false),
    "AwsS3BucketNotification": o([
        { json: "Files", js: "Files", typ: a(r("AwsS3BucketNotificationFile")) },
    ], false),
    "AwsS3BucketNotificationFile": o([
        { json: "bucket", js: "bucket", typ: "" },
        { json: "lambda_function", js: "lambda_function", typ: a(r("LambdaFunction")) },
    ], false),
    "LambdaFunction": o([
        { json: "events", js: "events", typ: a("") },
        { json: "lambda_function_arn", js: "lambda_function_arn", typ: "" },
    ], false),
    "AwsS3BucketPolicy": o([
        { json: "CloudfrontAccess", js: "CloudfrontAccess", typ: a(r("CloudfrontAccess")) },
    ], false),
    "CloudfrontAccess": o([
        { json: "bucket", js: "bucket", typ: "" },
        { json: "policy", js: "policy", typ: "" },
    ], false),
    "AwsS3BucketPublicAccessBlock": o([
        { json: "e2e_test_artifacts", js: "e2e_test_artifacts", typ: a(r("AwsS3BucketPublicAccessBlockE2ETestArtifact")) },
    ], false),
    "AwsS3BucketPublicAccessBlockE2ETestArtifact": o([
        { json: "block_public_acls", js: "block_public_acls", typ: true },
        { json: "block_public_policy", js: "block_public_policy", typ: true },
        { json: "bucket", js: "bucket", typ: "" },
        { json: "ignore_public_acls", js: "ignore_public_acls", typ: true },
        { json: "restrict_public_buckets", js: "restrict_public_buckets", typ: true },
    ], false),
    "AwsS3BucketVersioning": o([
        { json: "e2e_test_artifacts", js: "e2e_test_artifacts", typ: a(r("AwsS3BucketVersioningE2ETestArtifact")) },
    ], false),
    "AwsS3BucketVersioningE2ETestArtifact": o([
        { json: "bucket", js: "bucket", typ: "" },
        { json: "versioning_configuration", js: "versioning_configuration", typ: a(r("VersioningConfiguration")) },
    ], false),
    "VersioningConfiguration": o([
        { json: "status", js: "status", typ: "" },
    ], false),
    "AwsS3Object": o([
        { json: "DefaultFile", js: "DefaultFile", typ: a(r("AwsS3ObjectDefaultFile")) },
    ], false),
    "AwsS3ObjectDefaultFile": o([
        { json: "acl", js: "acl", typ: "" },
        { json: "bucket", js: "bucket", typ: "" },
        { json: "content_type", js: "content_type", typ: "" },
        { json: "etag", js: "etag", typ: "" },
        { json: "key", js: "key", typ: "" },
        { json: "source", js: "source", typ: "" },
    ], false),
    "AwsSnsPlatformApplication": o([
        { json: "OfflineMediaDownloader", js: "OfflineMediaDownloader", typ: a(r("OfflineMediaDownloader")) },
    ], false),
    "OfflineMediaDownloader": o([
        { json: "count", js: "count", typ: 0 },
        { json: "failure_feedback_role_arn", js: "failure_feedback_role_arn", typ: "" },
        { json: "name", js: "name", typ: "" },
        { json: "platform", js: "platform", typ: "" },
        { json: "platform_credential", js: "platform_credential", typ: "" },
        { json: "platform_principal", js: "platform_principal", typ: "" },
        { json: "success_feedback_role_arn", js: "success_feedback_role_arn", typ: "" },
    ], false),
    "AwsSnsTopic": o([
        { json: "PushNotifications", js: "PushNotifications", typ: a(r("PushNotification")) },
    ], false),
    "PushNotification": o([
        { json: "name", js: "name", typ: "" },
    ], false),
    "AwsSqsQueue": o([
        { json: "DownloadDLQ", js: "DownloadDLQ", typ: a(r("Dlq")) },
        { json: "DownloadQueue", js: "DownloadQueue", typ: a(r("DownloadQueue")) },
        { json: "SendPushNotification", js: "SendPushNotification", typ: a(r("AwsSqsQueueSendPushNotification")) },
        { json: "SendPushNotificationDLQ", js: "SendPushNotificationDLQ", typ: a(r("Dlq")) },
    ], false),
    "Dlq": o([
        { json: "message_retention_seconds", js: "message_retention_seconds", typ: 0 },
        { json: "name", js: "name", typ: "" },
        { json: "tags", js: "tags", typ: "" },
    ], false),
    "DownloadQueue": o([
        { json: "delay_seconds", js: "delay_seconds", typ: 0 },
        { json: "max_message_size", js: "max_message_size", typ: 0 },
        { json: "message_retention_seconds", js: "message_retention_seconds", typ: 0 },
        { json: "name", js: "name", typ: "" },
        { json: "receive_wait_time_seconds", js: "receive_wait_time_seconds", typ: 0 },
        { json: "redrive_policy", js: "redrive_policy", typ: "" },
        { json: "tags", js: "tags", typ: "" },
        { json: "visibility_timeout_seconds", js: "visibility_timeout_seconds", typ: "" },
    ], false),
    "AwsSqsQueueSendPushNotification": o([
        { json: "delay_seconds", js: "delay_seconds", typ: 0 },
        { json: "max_message_size", js: "max_message_size", typ: 0 },
        { json: "message_retention_seconds", js: "message_retention_seconds", typ: 0 },
        { json: "name", js: "name", typ: "" },
        { json: "receive_wait_time_seconds", js: "receive_wait_time_seconds", typ: 0 },
        { json: "redrive_policy", js: "redrive_policy", typ: "" },
        { json: "tags", js: "tags", typ: r("Tags") },
        { json: "visibility_timeout_seconds", js: "visibility_timeout_seconds", typ: 0 },
    ], false),
    "AwsSqsQueuePolicy": o([
        { json: "DownloadQueueEventBridge", js: "DownloadQueueEventBridge", typ: a(r("DownloadQueueEventBridge")) },
    ], false),
    "DownloadQueueEventBridge": o([
        { json: "policy", js: "policy", typ: "" },
        { json: "queue_url", js: "queue_url", typ: "" },
    ], false),
    "NullResource": o([
        { json: "DownloadFfmpegBinary", js: "DownloadFfmpegBinary", typ: a(r("DownloadBinary")) },
        { json: "DownloadYtDlpBinary", js: "DownloadYtDlpBinary", typ: a(r("DownloadBinary")) },
    ], false),
    "DownloadBinary": o([
        { json: "provisioner", js: "provisioner", typ: r("Provisioner") },
        { json: "triggers", js: "triggers", typ: r("DownloadFfmpegBinaryTriggers") },
    ], false),
    "Provisioner": o([
        { json: "local-exec", js: "local-exec", typ: a(r("LocalExec")) },
    ], false),
    "LocalExec": o([
        { json: "command", js: "command", typ: "" },
    ], false),
    "DownloadFfmpegBinaryTriggers": o([
        { json: "version", js: "version", typ: "" },
    ], false),
    "TimeSleep": o([
        { json: "wait_for_dsql", js: "wait_for_dsql", typ: a(r("WaitForDsql")) },
    ], false),
    "WaitForDsql": o([
        { json: "create_duration", js: "create_duration", typ: "" },
        { json: "depends_on", js: "depends_on", typ: a("") },
    ], false),
    "Terraform": o([
        { json: "required_providers", js: "required_providers", typ: a(r("RequiredProvider")) },
    ], false),
    "RequiredProvider": o([
        { json: "aws", js: "aws", typ: r("AwsClass") },
        { json: "http", js: "http", typ: r("AwsClass") },
        { json: "sops", js: "sops", typ: r("AwsClass") },
    ], false),
    "AwsClass": o([
        { json: "source", js: "source", typ: "" },
        { json: "version", js: "version", typ: "" },
    ], false),
    "Variable": o([
        { json: "budget_notification_email", js: "budget_notification_email", typ: a(r("BudgetNotificationEmail")) },
    ], false),
    "BudgetNotificationEmail": o([
        { json: "default", js: "default", typ: "" },
        { json: "description", js: "description", typ: "" },
        { json: "type", js: "type", typ: "" },
    ], false),
    "Type": [
        "zip",
    ],
    "Tags": [
        "${local.common_tags}",
    ],
    "APIID": [
        "${aws_api_gateway_rest_api.Main.id}",
    ],
    "ParentID": [
        "${aws_api_gateway_rest_api.Main.root_resource_id}",
        "${aws_api_gateway_resource.Device.id}",
        "${aws_api_gateway_resource.User.id}",
    ],
    "Architecture": [
        "${local.lambda_architecture}",
        "x86_64",
    ],
    "Handler": [
        "index.handler",
    ],
    "Layer": [
        "${aws_lambda_layer_version.Ffmpeg.arn}",
        "${aws_lambda_layer_version.YtDlp.arn}",
        "${local.adot_layer_arn}",
        "${local.adot_layer_arn_x86_64}",
    ],
    "Runtime": [
        "nodejs24.x",
    ],
    "Mode": [
        "Active",
    ],
    "ActionEnum": [
        "lambda:InvokeFunction",
    ],
    "PrincipalEnum": [
        "apigateway.amazonaws.com",
        "events.amazonaws.com",
        "s3.amazonaws.com",
    ],
};
