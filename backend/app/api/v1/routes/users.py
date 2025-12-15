"""
User Management API Routes
Handles user approval, rejection, and deletion (admin only)
"""
import base64
import json
import os
import uuid
from datetime import datetime
from typing import Any

import boto3
from fastapi import APIRouter, Header, HTTPException
from pydantic import BaseModel, EmailStr, validator

router = APIRouter()

# Initialize AWS clients
dynamodb = boto3.resource('dynamodb', region_name=os.environ.get('AWS_REGION', 'us-east-2'))
cognito = boto3.client('cognito-idp', region_name=os.environ.get('AWS_REGION', 'us-east-2'))
sns_client = boto3.client('sns', region_name=os.environ.get('AWS_REGION', 'us-east-2'))
ses_client = boto3.client('ses', region_name=os.environ.get('AWS_REGION', 'us-east-2'))

# Environment configuration
ENVIRONMENT = os.environ.get('ENVIRONMENT', 'prd').lower()
PENDING_USERS_TABLE = os.environ.get('DYNAMO_PENDING_USERS_TABLE')
USER_POOL_ID = os.environ.get('COGNITO_USER_POOL_ID')
SNS_TOPIC_ARN = os.environ.get('SNS_TOPIC_ARN')
SES_SENDER_EMAIL = os.environ.get('SES_SENDER_EMAIL')
SES_CONFIGURATION_SET = os.environ.get('SES_CONFIGURATION_SET')


# ===== Models =====
class AccessRequestModel(BaseModel):
    email: EmailStr
    full_name: str
    reason: str | None = None


class ApproveUserRequest(BaseModel):
    temporary_password: str | None = None  # If not provided, auto-generate

    @validator('temporary_password')
    def validate_password_complexity(cls, v):
        """Validate password meets Cognito requirements."""
        if v is None:
            return v  # Auto-generate will be used

        # Length check
        if len(v) < 8:
            raise ValueError("Password must be at least 8 characters")

        # Uppercase check
        if not any(c.isupper() for c in v):
            raise ValueError("Password must contain at least one uppercase letter")

        # Lowercase check
        if not any(c.islower() for c in v):
            raise ValueError("Password must contain at least one lowercase letter")

        # Digit check
        if not any(c.isdigit() for c in v):
            raise ValueError("Password must contain at least one digit")

        # Special character check
        import re
        if not re.search(r'[!@#$%^&*(),.?":{}|<>]', v):
            raise ValueError("Password must contain at least one special character")

        return v


# ===== Helper Functions =====
def generate_temp_password(length=12):
    """Generate secure temporary password"""
    import secrets
    import string
    alphabet = string.ascii_letters + string.digits + "!@#$%^&*"
    password = ''.join(secrets.choice(alphabet) for _ in range(length))

    # Ensure meets requirements
    if (any(c.islower() for c in password) and
        any(c.isupper() for c in password) and
        any(c.isdigit() for c in password)):
        return password
    else:
        return generate_temp_password(length)


