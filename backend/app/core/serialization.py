"""Shared serialization utilities for DynamoDB."""

from decimal import Decimal
from typing import Any


def convert_decimal(obj: Any) -> Any:
    """
    Recursively converts DynamoDB Decimal types to int or float for JSON serialization.

    Args:
        obj: Any Python object that may contain Decimal values

    Returns:
        The same structure with Decimal values converted to int/float
    """
    if isinstance(obj, list):
        return [convert_decimal(i) for i in obj]
    if isinstance(obj, dict):
        return {k: convert_decimal(v) for k, v in obj.items()}
    if isinstance(obj, Decimal):
        return int(obj) if obj % 1 == 0 else float(obj)
    return obj
