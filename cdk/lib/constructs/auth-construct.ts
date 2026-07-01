import * as cdk from 'aws-cdk-lib';
import * as cognito from 'aws-cdk-lib/aws-cognito';
import { Construct } from 'constructs';

export interface AuthConstructProps {
  readonly adminGroupName?: string;
  readonly superAdminGroupName?: string;
}

/**
 * Cognito User Pool with ADMIN and SUPER_ADMIN groups for protected API access.
 */
export class AuthConstruct extends Construct {
  public readonly userPool: cognito.UserPool;
  public readonly userPoolClient: cognito.UserPoolClient;
  public readonly adminGroup: cognito.CfnUserPoolGroup;
  public readonly superAdminGroup: cognito.CfnUserPoolGroup;

  constructor(scope: Construct, id: string, props: AuthConstructProps = {}) {
    super(scope, id);

    const adminGroupName = props.adminGroupName ?? 'ADMIN';
    const superAdminGroupName = props.superAdminGroupName ?? 'SUPER_ADMIN';

    this.userPool = new cognito.UserPool(this, 'UserPool', {
      userPoolName: 'unibrandco-users',
      signInAliases: {
        email: true,
      },
      selfSignUpEnabled: false,
      autoVerify: {
        email: true,
      },
      passwordPolicy: {
        minLength: 8,
        requireLowercase: true,
        requireUppercase: true,
        requireDigits: true,
        requireSymbols: false,
      },
      accountRecovery: cognito.AccountRecovery.EMAIL_ONLY,
      removalPolicy: cdk.RemovalPolicy.RETAIN,
    });

    this.userPoolClient = this.userPool.addClient('AppClient', {
      userPoolClientName: 'unibrandco-app-client',
      authFlows: {
        userPassword: true,
        userSrp: true,
      },
      generateSecret: false,
    });

    this.adminGroup = new cognito.CfnUserPoolGroup(this, 'AdminGroup', {
      userPoolId: this.userPool.userPoolId,
      groupName: adminGroupName,
      description: 'Administrators with access to manual stock sync',
    });

    this.superAdminGroup = new cognito.CfnUserPoolGroup(this, 'SuperAdminGroup', {
      userPoolId: this.userPool.userPoolId,
      groupName: superAdminGroupName,
      description: 'Super administrators who can manage other users',
    });

    new cdk.CfnOutput(this, 'UserPoolId', {
      value: this.userPool.userPoolId,
      description: 'Cognito User Pool ID',
    });

    new cdk.CfnOutput(this, 'UserPoolClientId', {
      value: this.userPoolClient.userPoolClientId,
      description: 'Cognito User Pool Client ID',
    });
  }
}