def send_welcome_email(user_email: str, temp_password: str, full_name: str = None) -> bool:
    """
    Send welcome email with temporary password via AWS SES.
    Also creates SNS subscription for optional feed notifications.
    """
    if not SES_SENDER_EMAIL:
        print("Warning: SES_SENDER_EMAIL not configured, cannot send welcome email")
        return False

    display_name = full_name or user_email.split('@')[0]
    app_url = os.environ.get('FRONTEND_URL', 'https://your-app-url.com')

    subject = "Welcome to Pet Feeder - Account Approved"

    # HTML email body
    html_body = f"""
    <html>
    <head></head>
    <body style="font-family: Arial, sans-serif; line-height: 1.6; color: #333;">
        <div style="max-width: 600px; margin: 0 auto; padding: 20px;">
            <h2 style="color: #4F46E5;">Welcome to Pet Feeder!</h2>
            <p>Hello <strong>{display_name}</strong>,</p>

            <p>Your access request has been approved! You can now log in to the Pet Feeder system.</p>

            <div style="background-color: #F3F4F6; border-left: 4px solid #4F46E5; padding: 15px; margin: 20px 0;">
                <p style="margin: 0;"><strong>Login Credentials:</strong></p>
                <p style="margin: 5px 0;">Email: <code>{user_email}</code></p>
                <p style="margin: 5px 0;">Temporary Password: <code style="background-color: #FEF3C7; padding: 2px 6px; border-radius: 3px;">{temp_password}</code></p>
            </div>

            <p><strong>⚠️ IMPORTANT:</strong> You will be required to change your password on first login.</p>

            <p><a href="{app_url}" style="display: inline-block; background-color: #4F46E5; color: white; padding: 12px 24px; text-decoration: none; border-radius: 6px; margin-top: 15px;">Log In Now</a></p>

            <hr style="border: none; border-top: 1px solid #E5E7EB; margin: 30px 0;">

            <h3 style="color: #4F46E5; font-size: 16px;">Optional: Enable Email Notifications</h3>
            <p>After logging in, you can enable email notifications for feed events in Settings. This will send you an AWS SNS confirmation email - click the link to start receiving notifications when your pet is fed.</p>

            <p style="color: #6B7280; font-size: 14px; margin-top: 30px;">If you did not request this account, please contact the system administrator immediately.</p>

            <p style="margin-top: 30px;">Best regards,<br><strong>Pet Feeder System</strong></p>
        </div>
    </body>
    </html>
    """

    # Plain text fallback
    text_body = f"""Hello {display_name},

Your access request to the Pet Feeder system has been approved!

Login Credentials:
Email: {user_email}
Temporary Password: {temp_password}

IMPORTANT: You will be required to change your password on first login.

Login URL: {app_url}

Optional: After logging in, you can enable email notifications in Settings to receive alerts when your pet is fed.

If you did not request this account, please contact the system administrator immediately.

Best regards,
Pet Feeder System
"""

    try:
        # Send email via SES
        ses_params = {
            'Source': SES_SENDER_EMAIL,
            'Destination': {
                'ToAddresses': [user_email]
            },
            'Message': {
                'Subject': {
                    'Data': subject,
                    'Charset': 'UTF-8'
                },
                'Body': {
                    'Text': {
                        'Data': text_body,
                        'Charset': 'UTF-8'
                    },
                    'Html': {
                        'Data': html_body,
                        'Charset': 'UTF-8'
                    }
                }
            }
        }

        # Add configuration set if available
        if SES_CONFIGURATION_SET:
            ses_params['ConfigurationSetName'] = SES_CONFIGURATION_SET

        response = ses_client.send_email(**ses_params)
        message_id = response.get('MessageId')

        print(f"Welcome email sent to {user_email} via SES (MessageId: {message_id})")

        # Optionally create SNS subscription for feed notifications
        # User can confirm this later to receive feed event emails
        if SNS_TOPIC_ARN:
            try:
                sns_client.subscribe(
                    TopicArn=SNS_TOPIC_ARN,
                    Protocol='email',
                    Endpoint=user_email,
                    ReturnSubscriptionArn=True
                )
                print(f"SNS subscription created for {user_email} (optional feed notifications)")
            except Exception as sns_error:
                print(f"Warning: Could not create SNS subscription: {sns_error}")

        return True

    except Exception as e:
        print(f"Failed to send welcome email to {user_email}: {e}")
        return False


def extract_email_from_token(authorization: str) -> str | None:
    """
    Extract email from Cognito ID Token (JWT).
    The ID token is already validated by API Gateway's Cognito Authorizer,
    so we just need to decode the payload to extract the email claim.
    """
    if not authorization or not authorization.startswith('Bearer '):
        return None

    token = authorization.replace('Bearer ', '')

    try:
        # JWT format: header.payload.signature
        # We only need the payload (middle part)
        parts = token.split('.')
        if len(parts) != 3:
            print(f"Invalid JWT token format: expected 3 parts, got {len(parts)}")
            return None

        payload = parts[1]

        # Add padding if needed for base64 decoding
        padding = 4 - len(payload) % 4
        if padding != 4:
            payload += '=' * padding

        # Decode base64 payload
        decoded_bytes = base64.urlsafe_b64decode(payload)
        decoded_str = decoded_bytes.decode('utf-8')
        payload_data = json.loads(decoded_str)

        # ID tokens contain 'email' claim
        email = payload_data.get('email')
        if email:
            return email

        print("No email found in token payload")
        print(f"Token payload keys: {list(payload_data.keys())}")
        return None

    except Exception as e:
        print(f"Error decoding JWT token: {e}")
        return None


def is_admin(email: str) -> bool:
    """Check if user is in admin group"""
    try:
        response = cognito.admin_list_groups_for_user(
            Username=email,
            UserPoolId=USER_POOL_ID
        )

        groups = [group['GroupName'] for group in response.get('Groups', [])]
        return 'admin' in groups
    except Exception as e:
        print(f"Error checking admin status: {e}")
        return False


def get_user_email_from_attributes(attributes: list[dict]) -> str | None:
    """Extract email from Cognito user attributes list"""
    for attr in attributes:
        if attr['Name'] == 'email':
            return attr['Value']
    return None


def get_user_groups(username: str) -> list[str]:
    """Get list of group names for a Cognito user"""
    try:
        response = cognito.admin_list_groups_for_user(
            Username=username,
            UserPoolId=USER_POOL_ID
        )
        return [g['GroupName'] for g in response.get('Groups', [])]
    except Exception:
        return []


