-- Associate Lambda IAM roles with PostgreSQL roles
-- Uses Aurora DSQL AWS IAM GRANT syntax
-- See: https://docs.aws.amazon.com/AmazonRDS/latest/AuroraUserGuide/aurora-dsql-working-with-iam-auth.html
--
-- Note: ${AWS_ACCOUNT_ID} is replaced at runtime by MigrateDSQL handler

-- ReadOnly Lambdas: app_readonly role (SELECT only)
AWS IAM GRANT app_readonly TO 'arn:aws:iam::${AWS_ACCOUNT_ID}:role/ListFiles';
AWS IAM GRANT app_readonly TO 'arn:aws:iam::${AWS_ACCOUNT_ID}:role/S3ObjectCreated';

-- ReadWrite Lambdas: app_readwrite role (full DML)
AWS IAM GRANT app_readwrite TO 'arn:aws:iam::${AWS_ACCOUNT_ID}:role/ApiGatewayAuthorizer';
AWS IAM GRANT app_readwrite TO 'arn:aws:iam::${AWS_ACCOUNT_ID}:role/CleanupExpiredRecords';
AWS IAM GRANT app_readwrite TO 'arn:aws:iam::${AWS_ACCOUNT_ID}:role/DeviceEvent';
AWS IAM GRANT app_readwrite TO 'arn:aws:iam::${AWS_ACCOUNT_ID}:role/LoginUser';
AWS IAM GRANT app_readwrite TO 'arn:aws:iam::${AWS_ACCOUNT_ID}:role/PruneDevices';
AWS IAM GRANT app_readwrite TO 'arn:aws:iam::${AWS_ACCOUNT_ID}:role/RefreshToken';
AWS IAM GRANT app_readwrite TO 'arn:aws:iam::${AWS_ACCOUNT_ID}:role/RegisterDevice';
AWS IAM GRANT app_readwrite TO 'arn:aws:iam::${AWS_ACCOUNT_ID}:role/RegisterUser';
AWS IAM GRANT app_readwrite TO 'arn:aws:iam::${AWS_ACCOUNT_ID}:role/SendPushNotification';
AWS IAM GRANT app_readwrite TO 'arn:aws:iam::${AWS_ACCOUNT_ID}:role/StartFileUpload';
AWS IAM GRANT app_readwrite TO 'arn:aws:iam::${AWS_ACCOUNT_ID}:role/UserDelete';
AWS IAM GRANT app_readwrite TO 'arn:aws:iam::${AWS_ACCOUNT_ID}:role/UserSubscribe';
AWS IAM GRANT app_readwrite TO 'arn:aws:iam::${AWS_ACCOUNT_ID}:role/WebhookFeedly';
