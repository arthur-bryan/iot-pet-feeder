# backend/pre_sign_up_handler.py
import json
import os
import boto3
from datetime import datetime
from botocore.exceptions import ClientError

# Get AWS region from Lambda environment (automatically provided)
AWS_REGION = os.environ.get('AWS_REGION', os.environ.get('AWS_DEFAULT_REGION', 'us-east-1'))

# Initialize AWS clients
dynamodb = boto3.resource('dynamodb', region_name=AWS_REGION)
sns_client = boto3.client('sns', region_name=AWS_REGION)
cognito_client = boto3.client('cognito-idp', region_name=AWS_REGION)

# Environment variables (set via Terraform)
ADMIN_EMAIL = os.environ.get('ADMIN_EMAIL')
PENDING_USERS_TABLE_NAME = os.environ.get('PENDING_USERS_TABLE_NAME')
SNS_TOPIC_ARN = os.environ.get('SNS_TOPIC_ARN')

# Validate environment variables on startup (good practice for Lambdas)
if not all([ADMIN_EMAIL, PENDING_USERS_TABLE_NAME, SNS_TOPIC_ARN]):
    print("ERROR: One or more required environment variables are missing.")
    # In a production system, you might want to raise an exception here
    # or use a dead-letter queue for events that fail due to misconfiguration.
    # For now, we'll let subsequent operations fail if variables are truly missing.

pending_users_table = dynamodb.Table(PENDING_USERS_TABLE_NAME)

def handler(event, context):
    """
    Lambda function triggered by Cognito User Pool Pre-Sign-up.
    Handles auto-confirmation for admin and sets pending status for other users.
    """
    print(f"Received Cognito Pre-Sign-up event: {json.dumps(event)}")

    user_email = event['request']['userAttributes'].get('email')
    user_pool_id = event['userPoolId']

    if not user_email:
        print("Error: User email not found in event.")
        # Fail the sign-up process if email is missing
        event['response']['autoConfirmUser'] = False
        event['response']['autoVerifyEmail'] = False
        return event

    try:
        if user_email == ADMIN_EMAIL:
            # Auto-confirm and auto-verify email for the admin user
            event['response']['autoConfirmUser'] = True
            event['response']['autoVerifyEmail'] = True
            print(f"Admin user {user_email} auto-confirmed and email auto-verified.")
        else:
            # For non-admin users, prevent auto-confirmation
            event['response']['autoConfirmUser'] = False
            event['response']['autoVerifyEmail'] = False # Email will be verified upon admin approval

            # Record pending user in DynamoDB
            pending_users_table.put_item(
                Item={
                    'email': user_email,
                    'userPoolId': user_pool_id,
                    'status': 'PENDING_APPROVAL',
                    'requestedAt': datetime.utcnow().isoformat() + "Z"
                }
            )
            print(f"User {user_email} marked as PENDING_APPROVAL in DynamoDB.")

            # Notify admin via SNS
            subject = f"New User Approval Request for Pet Feeder App - {user_email}"
            message = (
                f"A new user ({user_email}) has signed up for the Pet Feeder app "
                f"and requires your approval. "
                f"Please log in as admin to approve their access. "
                f"User Pool ID: {user_pool_id}"
            )
            sns_client.publish(
                TopicArn=SNS_TOPIC_ARN,
                Subject=subject,
                Message=message
            )
            print(f"Admin notified via SNS for new user: {user_email}")

    except ClientError as e:
        print(f"AWS Client Error: {e}")
        # If there's an AWS service error, prevent user confirmation
        event['response']['autoConfirmUser'] = False
        event['response']['autoVerifyEmail'] = False
        # You might want to add more specific error handling or logging here
    except Exception as e:
        print(f"An unexpected error occurred: {e}")
        # Prevent user confirmation on any unexpected error
        event['response']['autoConfirmUser'] = False
        event['response']['autoVerifyEmail'] = False

    return event