def format_cognito_user(user: dict) -> dict:
    """Format Cognito user data for API response"""
    user_email = get_user_email_from_attributes(user.get('Attributes', []))
    groups = get_user_groups(user['Username'])
    return {
        'Username': user['Username'],
        'Email': user_email,
        'UserStatus': user['UserStatus'],
        'Enabled': user['Enabled'],
        'UserCreateDate': user['UserCreateDate'].isoformat(),
        'UserLastModifiedDate': user['UserLastModifiedDate'].isoformat(),
        'Groups': groups
    }


def verify_admin_access(authorization: str | None) -> str:
    """Verify admin access and return email, or raise HTTPException"""
    email = extract_email_from_token(authorization)
    if not email or not is_admin(email):
        raise HTTPException(status_code=403, detail="Admin access required")
    return email


# ===== Public Endpoints =====
@router.post("/users/request-access", response_model=dict[str, Any])
async def request_access(request: AccessRequestModel):
    """
    Public endpoint for users to request access.
    Creates a pending user request in DynamoDB.
    """
    if not PENDING_USERS_TABLE:
        raise HTTPException(
            status_code=500,
            detail="Pending users table not configured"
        )

    try:
        # Check if user already exists in Cognito
        try:
            cognito.admin_get_user(
                UserPoolId=USER_POOL_ID,
                Username=request.email
            )
            raise HTTPException(
                status_code=400,
                detail="User already exists. Please log in."
            )
        except cognito.exceptions.UserNotFoundException:
            # User doesn't exist, proceed with request
            pass

        # Check if request already exists
        pending_table = dynamodb.Table(PENDING_USERS_TABLE)
        existing = pending_table.scan(
            FilterExpression='email = :email AND #status = :status',
            ExpressionAttributeNames={'#status': 'status'},
            ExpressionAttributeValues={
                ':email': request.email,
                ':status': 'pending'
            }
        )

        if existing.get('Items'):
            raise HTTPException(
                status_code=400,
                detail="Access request already pending. Please wait for admin approval."
            )

        # Create pending request
        request_id = str(uuid.uuid4())
        pending_request = {
            'request_id': request_id,
            'email': request.email,
            'full_name': request.full_name,
            'reason': request.reason,
            'status': 'pending',
            'requested_at': datetime.utcnow().isoformat(),
            'updated_at': datetime.utcnow().isoformat()
        }

        pending_table.put_item(Item=pending_request)

        return {
            'message': 'Access request submitted successfully',
            'request_id': request_id,
            'status': 'pending'
        }

    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e)) from e


# ===== Admin Endpoints (require authentication and admin role) =====
@router.get("/users/pending")
async def list_pending_requests(authorization: str | None = Header(None)):
    """
    List all pending user access requests.
    Admin only.
    """
    verify_admin_access(authorization)

    try:
        pending_table = dynamodb.Table(PENDING_USERS_TABLE)
        response = pending_table.scan(
            FilterExpression='#status = :status',
            ExpressionAttributeNames={'#status': 'status'},
            ExpressionAttributeValues={':status': 'pending'}
        )

        return {'requests': response.get('Items', [])}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e)) from e


@router.post("/users/approve/{request_id}", response_model=dict[str, Any])
async def approve_user_request(
    request_id: str,
    request_body: ApproveUserRequest | None = None,
    authorization: str | None = Header(None)
):
    """
    Approve a pending user request and create Cognito user.
    Admin only.
    """
    email = verify_admin_access(authorization)

    try:
        # Get pending request
        pending_table = dynamodb.Table(PENDING_USERS_TABLE)
        response = pending_table.get_item(Key={'request_id': request_id})
        pending_user = response.get('Item')

        if not pending_user:
            raise HTTPException(status_code=404, detail="Request not found")

        if pending_user.get('status') != 'pending':
            raise HTTPException(
                status_code=400,
                detail=f"Request already {pending_user.get('status')}"
            )

        # Generate or use provided temporary password
        temp_password = (request_body.temporary_password
                        if request_body and request_body.temporary_password
                        else generate_temp_password())

        # Create Cognito user
        user_email = pending_user['email']
        cognito.admin_create_user(
            UserPoolId=USER_POOL_ID,
            Username=user_email,
            UserAttributes=[
                {'Name': 'email', 'Value': user_email},
                {'Name': 'email_verified', 'Value': 'true'}
            ],
            TemporaryPassword=temp_password,
            MessageAction='SUPPRESS'  # We'll send custom email
        )

        # Update pending request status
        pending_table.update_item(
            Key={'request_id': request_id},
            UpdateExpression='SET #status = :status, updated_at = :updated_at, approved_by = :approved_by',
            ExpressionAttributeNames={'#status': 'status'},
            ExpressionAttributeValues={
                ':status': 'approved',
                ':updated_at': datetime.utcnow().isoformat(),
                ':approved_by': email
            }
        )

        # Send welcome email with temporary password via SES
        full_name = pending_user.get('full_name')
        email_sent = send_welcome_email(user_email, temp_password, full_name)

        return {
            'message': 'User approved and created successfully',
            'email': user_email,
            'email_sent': email_sent
        }

    except cognito.exceptions.UsernameExistsException as e:
        raise HTTPException(status_code=400, detail="User already exists in Cognito") from e
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e)) from e


