# app/api/v1/routes/notifications.py

from fastapi import APIRouter, HTTPException
from pydantic import BaseModel, EmailStr
import boto3
import os
from botocore.exceptions import ClientError

router = APIRouter()

# Environment variables
SNS_TOPIC_ARN = os.environ.get("SNS_TOPIC_ARN")
AWS_REGION = os.environ.get("AWS_REGION", "us-east-1")

# Initialize SNS client
sns_client = boto3.client('sns', region_name=AWS_REGION)


class SubscribeRequest(BaseModel):
    email: EmailStr


class UnsubscribeRequest(BaseModel):
    subscription_arn: str


@router.post("/notifications/subscribe")
async def subscribe_to_notifications(request: SubscribeRequest):
    """
    Subscribe an email address to feed notifications via SNS.
    User will receive a confirmation email from AWS SNS.
    """
    try:
        response = sns_client.subscribe(
            TopicArn=SNS_TOPIC_ARN,
            Protocol='email',
            Endpoint=request.email,
            Attributes={
                'FilterPolicy': '{"email":["' + request.email + '"]}'
            },
            ReturnSubscriptionArn=True
        )

        subscription_arn = response.get('SubscriptionArn')

        return {
            "message": f"Subscription request sent to {request.email}. Please check your email to confirm.",
            "subscription_arn": subscription_arn,
            "status": "pending_confirmation" if subscription_arn == "pending confirmation" else "confirmed"
        }

    except ClientError as e:
        print(f"Error subscribing to SNS: {e}")
        raise HTTPException(status_code=500, detail=f"Failed to subscribe: {str(e)}")


@router.post("/notifications/unsubscribe")
async def unsubscribe_from_notifications(request: UnsubscribeRequest):
    """
    Unsubscribe from feed notifications.
    """
    try:
        sns_client.unsubscribe(SubscriptionArn=request.subscription_arn)
        return {"message": "Successfully unsubscribed from notifications"}

    except ClientError as e:
        print(f"Error unsubscribing from SNS: {e}")
        raise HTTPException(status_code=500, detail=f"Failed to unsubscribe: {str(e)}")


@router.get("/notifications/subscriptions/{email}")
async def get_subscription_status(email: str):
    """
    Check if an email address is subscribed to notifications.
    Returns subscription status and ARN if subscribed.
    """
    try:
        # List all subscriptions for the topic
        response = sns_client.list_subscriptions_by_topic(TopicArn=SNS_TOPIC_ARN)

        for subscription in response.get('Subscriptions', []):
            if subscription.get('Endpoint') == email:
                return {
                    "subscribed": True,
                    "subscription_arn": subscription.get('SubscriptionArn'),
                    "status": "confirmed" if subscription.get('SubscriptionArn') != 'PendingConfirmation' else "pending_confirmation"
                }

        return {
            "subscribed": False,
            "subscription_arn": None,
            "status": "not_subscribed"
        }

    except ClientError as e:
        print(f"Error checking subscription status: {e}")
        raise HTTPException(status_code=500, detail=f"Failed to check subscription: {str(e)}")
