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
import * as lambdaEventSources from 'aws-cdk-lib/aws-lambda-event-sources';
import { NodejsFunction } from 'aws-cdk-lib/aws-lambda-nodejs';
import * as s3 from 'aws-cdk-lib/aws-s3';
import * as s3n from 'aws-cdk-lib/aws-s3-notifications';
import * as sfn from 'aws-cdk-lib/aws-stepfunctions';
import * as tasks from 'aws-cdk-lib/aws-stepfunctions-tasks';
import { Construct } from 'constructs';

export interface StockSyncConstructProps {
  readonly userPool: cognito.IUserPool;
  readonly userPoolClient: cognito.IUserPoolClient;
  readonly patagoniaApiUrl?: string;
}

/**
 * Stock sync infrastructure: S3, Lambda, EventBridge, HTTP API.
 */
export class StockSyncConstruct extends Construct {
  public readonly stockBucket: s3.Bucket;
  public readonly stockSyncFunction: NodejsFunction;
  public readonly stockDiffFunction: NodejsFunction;
  public readonly tiendanubeStockSyncFunction: NodejsFunction;
  public readonly tiendanubeOrderPaidWebhookFunction: NodejsFunction;
  public readonly digipPedidoCompletoWebhookFunction: NodejsFunction;
  public readonly tiendanubeFulfillmentShipFunction: NodejsFunction;
  public readonly patagoniaCreatePedidoFunction: NodejsFunction;
  public readonly stockChangesTable: dynamodb.Table;
  public readonly patagoniaPedidosTable: dynamodb.Table;
  public readonly adminApiFunction: NodejsFunction;
  public readonly stockCleanupFunction: NodejsFunction;
  public readonly manualStockSyncStateMachine: sfn.StateMachine;
  public readonly httpApi: apigwv2.HttpApi;

  constructor(scope: Construct, id: string, props: StockSyncConstructProps) {
    super(scope, id);

    const patagoniaApiUrl =
      props.patagoniaApiUrl ?? 'http://api.patagoniawms.com/v1/Stock';

    // Credentials are injected as Lambda environment variables at deploy time
    // from a local .env file (see cdk/.env.example). Placeholders keep synth
    // working when the values are not present (e.g. in CI/unit tests).
    const patagoniaApiKey = process.env.PATAGONIA_API_KEY ?? 'REPLACE_ME';
    const tiendanubeStoreId = process.env.TIENDANUBE_STORE_ID ?? 'REPLACE_ME';
    const tiendanubeAccessToken =
      process.env.TIENDANUBE_ACCESS_TOKEN ?? 'REPLACE_ME';
    const tiendanubeUserAgent =
      process.env.TIENDANUBE_USER_AGENT ??
      'Unibrandco Backend (ignaciodiaznanni@gmail.com)';

    this.stockBucket = new s3.Bucket(this, 'StockBucket', {
      bucketName: cdk.PhysicalName.GENERATE_IF_NEEDED,
      blockPublicAccess: s3.BlockPublicAccess.BLOCK_ALL,
      encryption: s3.BucketEncryption.S3_MANAGED,
      enforceSSL: true,
      versioned: false,
      removalPolicy: cdk.RemovalPolicy.RETAIN,
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
        PATAGONIA_API_KEY: patagoniaApiKey,
      },
      bundling: {
        minify: true,
        sourceMap: true,
        forceDockerBundling: false,
      },
    });

    this.stockBucket.grantPut(this.stockSyncFunction);

    this.stockChangesTable = new dynamodb.Table(this, 'StockChangesTable', {
      tableName: 'stock-availability-changes',
      partitionKey: {
        name: 'pk',
        type: dynamodb.AttributeType.STRING,
      },
      billingMode: dynamodb.BillingMode.PAY_PER_REQUEST,
      stream: dynamodb.StreamViewType.NEW_IMAGE,
      removalPolicy: cdk.RemovalPolicy.RETAIN,
    });

    this.stockChangesTable.addGlobalSecondaryIndex({
      indexName: 'byCreatedAt',
      partitionKey: {
        name: 'recordType',
        type: dynamodb.AttributeType.STRING,
      },
      sortKey: {
        name: 'createdAt',
        type: dynamodb.AttributeType.STRING,
      },
      projectionType: dynamodb.ProjectionType.ALL,
    });

