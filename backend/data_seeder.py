"""
Demo Data Seeder Lambda Handler

This Lambda function seeds the demo environment with realistic historical data.
Should be invoked once after demo infrastructure deployment.

Trigger: Manual invocation or one-time EventBridge schedule
"""
import json
import os

from app.services.simulator import seed_historical_data


def handler(event, context):
    """
    Seed demo database with historical feed events

    Event parameters (optional):
        - days_back: Number of days of history (default: 30)
        - events_per_day: Average events per day (default: 8)
    """

    # Get parameters from event or use defaults
    days_back = event.get('days_back', 30)
    events_per_day = event.get('events_per_day', 8)

    feed_history_table = os.environ['DYNAMO_FEED_HISTORY_TABLE']

    print(f"Seeding demo data: {days_back} days back, ~{events_per_day} events/day")

    try:
        # Generate and save historical events
        import asyncio
        events_created = asyncio.run(seed_historical_data(
            feed_history_table_name=feed_history_table,
            days_back=days_back,
            events_per_day=events_per_day
        ))

        print(f"Successfully created {events_created} demo events")

        return {
            'statusCode': 200,
            'body': json.dumps({
                'message': 'Demo data seeded successfully',
                'events_created': events_created,
                'days_back': days_back
            })
        }

    except Exception as e:
        print(f"Error seeding demo data: {str(e)}")
        return {
            'statusCode': 500,
            'body': json.dumps({
                'error': 'Failed to seed demo data',
                'details': str(e)
            })
        }
