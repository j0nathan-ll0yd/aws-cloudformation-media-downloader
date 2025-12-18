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
}

export interface Data {
    archive_file:            ArchiveFile;
    aws_caller_identity:     Aws;
    aws_iam_policy_document: AwsIamPolicyDocument;
    aws_region:              Aws;
    http:                    HTTP;
    local_file:              LocalFile;
    sops_file:               SopsFile;
}

export interface ArchiveFile {
    ApiGatewayAuthorizer: SendPushNotificationElement[];
    CloudfrontMiddleware: SendPushNotificationElement[];
    FfmpegLayer:          Layer[];
    FileCoordinator:      SendPushNotificationElement[];
    ListFiles:            SendPushNotificationElement[];
    LogClientEvent:       SendPushNotificationElement[];
    LoginUser:            SendPushNotificationElement[];
    PruneDevices:         SendPushNotificationElement[];
    RegisterDevice:       SendPushNotificationElement[];
    RegisterUser:         SendPushNotificationElement[];
    S3ObjectCreated:      SendPushNotificationElement[];
    SendPushNotification: SendPushNotificationElement[];
    StartFileUpload:      SendPushNotificationElement[];
    UserDelete:           SendPushNotificationElement[];
    UserSubscribe:        SendPushNotificationElement[];
    WebhookFeedly:        SendPushNotificationElement[];
    YtDlpLayer:           Layer[];
}

export interface SendPushNotificationElement {
    output_path: string;
    source_file: string;
    type:        APIGatewayAuthorizerType;
}

export enum APIGatewayAuthorizerType {
    Zip = "zip",
}

export interface Layer {
    depends_on:  string[];
    output_path: string;
    source_dir:  string;
    type:        APIGatewayAuthorizerType;
}

export interface Aws {
    current: Current[];
}

export interface Current {
}

export interface AwsIamPolicyDocument {
    ApiGatewayAuthorizer:           APIGatewayAuthorizerRolePolicyElement[];
    ApiGatewayAuthorizerRolePolicy: APIGatewayAuthorizerRolePolicyElement[];
    ApiGatewayCloudwatchRole:       APIGatewayCloudwatchRole[];
    CommonLambdaLogging:            APIGatewayAuthorizerRolePolicyElement[];
    CommonLambdaXRay:               APIGatewayAuthorizerRolePolicyElement[];
    FileCoordinator:                APIGatewayAuthorizerRolePolicyElement[];
    LambdaAssumeRole:               AssumeRole[];
    LambdaGatewayAssumeRole:        AssumeRole[];
    LamdbaEdgeAssumeRole:           AssumeRole[];
    ListFiles:                      APIGatewayAuthorizerRolePolicyElement[];
    LoginUser:                      APIGatewayAuthorizerRolePolicyElement[];
    MultipartUpload:                APIGatewayAuthorizerRolePolicyElement[];
    PruneDevices:                   PruneDevice[];
    RegisterDevice:                 RegisterDevice[];
    RegisterUser:                   APIGatewayAuthorizerRolePolicyElement[];
    S3ObjectCreated:                APIGatewayAuthorizerRolePolicyElement[];
    SNSAssumeRole:                  AssumeRole[];
    SendPushNotification:           PruneDevice[];
    StatesAssumeRole:               AssumeRole[];
    UserDelete:                     PruneDevice[];
    UserSubscribe:                  UserSubscribe[];
    WebhookFeedlyRole:              APIGatewayAuthorizerRolePolicyElement[];
}

export interface APIGatewayAuthorizerRolePolicyElement {
    statement: Ent[];
}

export interface Ent {
    actions:   string[];
    resources: string[];
}

export interface APIGatewayCloudwatchRole {
    statement: APIGatewayCloudwatchRoleStatement[];
}

