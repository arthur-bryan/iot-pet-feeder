#!/usr/bin/env python3
"""
Demo Data Seeder - Standalone Script

Populates demo DynamoDB tables with 3 months of realistic historical feed data.
Run this script AFTER deploying demo infrastructure.

Usage:
    python seed_demo_data.py --region us-east-2 --environment demo

Requirements:
    - AWS credentials configured (via ~/.aws/credentials or environment variables)
    - boto3 installed: pip install boto3
"""

import argparse
import random
import uuid
from datetime import datetime, timedelta
from decimal import Decimal
from typing import Any

import boto3


class DemoDataSeeder:
    """Seeds demo DynamoDB with realistic historical data"""

    def __init__(self, region: str, environment: str, project_name: str = "iot-pet-feeder"):
        self.region = region
        self.environment = environment
        self.project_name = project_name
        self.dynamodb = boto3.resource('dynamodb', region_name=region)

        # Table names
        self.feed_history_table_name = f"{project_name}-feed-history-{environment}"
        self.device_status_table_name = f"{project_name}-device-status-{environment}"
        self.feed_schedule_table_name = f"{project_name}-feed-schedules-{environment}"

        # Tables
        self.feed_history_table = self.dynamodb.Table(self.feed_history_table_name)
        self.device_status_table = self.dynamodb.Table(self.device_status_table_name)
        self.feed_schedule_table = self.dynamodb.Table(self.feed_schedule_table_name)

        self.thing_id = "demo-device"

        # Default schedule IDs (will be created in seed_schedules)
        self.morning_schedule_id = None
        self.evening_schedule_id = None

    @staticmethod
    def to_decimal(value: float, precision: int = 2) -> Decimal:
        """Convert float to Decimal for DynamoDB compatibility"""
        return Decimal(str(round(value, precision)))

    def generate_manual_feed_event(self, timestamp: datetime, user_email: str) -> dict[str, Any]:
        """Generate a manual feed event - ADDS food to bowl"""
        weight_before = random.uniform(150, 400)  # Lower range since we're adding
        dispensed = random.uniform(15, 25)

        return {
            'feed_id': str(uuid.uuid4()),
            'timestamp': timestamp.isoformat() + 'Z',
            'trigger_method': 'api',
            'requested_by': user_email,
            'mode': 'manual',
            'status': 'completed',
            'event_type': 'manual_feed',
            'weight_before_g': self.to_decimal(weight_before),
            'weight_after_g': self.to_decimal(weight_before + dispensed),  # ADD food
            'weight_delta_g': self.to_decimal(dispensed),  # POSITIVE = food added
            'servo_open_duration_ms': 3000,
            'thing_id': self.thing_id,
            'demo_mode': True
        }

    def generate_scheduled_feed_event(self, timestamp: datetime, schedule_id: str = None) -> dict[str, Any]:
        """Generate a scheduled feed event - ADDS food to bowl"""
        weight_before = random.uniform(150, 400)  # Lower range since we're adding
        dispensed = random.uniform(15, 25)

        event = {
            'feed_id': str(uuid.uuid4()),
            'timestamp': timestamp.isoformat() + 'Z',
            'trigger_method': 'schedule',
            'requested_by': 'system',
            'mode': 'scheduled',
            'status': 'completed',
            'event_type': 'scheduled_feed',
            'weight_before_g': self.to_decimal(weight_before),
            'weight_after_g': self.to_decimal(weight_before + dispensed),  # ADD food
            'weight_delta_g': self.to_decimal(dispensed),  # POSITIVE = food added
            'servo_open_duration_ms': 3000,
            'thing_id': self.thing_id,
            'demo_mode': True
        }

        if schedule_id:
            event['schedule_id'] = schedule_id

        return event

    def generate_consumption_event(self, timestamp: datetime) -> dict[str, Any]:
        """Generate a consumption event (pet eating from bowl)"""
        weight_before = random.uniform(200, 450)
        consumed = random.uniform(30, 60)

        return {
            'feed_id': str(uuid.uuid4()),
            'timestamp': timestamp.isoformat() + 'Z',
            'trigger_method': 'device',
            'requested_by': 'system',
            'mode': 'consumption',
            'status': 'completed',
            'event_type': 'consumption',
            'weight_before_g': self.to_decimal(weight_before),
            'weight_after_g': self.to_decimal(max(0, weight_before - consumed)),
            'weight_delta_g': self.to_decimal(-consumed),
            'thing_id': self.thing_id,
            'demo_mode': True
        }

    def generate_refill_event(self, timestamp: datetime) -> dict[str, Any]:
        """Generate a refill event (human adding food to bowl)"""
        weight_before = random.uniform(50, 150)
        refilled = random.uniform(300, 450)

        return {
            'feed_id': str(uuid.uuid4()),
            'timestamp': timestamp.isoformat() + 'Z',
            'trigger_method': 'device',
            'requested_by': 'system',
            'mode': 'refill',
            'status': 'completed',
            'event_type': 'refill',
            'weight_before_g': self.to_decimal(weight_before),
            'weight_after_g': self.to_decimal(weight_before + refilled),
            'weight_delta_g': self.to_decimal(refilled),
            'thing_id': self.thing_id,
            'demo_mode': True
        }

    def seed_schedules(self) -> bool:
        """Create default daily schedules (9 AM and 9 PM UTC-3)"""
        print("Creating default schedules...")

        # Calculate next scheduled times (tomorrow at 12:00 UTC and 00:00 UTC)
        tomorrow = datetime.utcnow() + timedelta(days=1)
        morning_time = tomorrow.replace(hour=12, minute=0, second=0, microsecond=0)
        evening_time = tomorrow.replace(hour=0, minute=0, second=0, microsecond=0)

        # Schedule 1: 9 AM UTC-3 (12:00 UTC)
        self.morning_schedule_id = str(uuid.uuid4())
        morning_schedule = {
            'schedule_id': self.morning_schedule_id,
            'requested_by': 'system',
            'scheduled_time': morning_time.isoformat() + 'Z',  # Full ISO datetime
            'recurrence': 'daily',
            'feed_cycles': 1,
            'enabled': True,
            'created_at': datetime.utcnow().isoformat() + 'Z',
            'updated_at': datetime.utcnow().isoformat() + 'Z',
            'next_execution': morning_time.isoformat() + 'Z'
        }

        # Schedule 2: 9 PM UTC-3 (00:00 UTC next day)
        self.evening_schedule_id = str(uuid.uuid4())
        evening_schedule = {
            'schedule_id': self.evening_schedule_id,
            'requested_by': 'system',
            'scheduled_time': evening_time.isoformat() + 'Z',  # Full ISO datetime
            'recurrence': 'daily',
            'feed_cycles': 1,
            'enabled': True,
            'created_at': datetime.utcnow().isoformat() + 'Z',
            'updated_at': datetime.utcnow().isoformat() + 'Z',
            'next_execution': evening_time.isoformat() + 'Z'
        }

        try:
            self.feed_schedule_table.put_item(Item=morning_schedule)
            print("✅ Created Morning Feed schedule (9 AM UTC-3)")

            self.feed_schedule_table.put_item(Item=evening_schedule)
            print("✅ Created Evening Feed schedule (9 PM UTC-3)")

            return True
        except Exception as e:
            print(f"❌ Error creating schedules: {e}")
            return False

    def seed_feed_history(self, days_back: int = 90) -> int:
        """
        Seed feed history table with realistic data.

        Pattern:
        - 2-3 scheduled feeds per day (morning ~7-9 AM, evening ~6-8 PM)
        - 3-5 consumption events per day (pet eating throughout day)
        - 1 refill every 3-4 days
        - Occasional manual feeds (20% of days)

        Args:
            days_back: Number of days of history to generate (default: 90 = 3 months)

        Returns:
            Number of events created
        """
        print(f"Seeding {days_back} days of feed history...")

        current_time = datetime.utcnow()
        events_created = 0
        batch_size = 25  # DynamoDB batch write limit

        demo_users = [
            'demo-user@example.com',
            'pet-owner@example.com',
            'family-member@example.com'
        ]

        all_events = []

        for day_offset in range(days_back, 0, -1):
            day_start = current_time - timedelta(days=day_offset)

            # Morning scheduled feed at exactly 12:00 UTC (9 AM UTC-3)
            morning_time = day_start.replace(hour=12, minute=0, second=0, microsecond=0)
            all_events.append(self.generate_scheduled_feed_event(morning_time, self.morning_schedule_id))

            # Evening scheduled feed at exactly 00:00 UTC (9 PM UTC-3)
            evening_time = day_start.replace(hour=0, minute=0, second=0, microsecond=0)
            all_events.append(self.generate_scheduled_feed_event(evening_time, self.evening_schedule_id))

            # Random consumption events throughout the day (3-5 times)
            num_consumptions = random.randint(3, 5)
            for _ in range(num_consumptions):
                consumption_hour = random.randint(0, 23)
                consumption_minute = random.randint(0, 59)
                consumption_time = day_start.replace(hour=consumption_hour, minute=consumption_minute, second=0, microsecond=0)
                all_events.append(self.generate_consumption_event(consumption_time))

            # Occasional manual feeds (20% chance)
            if random.random() < 0.2:
                manual_hour = random.randint(10, 16)
                manual_minute = random.randint(0, 59)
                manual_time = day_start.replace(hour=manual_hour, minute=manual_minute, second=0, microsecond=0)
                manual_user = random.choice(demo_users)
                all_events.append(self.generate_manual_feed_event(manual_time, manual_user))

            # Refill every 3-4 days
            if day_offset % random.randint(3, 4) == 0:
                refill_hour = random.randint(9, 11)
                refill_minute = random.randint(0, 59)
                refill_time = day_start.replace(hour=refill_hour, minute=refill_minute, second=0, microsecond=0)
                all_events.append(self.generate_refill_event(refill_time))

        # Batch write to DynamoDB
        print(f"Writing {len(all_events)} events to DynamoDB in batches of {batch_size}...")

        with self.feed_history_table.batch_writer() as batch:
            for i, event in enumerate(all_events):
                batch.put_item(Item=event)
                events_created += 1

                if (i + 1) % 100 == 0:
                    print(f"  Progress: {i + 1}/{len(all_events)} events written...")

        print(f"✅ Successfully created {events_created} feed history events")
        return events_created

    def update_device_status(self) -> bool:
        """Update device status to show simulated current state"""
        print("Updating device status...")

        status = {
            'thing_id': self.thing_id,
            'timestamp': datetime.utcnow().isoformat() + 'Z',
            'current_weight_g': self.to_decimal(random.uniform(400, 500)),
            'servo_state': 'closed',
            'wifi_connected': True,
            'mqtt_connected': True,
            'event_type': 'status_update',
            'mode': 'DEMO'
        }

        try:
            self.device_status_table.put_item(Item=status)
            print(f"✅ Device status updated: {status['current_weight_g']}g")
            return True
        except Exception as e:
            print(f"❌ Error updating device status: {e}")
            return False

    def seed_all(self, days_back: int = 90):
        """Seed all demo data"""
        print(f"\n{'='*60}")
        print("Demo Data Seeder for IoT Pet Feeder")
        print(f"{'='*60}")
        print(f"Region: {self.region}")
        print(f"Environment: {self.environment}")
        print(f"Feed History Table: {self.feed_history_table_name}")
        print(f"Feed Schedule Table: {self.feed_schedule_table_name}")
        print(f"Device Status Table: {self.device_status_table_name}")
        print(f"{'='*60}\n")

        # Create default schedules first
        if not self.seed_schedules():
            print("Warning: Failed to create schedules, continuing with feed history...")

        # Seed feed history
        events_created = self.seed_feed_history(days_back)

        # Update device status
        self.update_device_status()

        print(f"\n{'='*60}")
        print("✅ Demo data seeding complete!")
        print(f"{'='*60}")
        print(f"Total events created: {events_created}")
        print(f"Time range: {days_back} days ({days_back // 30} months)")
        print(f"{'='*60}\n")


