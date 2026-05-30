import * as path from 'path';

import * as cdk from 'aws-cdk-lib';
import * as apigwv2 from 'aws-cdk-lib/aws-apigatewayv2';
import * as apigwv2Integrations from 'aws-cdk-lib/aws-apigatewayv2-integrations';
import * as apigwv2Authorizers from 'aws-cdk-lib/aws-apigatewayv2-authorizers';
import * as cognito from 'aws-cdk-lib/aws-cognito';
import * as dynamodb from 'aws-cdk-lib/aws-dynamodb';
import * as events from 'aws-cdk-lib/aws-events';
import * as targets from 'aws-cdk-lib/aws-events-targets';
import * as lambda from 'aws-cdk-lib/aws-lambda';
import { NodejsFunction } from 'aws-cdk-lib/aws-lambda-nodejs';
import * as s3 from 'aws-cdk-lib/aws-s3';
import * as s3n from 'aws-cdk-lib/aws-s3-notifications';
import * as secretsmanager from 'aws-cdk-lib/aws-secretsmanager';
import { Construct } from 'constructs';

export interface StockSyncConstructProps {
  readonly userPool: cognito.IUserPool;
  readonly userPoolClient: cognito.IUserPoolClient;
  readonly patagoniaApiUrl?: string;
}

/**
 * Stock sync infrastructure: S3, Secrets Manager, Lambda, EventBridge, HTTP API.
 */
export class StockSyncConstruct extends Construct {
  public readonly stockBucket: s3.Bucket;
  public readonly apiKeySecret: secretsmanager.Secret;
  public readonly stockSyncFunction: NodejsFunction;
  public readonly stockDiffFunction: NodejsFunction;
  public readonly stockChangesTable: dynamodb.Table;
  public readonly httpApi: apigwv2.HttpApi;

