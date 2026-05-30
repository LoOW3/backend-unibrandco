import * as cdk from 'aws-cdk-lib';
import { Construct } from 'constructs';

import { AuthConstruct } from './constructs/auth-construct';
import { StockSyncConstruct } from './constructs/stock-sync-construct';

export class CdkStack extends cdk.Stack {
  constructor(scope: Construct, id: string, props?: cdk.StackProps) {
    super(scope, id, props);

    const auth = new AuthConstruct(this, 'Auth');

    new StockSyncConstruct(this, 'StockSync', {
      userPool: auth.userPool,
      userPoolClient: auth.userPoolClient,
    });
  }
}