export interface APIGatewayCloudwatchRoleStatement {
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

export interface PruneDevice {
    dynamic:   Dynamic;
    statement: Ent[];
}

export interface Dynamic {
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
    resources: string[] | string;
}

export interface UserSubscribe {
    statement: UserSubscribeStatement[];
}

export interface UserSubscribeStatement {
    actions:   string[];
    resources: string;
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
    lambda_functions: string[];
}

export interface Output {
    api_gateway_api_key:            APIGatewayAPIKey[];
    api_gateway_stage:              APIGatewayStage[];
    api_gateway_subdomain:          APIGatewayStage[];
    cloudfront_distribution_domain: APIGatewayStage[];
    cloudfront_media_files_domain:  APIGatewayStage[];
    cloudwatch_dashboard_url:       APIGatewayStage[];
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
    aws_api_gateway_account:              AwsAPIGatewayAccount;
    aws_api_gateway_api_key:              AwsAPIGatewayAPIKey;
    aws_api_gateway_authorizer:           AwsAPIGatewayAuthorizer;
    aws_api_gateway_deployment:           AwsAPIGatewayDeployment;
    aws_api_gateway_gateway_response:     AwsAPIGatewayGatewayResponse;
    aws_api_gateway_integration:          AwsAPIGatewayIntegration;
    aws_api_gateway_method:               AwsAPIGatewayMethod;
    aws_api_gateway_method_settings:      AwsAPIGatewayMethodSettings;
    aws_api_gateway_resource:             AwsAPIGatewayResource;
    aws_api_gateway_rest_api:             AwsAPIGatewayRESTAPI;
    aws_api_gateway_stage:                AwsAPIGatewayStage;
    aws_api_gateway_usage_plan:           AwsAPIGatewayUsagePlan;
    aws_api_gateway_usage_plan_key:       AwsAPIGatewayUsagePlanKey;
    aws_cloudfront_distribution:          AwsCloudfrontDistribution;
    aws_cloudfront_origin_access_control: AwsCloudfrontOriginAccessControl;
    aws_cloudwatch_dashboard:             AwsCloudwatchDashboard;
    aws_cloudwatch_event_rule:            AwsCloudwatchEventRule;
    aws_cloudwatch_event_target:          AwsCloudwatchEventTarget;
    aws_cloudwatch_log_group:             { [key: string]: AwsCloudwatchLogGroup[] };
    aws_dynamodb_table:                   AwsDynamodbTable;
    aws_iam_policy:                       AwsIamPolicy;
    aws_iam_role:                         { [key: string]: AwsIamRole[] };
    aws_iam_role_policy:                  AwsIamRolePolicy;
    aws_iam_role_policy_attachment:       { [key: string]: AwsIamRolePolicyAttachment[] };
    aws_lambda_event_source_mapping:      AwsLambdaEventSourceMapping;
    aws_lambda_function:                  AwsLambdaFunction;
    aws_lambda_layer_version:             AwsLambdaLayerVersion;
    aws_lambda_permission:                { [key: string]: AwsLambdaPermission[] };
    aws_s3_bucket:                        AwsS3Bucket;
    aws_s3_bucket_notification:           AwsS3BucketNotification;
    aws_s3_bucket_policy:                 AwsS3BucketPolicy;
    aws_s3_object:                        AwsS3Object;
    aws_sns_platform_application:         AwsSnsPlatformApplication;
    aws_sns_topic:                        AwsSnsTopic;
    aws_sqs_queue:                        AwsSqsQueue;
    null_resource:                        NullResource;
}

export interface AwsAPIGatewayAccount {
    Main: AwsAPIGatewayAccountMain[];
}

export interface AwsAPIGatewayAccountMain {
    cloudwatch_role_arn: string;
}

export interface AwsAPIGatewayAPIKey {
    iOSApp: AwsAPIGatewayAPIKeyIOSApp[];
}

export interface AwsAPIGatewayAPIKeyIOSApp {
    description: string;
    enabled:     boolean;
    name:        string;
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
    rest_api_id:                      string;
    type:                             string;
}

export interface AwsAPIGatewayDeployment {
    Main: AwsAPIGatewayDeploymentMain[];
}

export interface AwsAPIGatewayDeploymentMain {
    depends_on:  string[];
    lifecycle:   Lifecycle[];
    rest_api_id: string;
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
    response_templates: ResponseTemplates;
    response_type:      string;
    rest_api_id:        string;
}

export interface ResponseTemplates {
    "application/json": string;
}

export interface AwsAPIGatewayIntegration {
    ListFilesGet:       AwsAPIGatewayIntegrationListFilesGet[];
    LogClientEventPost: AwsAPIGatewayIntegrationListFilesGet[];
    LoginUserPost:      AwsAPIGatewayIntegrationListFilesGet[];
    RegisterDevicePost: AwsAPIGatewayIntegrationListFilesGet[];
    RegisterUserPost:   AwsAPIGatewayIntegrationListFilesGet[];
    UserDeletePost:     AwsAPIGatewayIntegrationListFilesGet[];
    UserSubscribePost:  AwsAPIGatewayIntegrationListFilesGet[];
    WebhookFeedlyPost:  AwsAPIGatewayIntegrationListFilesGet[];
}

export interface AwsAPIGatewayIntegrationListFilesGet {
    http_method:             string;
    integration_http_method: string;
    resource_id:             string;
    rest_api_id:             string;
    type:                    string;
    uri:                     string;
}

export interface AwsAPIGatewayMethod {
    ListFilesGet:       AwsAPIGatewayMethodListFilesGet[];
    LogClientEventPost: AwsAPIGatewayMethodListFilesGet[];
    LoginUserPost:      AwsAPIGatewayMethodListFilesGet[];
    RegisterDevicePost: AwsAPIGatewayMethodListFilesGet[];
    RegisterUserPost:   AwsAPIGatewayMethodListFilesGet[];
    UserDeletePost:     AwsAPIGatewayMethodListFilesGet[];
    UserSubscribePost:  AwsAPIGatewayMethodListFilesGet[];
    WebhookFeedlyPost:  AwsAPIGatewayMethodListFilesGet[];
}

export interface AwsAPIGatewayMethodListFilesGet {
    api_key_required: boolean;
    authorization:    string;
    authorizer_id?:   string;
    http_method:      string;
    resource_id:      string;
    rest_api_id:      string;
}

export interface AwsAPIGatewayMethodSettings {
    Production: AwsAPIGatewayMethodSettingsProduction[];
}

export interface AwsAPIGatewayMethodSettingsProduction {
    method_path: string;
    rest_api_id: string;
    settings:    Setting[];
    stage_name:  string;
}

export interface Setting {
    data_trace_enabled: boolean;
    logging_level:      string;
    metrics_enabled:    boolean;
}

export interface AwsAPIGatewayResource {
    Feedly:         Feedly[];
    Files:          Feedly[];
    LogEvent:       Feedly[];
    Login:          Feedly[];
    RegisterDevice: Feedly[];
    RegisterUser:   Feedly[];
    UserDelete:     Feedly[];
    UserSubscribe:  Feedly[];
}

export interface Feedly {
    parent_id:   string;
    path_part:   string;
    rest_api_id: string;
}

export interface AwsAPIGatewayRESTAPI {
    Main: AwsAPIGatewayRESTAPIMain[];
}

export interface AwsAPIGatewayRESTAPIMain {
    api_key_source:         string;
    description:            string;
    endpoint_configuration: EndpointConfiguration[];
    name:                   string;
}

export interface EndpointConfiguration {
    types: string[];
}

export interface AwsAPIGatewayStage {
    Production: AwsAPIGatewayStageProduction[];
}

export interface AwsAPIGatewayStageProduction {
    deployment_id:        string;
    rest_api_id:          string;
    stage_name:           string;
    xray_tracing_enabled: boolean;
}

export interface AwsAPIGatewayUsagePlan {
    iOSApp: AwsAPIGatewayUsagePlanIOSApp[];
}

export interface AwsAPIGatewayUsagePlanIOSApp {
    api_stages:  APIStage[];
    description: string;
    name:        string;
}

export interface APIStage {
    api_id: string;
    stage:  string;
}

export interface AwsAPIGatewayUsagePlanKey {
    iOSApp: AwsAPIGatewayUsagePlanKeyIOSApp[];
}

export interface AwsAPIGatewayUsagePlanKeyIOSApp {
    key_id:        string;
    key_type:      string;
    usage_plan_id: string;
}

export interface AwsCloudfrontDistribution {
    Production:  AwsCloudfrontDistributionProduction[];
    media_files: MediaFile[];
}

export interface AwsCloudfrontDistributionProduction {
    comment:                string;
    default_cache_behavior: ProductionDefaultCacheBehavior[];
    enabled:                boolean;
    origin:                 ProductionOrigin[];
    restrictions:           Restriction[];
    viewer_certificate:     ViewerCertificate[];
}

export interface ProductionDefaultCacheBehavior {
    allowed_methods:             string[];
    cached_methods:              string[];
    default_ttl:                 number;
    forwarded_values:            PurpleForwardedValue[];
    lambda_function_association: LambdaFunctionAssociation[];
    max_ttl:                     number;
    min_ttl:                     number;
    target_origin_id:            string;
    viewer_protocol_policy:      string;
}

export interface PurpleForwardedValue {
    cookies:      Cooky[];
    headers:      string[];
    query_string: boolean;
}

export interface Cooky {
    forward: string;
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

export interface MediaFile {
    default_cache_behavior: MediaFileDefaultCacheBehavior[];
    default_root_object:    string;
    enabled:                boolean;
    origin:                 MediaFileOrigin[];
    price_class:            string;
    restrictions:           Restriction[];
    tags:                   MediaFileTags;
    viewer_certificate:     ViewerCertificate[];
}

export interface MediaFileDefaultCacheBehavior {
    allowed_methods:        string[];
    cached_methods:         string[];
    default_ttl:            number;
    forwarded_values:       FluffyForwardedValue[];
    max_ttl:                number;
    min_ttl:                number;
    target_origin_id:       string;
    viewer_protocol_policy: string;
}

export interface FluffyForwardedValue {
    cookies:      Cooky[];
    query_string: boolean;
}

export interface MediaFileOrigin {
    domain_name:              string;
    origin_access_control_id: string;
    origin_id:                string;
}

export interface MediaFileTags {
    Name: string;
}

export interface AwsCloudfrontOriginAccessControl {
    media_files_oac: MediaFilesOac[];
}

export interface MediaFilesOac {
    description:                       string;
    name:                              string;
    origin_access_control_origin_type: string;
    signing_behavior:                  string;
    signing_protocol:                  string;
}

export interface AwsCloudwatchDashboard {
    main: Main[];
}

export interface Main {
    dashboard_body: string;
    dashboard_name: string;
}

export interface AwsCloudwatchEventRule {
    FileCoordinator: AwsCloudwatchEventRuleFileCoordinator[];
    PruneDevices:    AwsCloudwatchEventRuleFileCoordinator[];
}

export interface AwsCloudwatchEventRuleFileCoordinator {
    name:                string;
    schedule_expression: string;
    state:               string;
}

export interface AwsCloudwatchEventTarget {
    FileCoordinator: AwsCloudwatchEventTargetFileCoordinator[];
    PruneDevices:    AwsCloudwatchEventTargetFileCoordinator[];
}

export interface AwsCloudwatchEventTargetFileCoordinator {
    arn:  string;
    rule: string;
}

export interface AwsCloudwatchLogGroup {
    name:              string;
    retention_in_days: number;
}

export interface AwsDynamodbTable {
    MediaDownloader: MediaDownloader[];
}

export interface MediaDownloader {
    attribute:              Attribute[];
    billing_mode:           string;
    global_secondary_index: GlobalSecondaryIndex[];
    hash_key:               string;
    name:                   string;
    range_key:              string;
    tags:                   MediaDownloaderTags;
}

export interface Attribute {
    name: string;
    type: AttributeType;
}

export enum AttributeType {
    N = "N",
    S = "S",
}

export interface GlobalSecondaryIndex {
    hash_key:        string;
    name:            string;
    projection_type: string;
    range_key?:      string;
}

export interface MediaDownloaderTags {
    Description: string;
    Name:        string;
}

export interface AwsIamPolicy {
    ApiGatewayAuthorizerRolePolicy: RolePolicy[];
    CommonLambdaLogging:            CommonLambda[];
    CommonLambdaXRay:               CommonLambda[];
    FileCoordinatorRolePolicy:      RolePolicy[];
    ListFilesRolePolicy:            RolePolicy[];
    LoginUserRolePolicy:            RolePolicy[];
    MultipartUploadRolePolicy:      RolePolicy[];
    PruneDevicesRolePolicy:         RolePolicy[];
    RegisterDeviceRolePolicy:       RolePolicy[];
    RegisterUserRolePolicy:         RolePolicy[];
    S3ObjectCreatedRolePolicy:      RolePolicy[];
    SendPushNotificationRolePolicy: RolePolicy[];
    UserDeleteRolePolicy:           RolePolicy[];
    UserSubscribeRolePolicy:        RolePolicy[];
    WebhookFeedlyRolePolicy:        RolePolicy[];
}

export interface RolePolicy {
    name:   string;
    policy: string;
}

export interface CommonLambda {
    description: string;
    name:        string;
    policy:      string;
}

export interface AwsIamRole {
    assume_role_policy: string;
    name:               string;
}

export interface AwsIamRolePolicy {
    ApiGatewayAuthorize:            APIGateway[];
    ApiGatewayCloudwatchRolePolicy: APIGateway[];
}

export interface APIGateway {
    name:   string;
    policy: string;
    role:   string;
}

export interface AwsIamRolePolicyAttachment {
    policy_arn: string;
    role:       string;
}

export interface AwsLambdaEventSourceMapping {
    SendPushNotification: AwsLambdaEventSourceMappingSendPushNotification[];
}

export interface AwsLambdaEventSourceMappingSendPushNotification {
    event_source_arn: string;
    function_name:    string;
}

export interface AwsLambdaFunction {
    ApiGatewayAuthorizer: AwsLambdaFunctionAPIGatewayAuthorizer[];
    CloudfrontMiddleware: AwsLambdaFunctionAPIGatewayAuthorizer[];
    FileCoordinator:      SendPushNotificationClass[];
    ListFiles:            ListFile[];
    LogClientEvent:       AwsLambdaFunctionAPIGatewayAuthorizer[];
    LoginUser:            AwsLambdaFunctionAPIGatewayAuthorizer[];
    PruneDevices:         AwsLambdaFunctionAPIGatewayAuthorizer[];
    RegisterDevice:       AwsLambdaFunctionAPIGatewayAuthorizer[];
    RegisterUser:         AwsLambdaFunctionAPIGatewayAuthorizer[];
    S3ObjectCreated:      AwsLambdaFunctionAPIGatewayAuthorizer[];
    SendPushNotification: SendPushNotificationClass[];
    StartFileUpload:      StartFileUpload[];
    UserDelete:           AwsLambdaFunctionAPIGatewayAuthorizer[];
    UserSubscribe:        AwsLambdaFunctionAPIGatewayAuthorizer[];
    WebhookFeedly:        AwsLambdaFunctionAPIGatewayAuthorizer[];
}

export interface AwsLambdaFunctionAPIGatewayAuthorizer {
    depends_on?:      string[];
    description:      string;
    environment?:     APIGatewayAuthorizerEnvironment[];
    filename:         string;
    function_name:    string;
    handler:          string;
    role:             string;
    runtime:          Runtime;
    source_code_hash: string;
    tracing_config:   TracingConfig[];
    provider?:        string;
    publish?:         boolean;
    timeout?:         number;
    memory_size?:     number;
}

export interface APIGatewayAuthorizerEnvironment {
    variables: PurpleVariables;
}

export interface PurpleVariables {
    DynamoDBTableName?:            string;
    MultiAuthenticationPathParts?: string;
    ReservedClientIp?:             string;
    ApplicationUrl?:               string;
    BetterAuthSecret?:             string;
    SignInWithAppleConfig?:        string;
    ApnsDefaultTopic?:             string;
    ApnsKeyId?:                    string;
    ApnsSigningKey?:               string;
    ApnsTeam?:                     string;
    PlatformApplicationArn?:       string;
    PushNotificationTopicArn?:     string;
    SNSQueueUrl?:                  string;
    GithubPersonalToken?:          string;
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

export interface SendPushNotificationClass {
    depends_on:       string[];
    description:      string;
    environment:      FileCoordinatorEnvironment[];
    filename:         string;
    function_name:    string;
    handler:          string;
    memory_size?:     number;
    role:             string;
    runtime:          Runtime;
    source_code_hash: string;
    tracing_config:   TracingConfig[];
}

export interface FileCoordinatorEnvironment {
    variables: FluffyVariables;
}

export interface FluffyVariables {
    DynamoDBTableName: string;
}

export interface ListFile {
    depends_on:       string[];
    description:      string;
    environment:      ListFileEnvironment[];
    filename:         string;
    function_name:    string;
    handler:          string;
    memory_size:      number;
    role:             string;
    runtime:          Runtime;
    source_code_hash: string;
    tracing_config:   TracingConfig[];
}

export interface ListFileEnvironment {
    variables: TentacledVariables;
}

export interface TentacledVariables {
    DefaultFileContentType: string;
    DefaultFileName:        string;
    DefaultFileSize:        number;
    DefaultFileUrl:         string;
    DynamoDBTableName:      string;
}

export interface StartFileUpload {
    depends_on:                     string[];
    description:                    string;
    environment:                    StartFileUploadEnvironment[];
    ephemeral_storage:              EphemeralStorage[];
    filename:                       string;
    function_name:                  string;
    handler:                        string;
    layers:                         string[];
    memory_size:                    number;
    reserved_concurrent_executions: number;
    role:                           string;
    runtime:                        Runtime;
    source_code_hash:               string;
    timeout:                        number;
    tracing_config:                 TracingConfig[];
}

export interface StartFileUploadEnvironment {
    variables: StickyVariables;
}

export interface StickyVariables {
    Bucket:              string;
    CloudfrontDomain:    string;
    DynamoDBTableName:   string;
    GithubPersonalToken: string;
    PATH:                string;
    SNSQueueUrl:         string;
    YtdlpBinaryPath:     string;
}

export interface EphemeralStorage {
    size: number;
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
    action:        Action;
    function_name: string;
    principal:     PrincipalEnum;
    source_arn?:   string;
}

export enum Action {
    LambdaInvokeFunction = "lambda:InvokeFunction",
}

export enum PrincipalEnum {
    ApigatewayAmazonawsCOM = "apigateway.amazonaws.com",
    EventsAmazonawsCOM = "events.amazonaws.com",
    S3AmazonawsCOM = "s3.amazonaws.com",
}

export interface AwsS3Bucket {
    Files: AwsS3BucketFile[];
}

export interface AwsS3BucketFile {
    bucket: string;
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
    cloudfront_access: CloudfrontAccess[];
}

export interface CloudfrontAccess {
    bucket: string;
    policy: string;
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
    SendPushNotification: AwsSqsQueueSendPushNotification[];
}

export interface AwsSqsQueueSendPushNotification {
    delay_seconds:             number;
    max_message_size:          number;
    message_retention_seconds: number;
    name:                      string;
    receive_wait_time_seconds: number;
    tags:                      SendPushNotificationTags;
}

export interface SendPushNotificationTags {
    Environment: string;
}

export interface NullResource {
    DownloadFfmpegBinary: DownloadFfmpegBinary[];
    DownloadYtDlpBinary:  DownloadYtDLPBinary[];
}

export interface DownloadFfmpegBinary {
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
    ffmpeg_exists: string;
}

export interface DownloadYtDLPBinary {
    provisioner: Provisioner;
    triggers:    DownloadYtDLPBinaryTriggers;
}

export interface DownloadYtDLPBinaryTriggers {
    version: string;
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
    ], false),
    "Data": o([
        { json: "archive_file", js: "archive_file", typ: r("ArchiveFile") },
        { json: "aws_caller_identity", js: "aws_caller_identity", typ: r("Aws") },
        { json: "aws_iam_policy_document", js: "aws_iam_policy_document", typ: r("AwsIamPolicyDocument") },
        { json: "aws_region", js: "aws_region", typ: r("Aws") },
        { json: "http", js: "http", typ: r("HTTP") },
        { json: "local_file", js: "local_file", typ: r("LocalFile") },
        { json: "sops_file", js: "sops_file", typ: r("SopsFile") },
    ], false),
    "ArchiveFile": o([
        { json: "ApiGatewayAuthorizer", js: "ApiGatewayAuthorizer", typ: a(r("SendPushNotificationElement")) },
        { json: "CloudfrontMiddleware", js: "CloudfrontMiddleware", typ: a(r("SendPushNotificationElement")) },
        { json: "FfmpegLayer", js: "FfmpegLayer", typ: a(r("Layer")) },
        { json: "FileCoordinator", js: "FileCoordinator", typ: a(r("SendPushNotificationElement")) },
        { json: "ListFiles", js: "ListFiles", typ: a(r("SendPushNotificationElement")) },
        { json: "LogClientEvent", js: "LogClientEvent", typ: a(r("SendPushNotificationElement")) },
        { json: "LoginUser", js: "LoginUser", typ: a(r("SendPushNotificationElement")) },
        { json: "PruneDevices", js: "PruneDevices", typ: a(r("SendPushNotificationElement")) },
        { json: "RegisterDevice", js: "RegisterDevice", typ: a(r("SendPushNotificationElement")) },
        { json: "RegisterUser", js: "RegisterUser", typ: a(r("SendPushNotificationElement")) },
        { json: "S3ObjectCreated", js: "S3ObjectCreated", typ: a(r("SendPushNotificationElement")) },
        { json: "SendPushNotification", js: "SendPushNotification", typ: a(r("SendPushNotificationElement")) },
        { json: "StartFileUpload", js: "StartFileUpload", typ: a(r("SendPushNotificationElement")) },
        { json: "UserDelete", js: "UserDelete", typ: a(r("SendPushNotificationElement")) },
        { json: "UserSubscribe", js: "UserSubscribe", typ: a(r("SendPushNotificationElement")) },
        { json: "WebhookFeedly", js: "WebhookFeedly", typ: a(r("SendPushNotificationElement")) },
        { json: "YtDlpLayer", js: "YtDlpLayer", typ: a(r("Layer")) },
    ], false),
    "SendPushNotificationElement": o([
        { json: "output_path", js: "output_path", typ: "" },
        { json: "source_file", js: "source_file", typ: "" },
        { json: "type", js: "type", typ: r("APIGatewayAuthorizerType") },
    ], false),
    "Layer": o([
        { json: "depends_on", js: "depends_on", typ: a("") },
        { json: "output_path", js: "output_path", typ: "" },
        { json: "source_dir", js: "source_dir", typ: "" },
        { json: "type", js: "type", typ: r("APIGatewayAuthorizerType") },
    ], false),
    "Aws": o([
        { json: "current", js: "current", typ: a(r("Current")) },
    ], false),
    "Current": o([
    ], false),
    "AwsIamPolicyDocument": o([
        { json: "ApiGatewayAuthorizer", js: "ApiGatewayAuthorizer", typ: a(r("APIGatewayAuthorizerRolePolicyElement")) },
        { json: "ApiGatewayAuthorizerRolePolicy", js: "ApiGatewayAuthorizerRolePolicy", typ: a(r("APIGatewayAuthorizerRolePolicyElement")) },
        { json: "ApiGatewayCloudwatchRole", js: "ApiGatewayCloudwatchRole", typ: a(r("APIGatewayCloudwatchRole")) },
        { json: "CommonLambdaLogging", js: "CommonLambdaLogging", typ: a(r("APIGatewayAuthorizerRolePolicyElement")) },
        { json: "CommonLambdaXRay", js: "CommonLambdaXRay", typ: a(r("APIGatewayAuthorizerRolePolicyElement")) },
        { json: "FileCoordinator", js: "FileCoordinator", typ: a(r("APIGatewayAuthorizerRolePolicyElement")) },
        { json: "LambdaAssumeRole", js: "LambdaAssumeRole", typ: a(r("AssumeRole")) },
        { json: "LambdaGatewayAssumeRole", js: "LambdaGatewayAssumeRole", typ: a(r("AssumeRole")) },
        { json: "LamdbaEdgeAssumeRole", js: "LamdbaEdgeAssumeRole", typ: a(r("AssumeRole")) },
        { json: "ListFiles", js: "ListFiles", typ: a(r("APIGatewayAuthorizerRolePolicyElement")) },
        { json: "LoginUser", js: "LoginUser", typ: a(r("APIGatewayAuthorizerRolePolicyElement")) },
        { json: "MultipartUpload", js: "MultipartUpload", typ: a(r("APIGatewayAuthorizerRolePolicyElement")) },
        { json: "PruneDevices", js: "PruneDevices", typ: a(r("PruneDevice")) },
        { json: "RegisterDevice", js: "RegisterDevice", typ: a(r("RegisterDevice")) },
        { json: "RegisterUser", js: "RegisterUser", typ: a(r("APIGatewayAuthorizerRolePolicyElement")) },
        { json: "S3ObjectCreated", js: "S3ObjectCreated", typ: a(r("APIGatewayAuthorizerRolePolicyElement")) },
        { json: "SNSAssumeRole", js: "SNSAssumeRole", typ: a(r("AssumeRole")) },
        { json: "SendPushNotification", js: "SendPushNotification", typ: a(r("PruneDevice")) },
        { json: "StatesAssumeRole", js: "StatesAssumeRole", typ: a(r("AssumeRole")) },
        { json: "UserDelete", js: "UserDelete", typ: a(r("PruneDevice")) },
        { json: "UserSubscribe", js: "UserSubscribe", typ: a(r("UserSubscribe")) },
        { json: "WebhookFeedlyRole", js: "WebhookFeedlyRole", typ: a(r("APIGatewayAuthorizerRolePolicyElement")) },
    ], false),
    "APIGatewayAuthorizerRolePolicyElement": o([
        { json: "statement", js: "statement", typ: a(r("Ent")) },
    ], false),
    "Ent": o([
        { json: "actions", js: "actions", typ: a("") },
        { json: "resources", js: "resources", typ: a("") },
    ], false),
    "APIGatewayCloudwatchRole": o([
        { json: "statement", js: "statement", typ: a(r("APIGatewayCloudwatchRoleStatement")) },
    ], false),
    "APIGatewayCloudwatchRoleStatement": o([
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
    "PruneDevice": o([
        { json: "dynamic", js: "dynamic", typ: r("Dynamic") },
        { json: "statement", js: "statement", typ: a(r("Ent")) },
    ], false),
    "Dynamic": o([
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
        { json: "resources", js: "resources", typ: u(a(""), "") },
    ], false),
    "UserSubscribe": o([
        { json: "statement", js: "statement", typ: a(r("UserSubscribeStatement")) },
    ], false),
    "UserSubscribeStatement": o([
        { json: "actions", js: "actions", typ: a("") },
        { json: "resources", js: "resources", typ: "" },
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
        { json: "lambda_functions", js: "lambda_functions", typ: a("") },
    ], false),
    "Output": o([
        { json: "api_gateway_api_key", js: "api_gateway_api_key", typ: a(r("APIGatewayAPIKey")) },
        { json: "api_gateway_stage", js: "api_gateway_stage", typ: a(r("APIGatewayStage")) },
        { json: "api_gateway_subdomain", js: "api_gateway_subdomain", typ: a(r("APIGatewayStage")) },
        { json: "cloudfront_distribution_domain", js: "cloudfront_distribution_domain", typ: a(r("APIGatewayStage")) },
        { json: "cloudfront_media_files_domain", js: "cloudfront_media_files_domain", typ: a(r("APIGatewayStage")) },
        { json: "cloudwatch_dashboard_url", js: "cloudwatch_dashboard_url", typ: a(r("APIGatewayStage")) },
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
        { json: "aws_cloudfront_distribution", js: "aws_cloudfront_distribution", typ: r("AwsCloudfrontDistribution") },
        { json: "aws_cloudfront_origin_access_control", js: "aws_cloudfront_origin_access_control", typ: r("AwsCloudfrontOriginAccessControl") },
        { json: "aws_cloudwatch_dashboard", js: "aws_cloudwatch_dashboard", typ: r("AwsCloudwatchDashboard") },
        { json: "aws_cloudwatch_event_rule", js: "aws_cloudwatch_event_rule", typ: r("AwsCloudwatchEventRule") },
        { json: "aws_cloudwatch_event_target", js: "aws_cloudwatch_event_target", typ: r("AwsCloudwatchEventTarget") },
        { json: "aws_cloudwatch_log_group", js: "aws_cloudwatch_log_group", typ: m(a(r("AwsCloudwatchLogGroup"))) },
        { json: "aws_dynamodb_table", js: "aws_dynamodb_table", typ: r("AwsDynamodbTable") },
        { json: "aws_iam_policy", js: "aws_iam_policy", typ: r("AwsIamPolicy") },
        { json: "aws_iam_role", js: "aws_iam_role", typ: m(a(r("AwsIamRole"))) },
        { json: "aws_iam_role_policy", js: "aws_iam_role_policy", typ: r("AwsIamRolePolicy") },
        { json: "aws_iam_role_policy_attachment", js: "aws_iam_role_policy_attachment", typ: m(a(r("AwsIamRolePolicyAttachment"))) },
        { json: "aws_lambda_event_source_mapping", js: "aws_lambda_event_source_mapping", typ: r("AwsLambdaEventSourceMapping") },
        { json: "aws_lambda_function", js: "aws_lambda_function", typ: r("AwsLambdaFunction") },
        { json: "aws_lambda_layer_version", js: "aws_lambda_layer_version", typ: r("AwsLambdaLayerVersion") },
        { json: "aws_lambda_permission", js: "aws_lambda_permission", typ: m(a(r("AwsLambdaPermission"))) },
        { json: "aws_s3_bucket", js: "aws_s3_bucket", typ: r("AwsS3Bucket") },
        { json: "aws_s3_bucket_notification", js: "aws_s3_bucket_notification", typ: r("AwsS3BucketNotification") },
        { json: "aws_s3_bucket_policy", js: "aws_s3_bucket_policy", typ: r("AwsS3BucketPolicy") },
        { json: "aws_s3_object", js: "aws_s3_object", typ: r("AwsS3Object") },
        { json: "aws_sns_platform_application", js: "aws_sns_platform_application", typ: r("AwsSnsPlatformApplication") },
        { json: "aws_sns_topic", js: "aws_sns_topic", typ: r("AwsSnsTopic") },
        { json: "aws_sqs_queue", js: "aws_sqs_queue", typ: r("AwsSqsQueue") },
        { json: "null_resource", js: "null_resource", typ: r("NullResource") },
    ], false),
    "AwsAPIGatewayAccount": o([
        { json: "Main", js: "Main", typ: a(r("AwsAPIGatewayAccountMain")) },
    ], false),
    "AwsAPIGatewayAccountMain": o([
        { json: "cloudwatch_role_arn", js: "cloudwatch_role_arn", typ: "" },
    ], false),
    "AwsAPIGatewayAPIKey": o([
        { json: "iOSApp", js: "iOSApp", typ: a(r("AwsAPIGatewayAPIKeyIOSApp")) },
    ], false),
    "AwsAPIGatewayAPIKeyIOSApp": o([
        { json: "description", js: "description", typ: "" },
        { json: "enabled", js: "enabled", typ: true },
        { json: "name", js: "name", typ: "" },
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
        { json: "rest_api_id", js: "rest_api_id", typ: "" },
        { json: "type", js: "type", typ: "" },
    ], false),
    "AwsAPIGatewayDeployment": o([
        { json: "Main", js: "Main", typ: a(r("AwsAPIGatewayDeploymentMain")) },
    ], false),
    "AwsAPIGatewayDeploymentMain": o([
        { json: "depends_on", js: "depends_on", typ: a("") },
        { json: "lifecycle", js: "lifecycle", typ: a(r("Lifecycle")) },
        { json: "rest_api_id", js: "rest_api_id", typ: "" },
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
        { json: "response_templates", js: "response_templates", typ: r("ResponseTemplates") },
        { json: "response_type", js: "response_type", typ: "" },
        { json: "rest_api_id", js: "rest_api_id", typ: "" },
    ], false),
    "ResponseTemplates": o([
        { json: "application/json", js: "application/json", typ: "" },
    ], false),
    "AwsAPIGatewayIntegration": o([
        { json: "ListFilesGet", js: "ListFilesGet", typ: a(r("AwsAPIGatewayIntegrationListFilesGet")) },
        { json: "LogClientEventPost", js: "LogClientEventPost", typ: a(r("AwsAPIGatewayIntegrationListFilesGet")) },
        { json: "LoginUserPost", js: "LoginUserPost", typ: a(r("AwsAPIGatewayIntegrationListFilesGet")) },
        { json: "RegisterDevicePost", js: "RegisterDevicePost", typ: a(r("AwsAPIGatewayIntegrationListFilesGet")) },
        { json: "RegisterUserPost", js: "RegisterUserPost", typ: a(r("AwsAPIGatewayIntegrationListFilesGet")) },
        { json: "UserDeletePost", js: "UserDeletePost", typ: a(r("AwsAPIGatewayIntegrationListFilesGet")) },
        { json: "UserSubscribePost", js: "UserSubscribePost", typ: a(r("AwsAPIGatewayIntegrationListFilesGet")) },
        { json: "WebhookFeedlyPost", js: "WebhookFeedlyPost", typ: a(r("AwsAPIGatewayIntegrationListFilesGet")) },
    ], false),
    "AwsAPIGatewayIntegrationListFilesGet": o([
        { json: "http_method", js: "http_method", typ: "" },
        { json: "integration_http_method", js: "integration_http_method", typ: "" },
        { json: "resource_id", js: "resource_id", typ: "" },
        { json: "rest_api_id", js: "rest_api_id", typ: "" },
        { json: "type", js: "type", typ: "" },
        { json: "uri", js: "uri", typ: "" },
    ], false),
    "AwsAPIGatewayMethod": o([
        { json: "ListFilesGet", js: "ListFilesGet", typ: a(r("AwsAPIGatewayMethodListFilesGet")) },
        { json: "LogClientEventPost", js: "LogClientEventPost", typ: a(r("AwsAPIGatewayMethodListFilesGet")) },
        { json: "LoginUserPost", js: "LoginUserPost", typ: a(r("AwsAPIGatewayMethodListFilesGet")) },
        { json: "RegisterDevicePost", js: "RegisterDevicePost", typ: a(r("AwsAPIGatewayMethodListFilesGet")) },
        { json: "RegisterUserPost", js: "RegisterUserPost", typ: a(r("AwsAPIGatewayMethodListFilesGet")) },
        { json: "UserDeletePost", js: "UserDeletePost", typ: a(r("AwsAPIGatewayMethodListFilesGet")) },
        { json: "UserSubscribePost", js: "UserSubscribePost", typ: a(r("AwsAPIGatewayMethodListFilesGet")) },
        { json: "WebhookFeedlyPost", js: "WebhookFeedlyPost", typ: a(r("AwsAPIGatewayMethodListFilesGet")) },
    ], false),
    "AwsAPIGatewayMethodListFilesGet": o([
        { json: "api_key_required", js: "api_key_required", typ: true },
        { json: "authorization", js: "authorization", typ: "" },
        { json: "authorizer_id", js: "authorizer_id", typ: u(undefined, "") },
        { json: "http_method", js: "http_method", typ: "" },
        { json: "resource_id", js: "resource_id", typ: "" },
        { json: "rest_api_id", js: "rest_api_id", typ: "" },
    ], false),
    "AwsAPIGatewayMethodSettings": o([
        { json: "Production", js: "Production", typ: a(r("AwsAPIGatewayMethodSettingsProduction")) },
    ], false),
    "AwsAPIGatewayMethodSettingsProduction": o([
        { json: "method_path", js: "method_path", typ: "" },
        { json: "rest_api_id", js: "rest_api_id", typ: "" },
        { json: "settings", js: "settings", typ: a(r("Setting")) },
        { json: "stage_name", js: "stage_name", typ: "" },
    ], false),
    "Setting": o([
        { json: "data_trace_enabled", js: "data_trace_enabled", typ: true },
        { json: "logging_level", js: "logging_level", typ: "" },
        { json: "metrics_enabled", js: "metrics_enabled", typ: true },
    ], false),
    "AwsAPIGatewayResource": o([
        { json: "Feedly", js: "Feedly", typ: a(r("Feedly")) },
        { json: "Files", js: "Files", typ: a(r("Feedly")) },
        { json: "LogEvent", js: "LogEvent", typ: a(r("Feedly")) },
        { json: "Login", js: "Login", typ: a(r("Feedly")) },
        { json: "RegisterDevice", js: "RegisterDevice", typ: a(r("Feedly")) },
        { json: "RegisterUser", js: "RegisterUser", typ: a(r("Feedly")) },
        { json: "UserDelete", js: "UserDelete", typ: a(r("Feedly")) },
        { json: "UserSubscribe", js: "UserSubscribe", typ: a(r("Feedly")) },
    ], false),
    "Feedly": o([
        { json: "parent_id", js: "parent_id", typ: "" },
        { json: "path_part", js: "path_part", typ: "" },
        { json: "rest_api_id", js: "rest_api_id", typ: "" },
    ], false),
    "AwsAPIGatewayRESTAPI": o([
        { json: "Main", js: "Main", typ: a(r("AwsAPIGatewayRESTAPIMain")) },
    ], false),
    "AwsAPIGatewayRESTAPIMain": o([
        { json: "api_key_source", js: "api_key_source", typ: "" },
        { json: "description", js: "description", typ: "" },
        { json: "endpoint_configuration", js: "endpoint_configuration", typ: a(r("EndpointConfiguration")) },
        { json: "name", js: "name", typ: "" },
    ], false),
    "EndpointConfiguration": o([
        { json: "types", js: "types", typ: a("") },
    ], false),
    "AwsAPIGatewayStage": o([
        { json: "Production", js: "Production", typ: a(r("AwsAPIGatewayStageProduction")) },
    ], false),
    "AwsAPIGatewayStageProduction": o([
        { json: "deployment_id", js: "deployment_id", typ: "" },
        { json: "rest_api_id", js: "rest_api_id", typ: "" },
        { json: "stage_name", js: "stage_name", typ: "" },
        { json: "xray_tracing_enabled", js: "xray_tracing_enabled", typ: true },
    ], false),
    "AwsAPIGatewayUsagePlan": o([
        { json: "iOSApp", js: "iOSApp", typ: a(r("AwsAPIGatewayUsagePlanIOSApp")) },
    ], false),
    "AwsAPIGatewayUsagePlanIOSApp": o([
        { json: "api_stages", js: "api_stages", typ: a(r("APIStage")) },
        { json: "description", js: "description", typ: "" },
        { json: "name", js: "name", typ: "" },
    ], false),
    "APIStage": o([
        { json: "api_id", js: "api_id", typ: "" },
        { json: "stage", js: "stage", typ: "" },
    ], false),
    "AwsAPIGatewayUsagePlanKey": o([
        { json: "iOSApp", js: "iOSApp", typ: a(r("AwsAPIGatewayUsagePlanKeyIOSApp")) },
    ], false),
    "AwsAPIGatewayUsagePlanKeyIOSApp": o([
        { json: "key_id", js: "key_id", typ: "" },
        { json: "key_type", js: "key_type", typ: "" },
        { json: "usage_plan_id", js: "usage_plan_id", typ: "" },
    ], false),
    "AwsCloudfrontDistribution": o([
        { json: "Production", js: "Production", typ: a(r("AwsCloudfrontDistributionProduction")) },
        { json: "media_files", js: "media_files", typ: a(r("MediaFile")) },
    ], false),
    "AwsCloudfrontDistributionProduction": o([
        { json: "comment", js: "comment", typ: "" },
        { json: "default_cache_behavior", js: "default_cache_behavior", typ: a(r("ProductionDefaultCacheBehavior")) },
        { json: "enabled", js: "enabled", typ: true },
        { json: "origin", js: "origin", typ: a(r("ProductionOrigin")) },
        { json: "restrictions", js: "restrictions", typ: a(r("Restriction")) },
        { json: "viewer_certificate", js: "viewer_certificate", typ: a(r("ViewerCertificate")) },
    ], false),
    "ProductionDefaultCacheBehavior": o([
        { json: "allowed_methods", js: "allowed_methods", typ: a("") },
        { json: "cached_methods", js: "cached_methods", typ: a("") },
        { json: "default_ttl", js: "default_ttl", typ: 0 },
        { json: "forwarded_values", js: "forwarded_values", typ: a(r("PurpleForwardedValue")) },
        { json: "lambda_function_association", js: "lambda_function_association", typ: a(r("LambdaFunctionAssociation")) },
        { json: "max_ttl", js: "max_ttl", typ: 0 },
        { json: "min_ttl", js: "min_ttl", typ: 0 },
        { json: "target_origin_id", js: "target_origin_id", typ: "" },
        { json: "viewer_protocol_policy", js: "viewer_protocol_policy", typ: "" },
    ], false),
    "PurpleForwardedValue": o([
        { json: "cookies", js: "cookies", typ: a(r("Cooky")) },
        { json: "headers", js: "headers", typ: a("") },
        { json: "query_string", js: "query_string", typ: true },
    ], false),
    "Cooky": o([
        { json: "forward", js: "forward", typ: "" },
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
    "MediaFile": o([
        { json: "default_cache_behavior", js: "default_cache_behavior", typ: a(r("MediaFileDefaultCacheBehavior")) },
        { json: "default_root_object", js: "default_root_object", typ: "" },
        { json: "enabled", js: "enabled", typ: true },
        { json: "origin", js: "origin", typ: a(r("MediaFileOrigin")) },
        { json: "price_class", js: "price_class", typ: "" },
        { json: "restrictions", js: "restrictions", typ: a(r("Restriction")) },
        { json: "tags", js: "tags", typ: r("MediaFileTags") },
        { json: "viewer_certificate", js: "viewer_certificate", typ: a(r("ViewerCertificate")) },
    ], false),
    "MediaFileDefaultCacheBehavior": o([
        { json: "allowed_methods", js: "allowed_methods", typ: a("") },
        { json: "cached_methods", js: "cached_methods", typ: a("") },
        { json: "default_ttl", js: "default_ttl", typ: 0 },
        { json: "forwarded_values", js: "forwarded_values", typ: a(r("FluffyForwardedValue")) },
        { json: "max_ttl", js: "max_ttl", typ: 0 },
        { json: "min_ttl", js: "min_ttl", typ: 0 },
        { json: "target_origin_id", js: "target_origin_id", typ: "" },
        { json: "viewer_protocol_policy", js: "viewer_protocol_policy", typ: "" },
    ], false),
    "FluffyForwardedValue": o([
        { json: "cookies", js: "cookies", typ: a(r("Cooky")) },
        { json: "query_string", js: "query_string", typ: true },
    ], false),
    "MediaFileOrigin": o([
        { json: "domain_name", js: "domain_name", typ: "" },
        { json: "origin_access_control_id", js: "origin_access_control_id", typ: "" },
        { json: "origin_id", js: "origin_id", typ: "" },
    ], false),
    "MediaFileTags": o([
        { json: "Name", js: "Name", typ: "" },
    ], false),
    "AwsCloudfrontOriginAccessControl": o([
        { json: "media_files_oac", js: "media_files_oac", typ: a(r("MediaFilesOac")) },
    ], false),
    "MediaFilesOac": o([
        { json: "description", js: "description", typ: "" },
        { json: "name", js: "name", typ: "" },
        { json: "origin_access_control_origin_type", js: "origin_access_control_origin_type", typ: "" },
        { json: "signing_behavior", js: "signing_behavior", typ: "" },
        { json: "signing_protocol", js: "signing_protocol", typ: "" },
    ], false),
    "AwsCloudwatchDashboard": o([
        { json: "main", js: "main", typ: a(r("Main")) },
    ], false),
    "Main": o([
        { json: "dashboard_body", js: "dashboard_body", typ: "" },
        { json: "dashboard_name", js: "dashboard_name", typ: "" },
    ], false),
    "AwsCloudwatchEventRule": o([
        { json: "FileCoordinator", js: "FileCoordinator", typ: a(r("AwsCloudwatchEventRuleFileCoordinator")) },
        { json: "PruneDevices", js: "PruneDevices", typ: a(r("AwsCloudwatchEventRuleFileCoordinator")) },
    ], false),
    "AwsCloudwatchEventRuleFileCoordinator": o([
        { json: "name", js: "name", typ: "" },
        { json: "schedule_expression", js: "schedule_expression", typ: "" },
        { json: "state", js: "state", typ: "" },
    ], false),
    "AwsCloudwatchEventTarget": o([
        { json: "FileCoordinator", js: "FileCoordinator", typ: a(r("AwsCloudwatchEventTargetFileCoordinator")) },
        { json: "PruneDevices", js: "PruneDevices", typ: a(r("AwsCloudwatchEventTargetFileCoordinator")) },
    ], false),
    "AwsCloudwatchEventTargetFileCoordinator": o([
        { json: "arn", js: "arn", typ: "" },
        { json: "rule", js: "rule", typ: "" },
    ], false),
    "AwsCloudwatchLogGroup": o([
        { json: "name", js: "name", typ: "" },
        { json: "retention_in_days", js: "retention_in_days", typ: 0 },
    ], false),
    "AwsDynamodbTable": o([
        { json: "MediaDownloader", js: "MediaDownloader", typ: a(r("MediaDownloader")) },
    ], false),
    "MediaDownloader": o([
        { json: "attribute", js: "attribute", typ: a(r("Attribute")) },
        { json: "billing_mode", js: "billing_mode", typ: "" },
        { json: "global_secondary_index", js: "global_secondary_index", typ: a(r("GlobalSecondaryIndex")) },
        { json: "hash_key", js: "hash_key", typ: "" },
        { json: "name", js: "name", typ: "" },
        { json: "range_key", js: "range_key", typ: "" },
        { json: "tags", js: "tags", typ: r("MediaDownloaderTags") },
    ], false),
    "Attribute": o([
        { json: "name", js: "name", typ: "" },
        { json: "type", js: "type", typ: r("AttributeType") },
    ], false),
    "GlobalSecondaryIndex": o([
        { json: "hash_key", js: "hash_key", typ: "" },
        { json: "name", js: "name", typ: "" },
        { json: "projection_type", js: "projection_type", typ: "" },
        { json: "range_key", js: "range_key", typ: u(undefined, "") },
    ], false),
    "MediaDownloaderTags": o([
        { json: "Description", js: "Description", typ: "" },
        { json: "Name", js: "Name", typ: "" },
    ], false),
    "AwsIamPolicy": o([
        { json: "ApiGatewayAuthorizerRolePolicy", js: "ApiGatewayAuthorizerRolePolicy", typ: a(r("RolePolicy")) },
        { json: "CommonLambdaLogging", js: "CommonLambdaLogging", typ: a(r("CommonLambda")) },
        { json: "CommonLambdaXRay", js: "CommonLambdaXRay", typ: a(r("CommonLambda")) },
        { json: "FileCoordinatorRolePolicy", js: "FileCoordinatorRolePolicy", typ: a(r("RolePolicy")) },
        { json: "ListFilesRolePolicy", js: "ListFilesRolePolicy", typ: a(r("RolePolicy")) },
        { json: "LoginUserRolePolicy", js: "LoginUserRolePolicy", typ: a(r("RolePolicy")) },
        { json: "MultipartUploadRolePolicy", js: "MultipartUploadRolePolicy", typ: a(r("RolePolicy")) },
        { json: "PruneDevicesRolePolicy", js: "PruneDevicesRolePolicy", typ: a(r("RolePolicy")) },
        { json: "RegisterDeviceRolePolicy", js: "RegisterDeviceRolePolicy", typ: a(r("RolePolicy")) },
        { json: "RegisterUserRolePolicy", js: "RegisterUserRolePolicy", typ: a(r("RolePolicy")) },
        { json: "S3ObjectCreatedRolePolicy", js: "S3ObjectCreatedRolePolicy", typ: a(r("RolePolicy")) },
        { json: "SendPushNotificationRolePolicy", js: "SendPushNotificationRolePolicy", typ: a(r("RolePolicy")) },
        { json: "UserDeleteRolePolicy", js: "UserDeleteRolePolicy", typ: a(r("RolePolicy")) },
        { json: "UserSubscribeRolePolicy", js: "UserSubscribeRolePolicy", typ: a(r("RolePolicy")) },
        { json: "WebhookFeedlyRolePolicy", js: "WebhookFeedlyRolePolicy", typ: a(r("RolePolicy")) },
    ], false),
    "RolePolicy": o([
        { json: "name", js: "name", typ: "" },
        { json: "policy", js: "policy", typ: "" },
    ], false),
    "CommonLambda": o([
        { json: "description", js: "description", typ: "" },
        { json: "name", js: "name", typ: "" },
        { json: "policy", js: "policy", typ: "" },
    ], false),
    "AwsIamRole": o([
        { json: "assume_role_policy", js: "assume_role_policy", typ: "" },
        { json: "name", js: "name", typ: "" },
    ], false),
    "AwsIamRolePolicy": o([
        { json: "ApiGatewayAuthorize", js: "ApiGatewayAuthorize", typ: a(r("APIGateway")) },
        { json: "ApiGatewayCloudwatchRolePolicy", js: "ApiGatewayCloudwatchRolePolicy", typ: a(r("APIGateway")) },
    ], false),
    "APIGateway": o([
        { json: "name", js: "name", typ: "" },
        { json: "policy", js: "policy", typ: "" },
        { json: "role", js: "role", typ: "" },
    ], false),
    "AwsIamRolePolicyAttachment": o([
        { json: "policy_arn", js: "policy_arn", typ: "" },
        { json: "role", js: "role", typ: "" },
    ], false),
    "AwsLambdaEventSourceMapping": o([
        { json: "SendPushNotification", js: "SendPushNotification", typ: a(r("AwsLambdaEventSourceMappingSendPushNotification")) },
    ], false),
    "AwsLambdaEventSourceMappingSendPushNotification": o([
        { json: "event_source_arn", js: "event_source_arn", typ: "" },
        { json: "function_name", js: "function_name", typ: "" },
    ], false),
    "AwsLambdaFunction": o([
        { json: "ApiGatewayAuthorizer", js: "ApiGatewayAuthorizer", typ: a(r("AwsLambdaFunctionAPIGatewayAuthorizer")) },
        { json: "CloudfrontMiddleware", js: "CloudfrontMiddleware", typ: a(r("AwsLambdaFunctionAPIGatewayAuthorizer")) },
        { json: "FileCoordinator", js: "FileCoordinator", typ: a(r("SendPushNotificationClass")) },
        { json: "ListFiles", js: "ListFiles", typ: a(r("ListFile")) },
        { json: "LogClientEvent", js: "LogClientEvent", typ: a(r("AwsLambdaFunctionAPIGatewayAuthorizer")) },
        { json: "LoginUser", js: "LoginUser", typ: a(r("AwsLambdaFunctionAPIGatewayAuthorizer")) },
        { json: "PruneDevices", js: "PruneDevices", typ: a(r("AwsLambdaFunctionAPIGatewayAuthorizer")) },
        { json: "RegisterDevice", js: "RegisterDevice", typ: a(r("AwsLambdaFunctionAPIGatewayAuthorizer")) },
        { json: "RegisterUser", js: "RegisterUser", typ: a(r("AwsLambdaFunctionAPIGatewayAuthorizer")) },
        { json: "S3ObjectCreated", js: "S3ObjectCreated", typ: a(r("AwsLambdaFunctionAPIGatewayAuthorizer")) },
        { json: "SendPushNotification", js: "SendPushNotification", typ: a(r("SendPushNotificationClass")) },
        { json: "StartFileUpload", js: "StartFileUpload", typ: a(r("StartFileUpload")) },
        { json: "UserDelete", js: "UserDelete", typ: a(r("AwsLambdaFunctionAPIGatewayAuthorizer")) },
        { json: "UserSubscribe", js: "UserSubscribe", typ: a(r("AwsLambdaFunctionAPIGatewayAuthorizer")) },
        { json: "WebhookFeedly", js: "WebhookFeedly", typ: a(r("AwsLambdaFunctionAPIGatewayAuthorizer")) },
    ], false),
    "AwsLambdaFunctionAPIGatewayAuthorizer": o([
        { json: "depends_on", js: "depends_on", typ: u(undefined, a("")) },
        { json: "description", js: "description", typ: "" },
        { json: "environment", js: "environment", typ: u(undefined, a(r("APIGatewayAuthorizerEnvironment"))) },
        { json: "filename", js: "filename", typ: "" },
        { json: "function_name", js: "function_name", typ: "" },
        { json: "handler", js: "handler", typ: "" },
        { json: "role", js: "role", typ: "" },
        { json: "runtime", js: "runtime", typ: r("Runtime") },
        { json: "source_code_hash", js: "source_code_hash", typ: "" },
        { json: "tracing_config", js: "tracing_config", typ: a(r("TracingConfig")) },
        { json: "provider", js: "provider", typ: u(undefined, "") },
        { json: "publish", js: "publish", typ: u(undefined, true) },
        { json: "timeout", js: "timeout", typ: u(undefined, 0) },
        { json: "memory_size", js: "memory_size", typ: u(undefined, 0) },
    ], false),
    "APIGatewayAuthorizerEnvironment": o([
        { json: "variables", js: "variables", typ: r("PurpleVariables") },
    ], false),
    "PurpleVariables": o([
        { json: "DynamoDBTableName", js: "DynamoDBTableName", typ: u(undefined, "") },
        { json: "MultiAuthenticationPathParts", js: "MultiAuthenticationPathParts", typ: u(undefined, "") },
        { json: "ReservedClientIp", js: "ReservedClientIp", typ: u(undefined, "") },
        { json: "ApplicationUrl", js: "ApplicationUrl", typ: u(undefined, "") },
        { json: "BetterAuthSecret", js: "BetterAuthSecret", typ: u(undefined, "") },
        { json: "SignInWithAppleConfig", js: "SignInWithAppleConfig", typ: u(undefined, "") },
        { json: "ApnsDefaultTopic", js: "ApnsDefaultTopic", typ: u(undefined, "") },
        { json: "ApnsKeyId", js: "ApnsKeyId", typ: u(undefined, "") },
        { json: "ApnsSigningKey", js: "ApnsSigningKey", typ: u(undefined, "") },
        { json: "ApnsTeam", js: "ApnsTeam", typ: u(undefined, "") },
        { json: "PlatformApplicationArn", js: "PlatformApplicationArn", typ: u(undefined, "") },
        { json: "PushNotificationTopicArn", js: "PushNotificationTopicArn", typ: u(undefined, "") },
        { json: "SNSQueueUrl", js: "SNSQueueUrl", typ: u(undefined, "") },
        { json: "GithubPersonalToken", js: "GithubPersonalToken", typ: u(undefined, "") },
    ], false),
    "TracingConfig": o([
        { json: "mode", js: "mode", typ: r("Mode") },
    ], false),
    "SendPushNotificationClass": o([
        { json: "depends_on", js: "depends_on", typ: a("") },
        { json: "description", js: "description", typ: "" },
        { json: "environment", js: "environment", typ: a(r("FileCoordinatorEnvironment")) },
        { json: "filename", js: "filename", typ: "" },
        { json: "function_name", js: "function_name", typ: "" },
        { json: "handler", js: "handler", typ: "" },
        { json: "memory_size", js: "memory_size", typ: u(undefined, 0) },
        { json: "role", js: "role", typ: "" },
        { json: "runtime", js: "runtime", typ: r("Runtime") },
        { json: "source_code_hash", js: "source_code_hash", typ: "" },
        { json: "tracing_config", js: "tracing_config", typ: a(r("TracingConfig")) },
    ], false),
    "FileCoordinatorEnvironment": o([
        { json: "variables", js: "variables", typ: r("FluffyVariables") },
    ], false),
    "FluffyVariables": o([
        { json: "DynamoDBTableName", js: "DynamoDBTableName", typ: "" },
    ], false),
    "ListFile": o([
        { json: "depends_on", js: "depends_on", typ: a("") },
        { json: "description", js: "description", typ: "" },
        { json: "environment", js: "environment", typ: a(r("ListFileEnvironment")) },
        { json: "filename", js: "filename", typ: "" },
        { json: "function_name", js: "function_name", typ: "" },
        { json: "handler", js: "handler", typ: "" },
        { json: "memory_size", js: "memory_size", typ: 0 },
        { json: "role", js: "role", typ: "" },
        { json: "runtime", js: "runtime", typ: r("Runtime") },
        { json: "source_code_hash", js: "source_code_hash", typ: "" },
        { json: "tracing_config", js: "tracing_config", typ: a(r("TracingConfig")) },
    ], false),
    "ListFileEnvironment": o([
        { json: "variables", js: "variables", typ: r("TentacledVariables") },
    ], false),
    "TentacledVariables": o([
        { json: "DefaultFileContentType", js: "DefaultFileContentType", typ: "" },
        { json: "DefaultFileName", js: "DefaultFileName", typ: "" },
        { json: "DefaultFileSize", js: "DefaultFileSize", typ: 0 },
        { json: "DefaultFileUrl", js: "DefaultFileUrl", typ: "" },
        { json: "DynamoDBTableName", js: "DynamoDBTableName", typ: "" },
    ], false),
    "StartFileUpload": o([
        { json: "depends_on", js: "depends_on", typ: a("") },
        { json: "description", js: "description", typ: "" },
        { json: "environment", js: "environment", typ: a(r("StartFileUploadEnvironment")) },
        { json: "ephemeral_storage", js: "ephemeral_storage", typ: a(r("EphemeralStorage")) },
        { json: "filename", js: "filename", typ: "" },
        { json: "function_name", js: "function_name", typ: "" },
        { json: "handler", js: "handler", typ: "" },
        { json: "layers", js: "layers", typ: a("") },
        { json: "memory_size", js: "memory_size", typ: 0 },
        { json: "reserved_concurrent_executions", js: "reserved_concurrent_executions", typ: 0 },
        { json: "role", js: "role", typ: "" },
        { json: "runtime", js: "runtime", typ: r("Runtime") },
        { json: "source_code_hash", js: "source_code_hash", typ: "" },
        { json: "timeout", js: "timeout", typ: 0 },
        { json: "tracing_config", js: "tracing_config", typ: a(r("TracingConfig")) },
    ], false),
    "StartFileUploadEnvironment": o([
        { json: "variables", js: "variables", typ: r("StickyVariables") },
    ], false),
    "StickyVariables": o([
        { json: "Bucket", js: "Bucket", typ: "" },
        { json: "CloudfrontDomain", js: "CloudfrontDomain", typ: "" },
        { json: "DynamoDBTableName", js: "DynamoDBTableName", typ: "" },
        { json: "GithubPersonalToken", js: "GithubPersonalToken", typ: "" },
        { json: "PATH", js: "PATH", typ: "" },
        { json: "SNSQueueUrl", js: "SNSQueueUrl", typ: "" },
        { json: "YtdlpBinaryPath", js: "YtdlpBinaryPath", typ: "" },
    ], false),
    "EphemeralStorage": o([
        { json: "size", js: "size", typ: 0 },
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
        { json: "action", js: "action", typ: r("Action") },
        { json: "function_name", js: "function_name", typ: "" },
        { json: "principal", js: "principal", typ: r("PrincipalEnum") },
        { json: "source_arn", js: "source_arn", typ: u(undefined, "") },
    ], false),
    "AwsS3Bucket": o([
        { json: "Files", js: "Files", typ: a(r("AwsS3BucketFile")) },
    ], false),
    "AwsS3BucketFile": o([
        { json: "bucket", js: "bucket", typ: "" },
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
        { json: "cloudfront_access", js: "cloudfront_access", typ: a(r("CloudfrontAccess")) },
    ], false),
    "CloudfrontAccess": o([
        { json: "bucket", js: "bucket", typ: "" },
        { json: "policy", js: "policy", typ: "" },
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
        { json: "SendPushNotification", js: "SendPushNotification", typ: a(r("AwsSqsQueueSendPushNotification")) },
    ], false),
    "AwsSqsQueueSendPushNotification": o([
        { json: "delay_seconds", js: "delay_seconds", typ: 0 },
        { json: "max_message_size", js: "max_message_size", typ: 0 },
        { json: "message_retention_seconds", js: "message_retention_seconds", typ: 0 },
        { json: "name", js: "name", typ: "" },
        { json: "receive_wait_time_seconds", js: "receive_wait_time_seconds", typ: 0 },
        { json: "tags", js: "tags", typ: r("SendPushNotificationTags") },
    ], false),
    "SendPushNotificationTags": o([
        { json: "Environment", js: "Environment", typ: "" },
    ], false),
    "NullResource": o([
        { json: "DownloadFfmpegBinary", js: "DownloadFfmpegBinary", typ: a(r("DownloadFfmpegBinary")) },
        { json: "DownloadYtDlpBinary", js: "DownloadYtDlpBinary", typ: a(r("DownloadYtDLPBinary")) },
    ], false),
    "DownloadFfmpegBinary": o([
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
        { json: "ffmpeg_exists", js: "ffmpeg_exists", typ: "" },
    ], false),
    "DownloadYtDLPBinary": o([
        { json: "provisioner", js: "provisioner", typ: r("Provisioner") },
        { json: "triggers", js: "triggers", typ: r("DownloadYtDLPBinaryTriggers") },
    ], false),
    "DownloadYtDLPBinaryTriggers": o([
        { json: "version", js: "version", typ: "" },
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
    "APIGatewayAuthorizerType": [
        "zip",
    ],
    "AttributeType": [
        "N",
        "S",
    ],
    "Runtime": [
        "nodejs24.x",
    ],
    "Mode": [
        "Active",
    ],
    "Action": [
        "lambda:InvokeFunction",
    ],
    "PrincipalEnum": [
        "apigateway.amazonaws.com",
        "events.amazonaws.com",
        "s3.amazonaws.com",
    ],
};