  constructor(scope: Construct, id: string, props: StockSyncConstructProps) {
    super(scope, id);

    const patagoniaApiUrl =
      props.patagoniaApiUrl ?? 'http://api.patagoniawms.com/v1/Stock';

    this.stockBucket = new s3.Bucket(this, 'StockBucket', {
      bucketName: cdk.PhysicalName.GENERATE_IF_NEEDED,
      blockPublicAccess: s3.BlockPublicAccess.BLOCK_ALL,
      encryption: s3.BucketEncryption.S3_MANAGED,
      enforceSSL: true,
      versioned: false,
      removalPolicy: cdk.RemovalPolicy.RETAIN,
    });

    this.apiKeySecret = new secretsmanager.Secret(this, 'PatagoniaApiKeySecret', {
      secretName: 'patagonia-wms/api-key',
      description: 'Patagonia WMS API key for stock sync',
      secretStringValue: cdk.SecretValue.unsafePlainText('REPLACE_ME_AFTER_DEPLOY'),
    });

    this.stockSyncFunction = new NodejsFunction(this, 'StockSyncFunction', {
      entry: path.join(__dirname, '../../src/lambdas/stock-sync/handler.ts'),
      handler: 'handler',
      runtime: lambda.Runtime.NODEJS_20_X,
      timeout: cdk.Duration.seconds(60),
      memorySize: 256,
      depsLockFilePath: path.join(__dirname, '../../package-lock.json'),
      environment: {
        STOCK_BUCKET_NAME: this.stockBucket.bucketName,
        PATAGONIA_API_URL: patagoniaApiUrl,
        PATAGONIA_API_KEY_SECRET_ARN: this.apiKeySecret.secretArn,
      },
      bundling: {
        minify: true,
        sourceMap: true,
        forceDockerBundling: false,
      },
    });

    this.stockBucket.grantPut(this.stockSyncFunction);
    this.apiKeySecret.grantRead(this.stockSyncFunction);

    this.stockChangesTable = new dynamodb.Table(this, 'StockChangesTable', {
      tableName: 'stock-availability-changes',
      partitionKey: {
        name: 'pk',
        type: dynamodb.AttributeType.STRING,
      },
      billingMode: dynamodb.BillingMode.PAY_PER_REQUEST,
      removalPolicy: cdk.RemovalPolicy.RETAIN,
    });

    this.stockDiffFunction = new NodejsFunction(this, 'StockDiffFunction', {
      entry: path.join(__dirname, '../../src/lambdas/stock-diff/handler.ts'),
      handler: 'handler',
      runtime: lambda.Runtime.NODEJS_20_X,
      timeout: cdk.Duration.seconds(60),
      memorySize: 256,
      depsLockFilePath: path.join(__dirname, '../../package-lock.json'),
      environment: {
        STOCK_BUCKET_NAME: this.stockBucket.bucketName,
        STOCK_CHANGES_TABLE_NAME: this.stockChangesTable.tableName,
      },
      bundling: {
        minify: true,
        sourceMap: true,
        forceDockerBundling: false,
      },
    });

    this.stockBucket.grantRead(this.stockDiffFunction);
    this.stockChangesTable.grantWriteData(this.stockDiffFunction);

    this.stockBucket.addEventNotification(
      s3.EventType.OBJECT_CREATED,
      new s3n.LambdaDestination(this.stockDiffFunction),
      { suffix: '.json' },
    );

    // Argentina (UTC-3, no DST): 06:30-19:30 ART = 09:30-22:30 UTC
    const stockSyncTarget = new targets.LambdaFunction(this.stockSyncFunction);

    new events.Rule(this, 'StockSyncSchedule0630', {
      ruleName: 'patagonia-stock-sync-0630-ar',
      description: 'Sync Patagonia WMS stock at 06:30 Argentina time (09:30 UTC)',
      schedule: events.Schedule.cron({
        minute: '30',
        hour: '9',
      }),
      targets: [stockSyncTarget],
    });

    new events.Rule(this, 'StockSyncSchedule7To18', {
      ruleName: 'patagonia-stock-sync-0700-1830-ar',
      description: 'Sync Patagonia WMS stock every 30 min from 07:00 to 18:30 Argentina time (10:00-21:30 UTC)',
      schedule: events.Schedule.cron({
        minute: '0,30',
        hour: '10-21',
      }),
      targets: [stockSyncTarget],
    });

    new events.Rule(this, 'StockSyncSchedule19', {
      ruleName: 'patagonia-stock-sync-1900-1930-ar',
      description: 'Sync Patagonia WMS stock at 19:00 and 19:30 Argentina time (22:00-22:30 UTC)',
      schedule: events.Schedule.cron({
        minute: '0,30',
        hour: '22',
      }),
      targets: [stockSyncTarget],
    });

    const authorizer = new apigwv2Authorizers.HttpUserPoolAuthorizer(
      'StockSyncAuthorizer',
      props.userPool,
      {
        userPoolClients: [props.userPoolClient],
        identitySource: ['$request.header.Authorization'],
      },
    );

    this.httpApi = new apigwv2.HttpApi(this, 'StockSyncApi', {
      apiName: 'unibrandco-stock-sync-api',
      corsPreflight: {
        allowHeaders: ['Authorization', 'Content-Type'],
        allowMethods: [apigwv2.CorsHttpMethod.POST, apigwv2.CorsHttpMethod.OPTIONS],
        allowOrigins: ['*'],
      },
    });

    this.httpApi.addRoutes({
      path: '/stock/sync',
      methods: [apigwv2.HttpMethod.POST],
      integration: new apigwv2Integrations.HttpLambdaIntegration(
        'StockSyncIntegration',
        this.stockSyncFunction,
      ),
      authorizer,
    });

    new cdk.CfnOutput(this, 'StockBucketName', {
      value: this.stockBucket.bucketName,
      description: 'S3 bucket for Patagonia stock snapshots',
    });

    new cdk.CfnOutput(this, 'StockSyncApiUrl', {
      value: `${this.httpApi.apiEndpoint}/stock/sync`,
      description: 'Manual stock sync endpoint (POST, Cognito JWT required)',
    });

    new cdk.CfnOutput(this, 'PatagoniaApiKeySecretArn', {
      value: this.apiKeySecret.secretArn,
      description: 'Secrets Manager ARN for Patagonia WMS API key',
    });

    new cdk.CfnOutput(this, 'StockChangesTableName', {
      value: this.stockChangesTable.tableName,
      description: 'DynamoDB table for UnidadesDisponibles changes between syncs',
    });
  }
}