def main():
    parser = argparse.ArgumentParser(
        description='Seed demo DynamoDB tables with historical feed data'
    )
    parser.add_argument(
        '--region',
        default='us-east-2',
        help='AWS region (default: us-east-2)'
    )
    parser.add_argument(
        '--environment',
        default='demo',
        help='Environment name (default: demo)'
    )
    parser.add_argument(
        '--project-name',
        default='iot-pet-feeder',
        help='Project name (default: iot-pet-feeder)'
    )
    parser.add_argument(
        '--days',
        type=int,
        default=90,
        help='Number of days of history to generate (default: 90 = 3 months)'
    )

    args = parser.parse_args()

    # Validate AWS credentials
    try:
        boto3.client('sts', region_name=args.region).get_caller_identity()
    except Exception as e:
        print("❌ Error: AWS credentials not configured properly")
        print(f"   {e}")
        print("\nPlease configure AWS credentials using one of:")
        print("  - aws configure")
        print("  - Set AWS_ACCESS_KEY_ID and AWS_SECRET_ACCESS_KEY environment variables")
        print("  - Use AWS IAM role (if running on EC2)")
        return 1

    # Create seeder and run
    seeder = DemoDataSeeder(
        region=args.region,
        environment=args.environment,
        project_name=args.project_name
    )

    try:
        seeder.seed_all(days_back=args.days)
        return 0
    except Exception as e:
        print(f"\n❌ Error during seeding: {e}")
        import traceback
        traceback.print_exc()
        return 1


if __name__ == '__main__':
    exit(main())