@router.post("/users/reject/{request_id}", response_model=dict[str, Any])
async def reject_user_request(
    request_id: str,
    authorization: str | None = Header(None)
):
    """
    Reject a pending user request.
    Admin only.
    """
    email = verify_admin_access(authorization)

    try:
        # Get pending request
        pending_table = dynamodb.Table(PENDING_USERS_TABLE)
        response = pending_table.get_item(Key={'request_id': request_id})
        pending_user = response.get('Item')

        if not pending_user:
            raise HTTPException(status_code=404, detail="Request not found")

        if pending_user.get('status') != 'pending':
            raise HTTPException(
                status_code=400,
                detail=f"Request already {pending_user.get('status')}"
            )

        # Update status to rejected
        pending_table.update_item(
            Key={'request_id': request_id},
            UpdateExpression='SET #status = :status, updated_at = :updated_at, rejected_by = :rejected_by',
            ExpressionAttributeNames={'#status': 'status'},
            ExpressionAttributeValues={
                ':status': 'rejected',
                ':updated_at': datetime.utcnow().isoformat(),
                ':rejected_by': email
            }
        )

        return {
            'message': 'User request rejected',
            'request_id': request_id
        }
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e)) from e


@router.delete("/users/{user_email}", response_model=dict[str, Any])
async def delete_user(
    user_email: str,
    authorization: str | None = Header(None)
):
    """
    Delete a user and all associated data.
    Removes:
    - Cognito user account
    - SNS topic subscriptions
    - Pending user requests from DynamoDB
    Admin only. Cannot delete yourself.
    """
    admin_email = verify_admin_access(authorization)

    # Prevent self-deletion
    if admin_email == user_email:
        raise HTTPException(
            status_code=400,
            detail="Cannot delete your own account"
        )

    deletion_results = {
        'cognito': False,
        'sns_subscriptions': [],
        'pending_requests': []
    }

    try:
        # 1. Delete user from Cognito
        try:
            cognito.admin_delete_user(
                UserPoolId=USER_POOL_ID,
                Username=user_email
            )
            deletion_results['cognito'] = True
        except cognito.exceptions.UserNotFoundException:
            # User doesn't exist in Cognito, continue with cleanup
            pass

        # 2. Remove SNS topic subscriptions
        if SNS_TOPIC_ARN:
            try:
                response = sns_client.list_subscriptions_by_topic(TopicArn=SNS_TOPIC_ARN)
                for subscription in response.get('Subscriptions', []):
                    if subscription.get('Endpoint') == user_email:
                        subscription_arn = subscription.get('SubscriptionArn')
                        if subscription_arn and subscription_arn != 'PendingConfirmation':
                            sns_client.unsubscribe(SubscriptionArn=subscription_arn)
                            deletion_results['sns_subscriptions'].append(subscription_arn)
            except Exception as e:
                print(f"Error removing SNS subscriptions for {user_email}: {e}")

        # 3. Delete pending user requests from DynamoDB
        if PENDING_USERS_TABLE:
            try:
                pending_table = dynamodb.Table(PENDING_USERS_TABLE)
                # Scan for all requests with this email
                response = pending_table.scan(
                    FilterExpression='email = :email',
                    ExpressionAttributeValues={':email': user_email}
                )

                for item in response.get('Items', []):
                    request_id = item.get('request_id')
                    pending_table.delete_item(Key={'request_id': request_id})
                    deletion_results['pending_requests'].append(request_id)
            except Exception as e:
                print(f"Error removing pending requests for {user_email}: {e}")

        return {
            'message': 'User and associated data deleted successfully',
            'email': user_email,
            'deleted': deletion_results,
            'summary': f"Removed from Cognito: {deletion_results['cognito']}, "
                      f"SNS subscriptions removed: {len(deletion_results['sns_subscriptions'])}, "
                      f"Pending requests removed: {len(deletion_results['pending_requests'])}"
        }

    except HTTPException:  # pragma: no cover
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e)) from e


@router.get("/users")
async def list_users(authorization: str | None = Header(None)):
    """
    List all users in Cognito.
    Admin only.
    """
    verify_admin_access(authorization)

    try:
        users = []
        paginator = cognito.get_paginator('list_users')

        for page in paginator.paginate(UserPoolId=USER_POOL_ID):
            for user in page['Users']:
                users.append(format_cognito_user(user))

        return {'users': users}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e)) from e
