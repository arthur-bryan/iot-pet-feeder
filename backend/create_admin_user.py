"""
Lambda function to create admin user in Cognito after deployment.
This runs as a post-deployment step via Terraform local-exec.
"""
import json
import os
import secrets
import string

import boto3
from botocore.exceptions import ClientError


def generate_temp_password(length=12):
    """Generate a secure temporary password"""
    alphabet = string.ascii_letters + string.digits + "!@#$%^&*"
    password = ''.join(secrets.choice(alphabet) for _ in range(length))

    # Ensure password meets requirements (uppercase, lowercase, number, special)
    if (any(c.islower() for c in password) and
        any(c.isupper() for c in password) and
        any(c.isdigit() for c in password)):
        return password
    else:
        # Recursively try again if requirements not met
        return generate_temp_password(length)


def handler(event, context):
    """
    Create admin user in Cognito User Pool

    Environment Variables:
        USER_POOL_ID: Cognito User Pool ID
        ADMIN_EMAIL: Admin user email address
        ADMIN_GROUP_NAME: Name of the admin group (default: 'admin')
    """
    user_pool_id = os.environ.get('USER_POOL_ID')
    admin_email = os.environ.get('ADMIN_EMAIL')
    admin_group_name = os.environ.get('ADMIN_GROUP_NAME', 'admin')

    if not user_pool_id or not admin_email:
        return {
            'statusCode': 400,
            'body': json.dumps('Missing required environment variables')
        }

    cognito = boto3.client('cognito-idp')

    try:
        # Check if user already exists
        try:
            cognito.admin_get_user(
                UserPoolId=user_pool_id,
                Username=admin_email
            )
            print(f"✅ Admin user {admin_email} already exists")
            return {
                'statusCode': 200,
                'body': json.dumps({
                    'message': 'Admin user already exists',
                    'email': admin_email
                })
            }
        except cognito.exceptions.UserNotFoundException:
            # User doesn't exist, create it
            pass

        # Generate temporary password
        temp_password = generate_temp_password()

        # Create admin user
        cognito.admin_create_user(
            UserPoolId=user_pool_id,
            Username=admin_email,
            UserAttributes=[
                {
                    'Name': 'email',
                    'Value': admin_email
                },
                {
                    'Name': 'email_verified',
                    'Value': 'true'
                }
            ],
            TemporaryPassword=temp_password,
            MessageAction='SUPPRESS',  # Don't send Cognito's default email
            DesiredDeliveryMediums=['EMAIL']
        )

        print(f"✅ Created admin user: {admin_email}")

        # Add user to admin group
        cognito.admin_add_user_to_group(
            UserPoolId=user_pool_id,
            Username=admin_email,
            GroupName=admin_group_name
        )

        print(f"✅ Added {admin_email} to {admin_group_name} group")

        # Send custom email with temporary password
        ses = boto3.client('ses', region_name=os.environ.get('AWS_REGION', 'us-east-2'))

        try:
            ses.send_email(
                Source=admin_email,  # Must be verified in SES
                Destination={
                    'ToAddresses': [admin_email]
                },
                Message={
                    'Subject': {
                        'Data': 'Your IoT Pet Feeder Admin Account'
                    },
                    'Body': {
                        'Text': {
                            'Data': f"""Welcome to IoT Pet Feeder!

Your administrator account has been created.

Email: {admin_email}
Temporary Password: {temp_password}

IMPORTANT: You must change this password on your first login.

Please log in at your dashboard URL and follow the password change prompt.

Best regards,
IoT Pet Feeder System
"""
                        }
                    }
                }
            )
            print(f"✅ Sent temporary password email to {admin_email}")
        except ClientError as e:
            # SES not configured or email not verified - log temp password instead
            print(f"⚠️  Could not send email via SES: {e}")
            print(f"📧 TEMPORARY PASSWORD for {admin_email}: {temp_password}")
            print("⚠️  SAVE THIS PASSWORD - it will not be shown again!")

        return {
            'statusCode': 200,
            'body': json.dumps({
                'message': 'Admin user created successfully',
                'email': admin_email,
                'temporary_password': temp_password,
                'note': 'SAVE THIS PASSWORD - Change it on first login'
            })
        }

    except ClientError as e:
        print(f"❌ Error creating admin user: {e}")
        return {
            'statusCode': 500,
            'body': json.dumps(f'Error creating admin user: {str(e)}')
        }
    except Exception as e:
        print(f"❌ Unexpected error: {e}")
        return {
            'statusCode': 500,
            'body': json.dumps(f'Unexpected error: {str(e)}')
        }