    this.patagoniaPedidosTable = new dynamodb.Table(this, 'PatagoniaPedidosTable', {
      tableName: 'patagonia-pedidos',
      partitionKey: {
        name: 'pk',
        type: dynamodb.AttributeType.STRING,
      },
      billingMode: dynamodb.BillingMode.PAY_PER_REQUEST,
      removalPolicy: cdk.RemovalPolicy.RETAIN,
    });

    this.patagoniaPedidosTable.addGlobalSecondaryIndex({
      indexName: 'byCreatedAt',
      partitionKey: {
        name: 'recordType',
        type: dynamodb.AttributeType.STRING,
      },
      sortKey: {
        name: 'createdAt',
        type: dynamodb.AttributeType.STRING,
      },
      projectionType: dynamodb.ProjectionType.ALL,
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

    this.tiendanubeStockSyncFunction = new NodejsFunction(this, 'TiendanubeStockSyncFunction', {
      entry: path.join(__dirname, '../../src/lambdas/tiendanube-stock-sync/handler.ts'),
      handler: 'handler',
      runtime: lambda.Runtime.NODEJS_20_X,
      timeout: cdk.Duration.seconds(120),
      memorySize: 256,
      depsLockFilePath: path.join(__dirname, '../../package-lock.json'),
      environment: {
        STOCK_BUCKET_NAME: this.stockBucket.bucketName,
        PRODUCTS_CLEAN_S3_KEY: 'tienda-nube-products/products-clean.json',
        TIENDANUBE_STORE_ID: tiendanubeStoreId,
        TIENDANUBE_ACCESS_TOKEN: tiendanubeAccessToken,
        TIENDANUBE_USER_AGENT: tiendanubeUserAgent,
        TIENDANUBE_API_VERSION: '2025-03',
        STOCK_CHANGES_TABLE_NAME: this.stockChangesTable.tableName,
      },
      bundling: {
        minify: true,
        sourceMap: true,
        forceDockerBundling: false,
      },
    });

    this.stockBucket.grantRead(this.tiendanubeStockSyncFunction);
    this.stockChangesTable.grantReadWriteData(this.tiendanubeStockSyncFunction);

    this.patagoniaCreatePedidoFunction = new NodejsFunction(
      this,
      'PatagoniaCreatePedidoFunction',
      {
        entry: path.join(
          __dirname,
          '../../src/lambdas/patagonia-create-pedido/handler.ts',
        ),
        handler: 'handler',
        runtime: lambda.Runtime.NODEJS_20_X,
        timeout: cdk.Duration.seconds(30),
        memorySize: 256,
        depsLockFilePath: path.join(__dirname, '../../package-lock.json'),
        environment: {
          PATAGONIA_PEDIDOS_API_URL: 'https://api.v2.digipwms.com/api/v2/Pedidos',
          PATAGONIA_API_KEY: patagoniaApiKey,
          CLIENTE_UBICACION_CODIGO: '8436326823',
          PATAGONIA_PEDIDOS_TABLE_NAME: this.patagoniaPedidosTable.tableName,
        },
        bundling: {
          minify: true,
          sourceMap: true,
          forceDockerBundling: false,
        },
      },
    );

    this.patagoniaPedidosTable.grantWriteData(this.patagoniaCreatePedidoFunction);

    this.tiendanubeOrderPaidWebhookFunction = new NodejsFunction(
      this,
      'TiendanubeOrderPaidWebhookFunction',
      {
        entry: path.join(
          __dirname,
          '../../src/lambdas/tiendanube-order-paid-webhook/handler.ts',
        ),
        handler: 'handler',
        runtime: lambda.Runtime.NODEJS_20_X,
        timeout: cdk.Duration.seconds(10),
        memorySize: 256,
        depsLockFilePath: path.join(__dirname, '../../package-lock.json'),
        environment: {
          TIENDANUBE_STORE_ID: tiendanubeStoreId,
          TIENDANUBE_ACCESS_TOKEN: tiendanubeAccessToken,
          TIENDANUBE_USER_AGENT: tiendanubeUserAgent,
          TIENDANUBE_API_VERSION: '2025-03',
          PATAGONIA_CREATE_PEDIDO_FUNCTION_NAME:
            this.patagoniaCreatePedidoFunction.functionName,
        },
        bundling: {
          minify: true,
          sourceMap: true,
          forceDockerBundling: false,
        },
      },
    );

    this.patagoniaCreatePedidoFunction.grantInvoke(
      this.tiendanubeOrderPaidWebhookFunction,
    );

    this.tiendanubeFulfillmentShipFunction = new NodejsFunction(
      this,
      'TiendanubeFulfillmentShipFunction',
      {
        entry: path.join(
          __dirname,
          '../../src/lambdas/tiendanube-fulfillment-ship/handler.ts',
        ),
        handler: 'handler',
        runtime: lambda.Runtime.NODEJS_20_X,
        timeout: cdk.Duration.seconds(30),
        memorySize: 256,
        depsLockFilePath: path.join(__dirname, '../../package-lock.json'),
        environment: {
          TIENDANUBE_STORE_ID: tiendanubeStoreId,
          TIENDANUBE_ACCESS_TOKEN: tiendanubeAccessToken,
          TIENDANUBE_USER_AGENT: tiendanubeUserAgent,
          TIENDANUBE_API_VERSION: '2025-03',
          PATAGONIA_PEDIDOS_TABLE_NAME: this.patagoniaPedidosTable.tableName,
        },
        bundling: {
          minify: true,
          sourceMap: true,
          forceDockerBundling: false,
        },
      },
    );

    this.patagoniaPedidosTable.grantWriteData(this.tiendanubeFulfillmentShipFunction);

    this.digipPedidoCompletoWebhookFunction = new NodejsFunction(
      this,
      'DigipPedidoCompletoWebhookFunction',
      {
        entry: path.join(
          __dirname,
          '../../src/lambdas/digip-pedido-completo-webhook/handler.ts',
        ),
        handler: 'handler',
        runtime: lambda.Runtime.NODEJS_20_X,
        timeout: cdk.Duration.seconds(10),
        memorySize: 256,
        depsLockFilePath: path.join(__dirname, '../../package-lock.json'),
        environment: {
          TIENDANUBE_FULFILLMENT_SHIP_FUNCTION_NAME:
            this.tiendanubeFulfillmentShipFunction.functionName,
        },
        bundling: {
          minify: true,
          sourceMap: true,
          forceDockerBundling: false,
        },
      },
    );

    this.tiendanubeFulfillmentShipFunction.grantInvoke(
      this.digipPedidoCompletoWebhookFunction,
    );

    this.tiendanubeStockSyncFunction.addEventSource(
      new lambdaEventSources.DynamoEventSource(this.stockChangesTable, {
        startingPosition: lambda.StartingPosition.LATEST,
        batchSize: 1,
        filters: [
          lambda.FilterCriteria.filter({
            eventName: lambda.FilterRule.isEqual('INSERT'),
          }),
        ],
      }),
    );

    // Argentina (UTC-3, no DST): 06:30-19:30 ART = 09:30-22:30 UTC, weekdays only
    const stockSyncTarget = new targets.LambdaFunction(this.stockSyncFunction);

    new events.Rule(this, 'StockSyncSchedule0630', {
      ruleName: 'patagonia-stock-sync-0630-ar',
      description: 'Sync Patagonia WMS stock at 06:30 Argentina time (09:30 UTC), Mon-Fri',
      schedule: events.Schedule.cron({
        minute: '30',
        hour: '9',
        weekDay: 'MON-FRI',
      }),
      targets: [stockSyncTarget],
    });

    new events.Rule(this, 'StockSyncSchedule7To18', {
      ruleName: 'patagonia-stock-sync-0700-1830-ar',
      description:
        'Sync Patagonia WMS stock every 30 min from 07:00 to 18:30 Argentina time (10:00-21:30 UTC), Mon-Fri',
      schedule: events.Schedule.cron({
        minute: '0,30',
        hour: '10-21',
        weekDay: 'MON-FRI',
      }),
      targets: [stockSyncTarget],
    });

    new events.Rule(this, 'StockSyncSchedule19', {
      ruleName: 'patagonia-stock-sync-1900-1930-ar',
      description:
        'Sync Patagonia WMS stock at 19:00 and 19:30 Argentina time (22:00-22:30 UTC), Mon-Fri',
      schedule: events.Schedule.cron({
        minute: '0,30',
        hour: '22',
        weekDay: 'MON-FRI',
      }),
      targets: [stockSyncTarget],
    });

    this.stockCleanupFunction = new NodejsFunction(this, 'StockCleanupFunction', {
      entry: path.join(__dirname, '../../src/lambdas/stock-cleanup/handler.ts'),
      handler: 'handler',
      runtime: lambda.Runtime.NODEJS_20_X,
      timeout: cdk.Duration.seconds(60),
      memorySize: 256,
      depsLockFilePath: path.join(__dirname, '../../package-lock.json'),
      environment: {
        STOCK_BUCKET_NAME: this.stockBucket.bucketName,
        RETENTION_DAYS: '8',
      },
      bundling: {
        minify: true,
        sourceMap: true,
        forceDockerBundling: false,
      },
    });

    this.stockBucket.grantReadWrite(this.stockCleanupFunction);

    new events.Rule(this, 'StockCleanupSchedule', {
      ruleName: 'patagonia-stock-cleanup-daily',
      description: 'Delete Patagonia stock snapshots older than 8 UTC days',
      schedule: events.Schedule.cron({
        minute: '0',
        hour: '3',
      }),
      targets: [new targets.LambdaFunction(this.stockCleanupFunction)],
    });

    // --- Manual full-stock sync: Step Functions pipeline ---
    const manualSyncBaseEnv = { STOCK_BUCKET_NAME: this.stockBucket.bucketName };
    const manualSyncTiendanubeEnv = {
      TIENDANUBE_STORE_ID: tiendanubeStoreId,
      TIENDANUBE_ACCESS_TOKEN: tiendanubeAccessToken,
      TIENDANUBE_USER_AGENT: tiendanubeUserAgent,
      TIENDANUBE_API_VERSION: '2025-03',
    };

    const makeManualSyncStep = (
      id: string,
      subdir: string,
      environment: Record<string, string>,
      timeout: cdk.Duration = cdk.Duration.seconds(60),
    ): NodejsFunction =>
      new NodejsFunction(this, id, {
        entry: path.join(
          __dirname,
          `../../src/lambdas/manual-sync/${subdir}/handler.ts`,
        ),
        handler: 'handler',
        runtime: lambda.Runtime.NODEJS_20_X,
        timeout,
        memorySize: 256,
        depsLockFilePath: path.join(__dirname, '../../package-lock.json'),
        environment,
        bundling: { minify: true, sourceMap: true, forceDockerBundling: false },
      });

    const fetchPatagoniaFn = makeManualSyncStep(
      'ManualSyncFetchPatagonia',
      'fetch-patagonia',
      { ...manualSyncBaseEnv, PATAGONIA_API_URL: patagoniaApiUrl, PATAGONIA_API_KEY: patagoniaApiKey },
      cdk.Duration.seconds(120),
    );
    const fetchTiendanubeFn = makeManualSyncStep(
      'ManualSyncFetchTiendanube',
      'fetch-tiendanube',
      { ...manualSyncBaseEnv, ...manualSyncTiendanubeEnv },
      cdk.Duration.seconds(600),
    );
    const cleanFn = makeManualSyncStep('ManualSyncClean', 'clean', manualSyncBaseEnv);
    const validateFn = makeManualSyncStep('ManualSyncValidate', 'validate', manualSyncBaseEnv);
    const buildPatchFn = makeManualSyncStep(
      'ManualSyncBuildPatch',
      'build-patch',
      manualSyncBaseEnv,
      cdk.Duration.seconds(120),
    );
    const sendPatchFn = makeManualSyncStep(
      'ManualSyncSendPatch',
      'send-patch',
      { ...manualSyncBaseEnv, ...manualSyncTiendanubeEnv, SEND_BATCH_CHUNKS: '20' },
      cdk.Duration.seconds(600),
    );
    const finalizeFn = makeManualSyncStep('ManualSyncFinalize', 'finalize-run', manualSyncBaseEnv);
    const failRunFn = makeManualSyncStep('ManualSyncFailRun', 'fail-run', manualSyncBaseEnv);

    for (const fn of [
      fetchPatagoniaFn,
      fetchTiendanubeFn,
      cleanFn,
      validateFn,
      buildPatchFn,
      sendPatchFn,
      finalizeFn,
      failRunFn,
    ]) {
      this.stockBucket.grantReadWrite(fn);
    }

    // Catch target: record the failure on the manifest, then fail the execution.
    const failRunTask = new tasks.LambdaInvoke(this, 'ManualSyncFailRunTask', {
      lambdaFunction: failRunFn,
      payloadResponseOnly: true,
    });
    failRunTask.next(
      new sfn.Fail(this, 'ManualSyncFailed', {
        error: 'ManualSyncError',
        cause: 'Manual stock sync run failed',
      }),
    );

    const stepWithCatch = (id: string, fn: NodejsFunction): tasks.LambdaInvoke =>
      new tasks.LambdaInvoke(this, id, {
        lambdaFunction: fn,
        payloadResponseOnly: true,
      }).addCatch(failRunTask, { resultPath: '$.error' }) as tasks.LambdaInvoke;

    const fetchPatagoniaTask = stepWithCatch('ManualSyncFetchPatagoniaTask', fetchPatagoniaFn);
    const fetchTiendanubeTask = stepWithCatch('ManualSyncFetchTiendanubeTask', fetchTiendanubeFn);
    const cleanTask = stepWithCatch('ManualSyncCleanTask', cleanFn);
    const validateTask = stepWithCatch('ManualSyncValidateTask', validateFn);
    const buildPatchTask = stepWithCatch('ManualSyncBuildPatchTask', buildPatchFn);
    const sendPatchTask = stepWithCatch('ManualSyncSendPatchTask', sendPatchFn);
    const finalizeTask = stepWithCatch('ManualSyncFinalizeTask', finalizeFn);

    const waitBeforeNextBatch = new sfn.Wait(this, 'ManualSyncWaitSendBatch', {
      time: sfn.WaitTime.duration(cdk.Duration.seconds(5)),
    });
    const sendDoneChoice = new sfn.Choice(this, 'ManualSyncSendDone?');
    sendDoneChoice
      .when(sfn.Condition.booleanEquals('$.sendDone', true), finalizeTask)
      .otherwise(waitBeforeNextBatch);
    waitBeforeNextBatch.next(sendPatchTask);
    sendPatchTask.next(sendDoneChoice);

    const manualSyncDefinition = fetchPatagoniaTask
      .next(fetchTiendanubeTask)
      .next(cleanTask)
      .next(validateTask)
      .next(buildPatchTask)
      .next(sendPatchTask);

    this.manualStockSyncStateMachine = new sfn.StateMachine(
      this,
      'ManualStockSyncStateMachine',
      {
        stateMachineName: 'unibrandco-manual-stock-sync',
        stateMachineType: sfn.StateMachineType.STANDARD,
        definitionBody: sfn.DefinitionBody.fromChainable(manualSyncDefinition),
        timeout: cdk.Duration.hours(2),
      },
    );

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
        allowMethods: [
          apigwv2.CorsHttpMethod.GET,
          apigwv2.CorsHttpMethod.POST,
          apigwv2.CorsHttpMethod.OPTIONS,
        ],
        allowOrigins: ['*'],
      },
    });

    this.adminApiFunction = new NodejsFunction(this, 'AdminApiFunction', {
      entry: path.join(__dirname, '../../src/lambdas/admin-api/handler.ts'),
      handler: 'handler',
      runtime: lambda.Runtime.NODEJS_20_X,
      timeout: cdk.Duration.seconds(30),
      memorySize: 256,
      depsLockFilePath: path.join(__dirname, '../../package-lock.json'),
      environment: {
        STOCK_CHANGES_TABLE_NAME: this.stockChangesTable.tableName,
        STOCK_BUCKET_NAME: this.stockBucket.bucketName,
        GSI_NAME: 'byCreatedAt',
        PATAGONIA_PEDIDOS_TABLE_NAME: this.patagoniaPedidosTable.tableName,
        PATAGONIA_PEDIDOS_GSI_NAME: 'byCreatedAt',
        MANUAL_SYNC_STATE_MACHINE_ARN:
          this.manualStockSyncStateMachine.stateMachineArn,
      },
      bundling: {
        minify: true,
        sourceMap: true,
        forceDockerBundling: false,
      },
    });

    this.stockChangesTable.grantReadData(this.adminApiFunction);
    this.patagoniaPedidosTable.grantReadData(this.adminApiFunction);
    // Admin API reads snapshots/manifests and writes the initial run manifest.
    this.stockBucket.grantReadWrite(this.adminApiFunction);
    this.manualStockSyncStateMachine.grantStartExecution(this.adminApiFunction);

    const adminApiIntegration = new apigwv2Integrations.HttpLambdaIntegration(
      'AdminApiIntegration',
      this.adminApiFunction,
    );

    this.httpApi.addRoutes({
      path: '/stock/sync',
      methods: [apigwv2.HttpMethod.POST],
      integration: new apigwv2Integrations.HttpLambdaIntegration(
        'StockSyncIntegration',
        this.stockSyncFunction,
      ),
      authorizer,
    });

    this.httpApi.addRoutes({
      path: '/dashboard/admin',
      methods: [apigwv2.HttpMethod.GET],
      integration: adminApiIntegration,
      authorizer,
    });

    this.httpApi.addRoutes({
      path: '/admin/stock-changes',
      methods: [apigwv2.HttpMethod.GET],
      integration: adminApiIntegration,
      authorizer,
    });

    this.httpApi.addRoutes({
      path: '/admin/stock-changes/{syncKey+}',
      methods: [apigwv2.HttpMethod.GET],
      integration: adminApiIntegration,
      authorizer,
    });

    this.httpApi.addRoutes({
      path: '/admin/stock-files/download',
      methods: [apigwv2.HttpMethod.GET],
      integration: adminApiIntegration,
      authorizer,
    });

    this.httpApi.addRoutes({
      path: '/admin/stock-files',
      methods: [apigwv2.HttpMethod.GET],
      integration: adminApiIntegration,
      authorizer,
    });

    this.httpApi.addRoutes({
      path: '/admin/patagonia-pedidos',
      methods: [apigwv2.HttpMethod.GET],
      integration: adminApiIntegration,
      authorizer,
    });

    this.httpApi.addRoutes({
      path: '/admin/patagonia-pedidos/{codigo+}',
      methods: [apigwv2.HttpMethod.GET],
      integration: adminApiIntegration,
      authorizer,
    });

    this.httpApi.addRoutes({
      path: '/admin/manual-sync/trigger',
      methods: [apigwv2.HttpMethod.POST],
      integration: adminApiIntegration,
      authorizer,
    });

    this.httpApi.addRoutes({
      path: '/admin/manual-sync/runs',
      methods: [apigwv2.HttpMethod.GET],
      integration: adminApiIntegration,
      authorizer,
    });

    this.httpApi.addRoutes({
      path: '/admin/manual-sync/runs/{runId+}',
      methods: [apigwv2.HttpMethod.GET],
      integration: adminApiIntegration,
      authorizer,
    });

    this.httpApi.addRoutes({
      path: '/webhooks/tiendanube/order-paid',
      methods: [apigwv2.HttpMethod.POST],
      integration: new apigwv2Integrations.HttpLambdaIntegration(
        'TiendanubeOrderPaidWebhookIntegration',
        this.tiendanubeOrderPaidWebhookFunction,
      ),
    });

    this.httpApi.addRoutes({
      path: '/webhooks/digip/pedido-completo',
      methods: [apigwv2.HttpMethod.POST],
      integration: new apigwv2Integrations.HttpLambdaIntegration(
        'DigipPedidoCompletoWebhookIntegration',
        this.digipPedidoCompletoWebhookFunction,
      ),
    });

    new cdk.CfnOutput(this, 'StockBucketName', {
      value: this.stockBucket.bucketName,
      description: 'S3 bucket for Patagonia stock snapshots',
    });

    new cdk.CfnOutput(this, 'StockSyncApiUrl', {
      value: `${this.httpApi.apiEndpoint}/stock/sync`,
      description: 'Manual stock sync endpoint (POST, Cognito JWT required)',
    });

    new cdk.CfnOutput(this, 'AdminApiBaseUrl', {
      value: this.httpApi.apiEndpoint,
      description: 'Admin API base URL (GET routes, Cognito JWT + ADMIN group required)',
    });

    new cdk.CfnOutput(this, 'ManualStockSyncStateMachineArn', {
      value: this.manualStockSyncStateMachine.stateMachineArn,
      description: 'Step Functions state machine for the manual full-stock sync',
    });

    new cdk.CfnOutput(this, 'StockChangesTableName', {
      value: this.stockChangesTable.tableName,
      description: 'DynamoDB table for UnidadesDisponibles changes between syncs',
    });

    new cdk.CfnOutput(this, 'PatagoniaPedidosTableName', {
      value: this.patagoniaPedidosTable.tableName,
      description: 'DynamoDB table for Tiendanube orders sent to Patagonia DigipWMS',
    });

    new cdk.CfnOutput(this, 'TiendanubeOrderPaidWebhookUrl', {
      value: `${this.httpApi.apiEndpoint}/webhooks/tiendanube/order-paid`,
      description:
        'Public Tiendanube order/paid webhook URL (POST, no auth — register in Tiendanube)',
    });

    new cdk.CfnOutput(this, 'DigipPedidoCompletoWebhookUrl', {
      value: `${this.httpApi.apiEndpoint}/webhooks/digip/pedido-completo`,
      description:
        'Public DigipWMS Pedido_Completo webhook URL (POST, no auth — register via POST /api/v2/WebHooks)',
    });
  }
}
