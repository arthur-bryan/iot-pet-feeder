"""
Tests for config CRUD operations.
"""
from unittest.mock import MagicMock, patch

import pytest
from botocore.exceptions import ClientError


class TestConfigCrud:
    """Test cases for config CRUD operations."""

    @patch('app.crud.config.get_config_table')
    @pytest.mark.asyncio
    async def test_fetch_config_setting_found(self, mock_get_table):
        """Test fetching existing config setting."""
        mock_table = MagicMock()
        mock_table.get_item.return_value = {
            'Item': {'config_key': 'TEST_KEY', 'value': 'test_value'}
        }
        mock_get_table.return_value = mock_table

        from app.crud.config import fetch_config_setting
        result = await fetch_config_setting('TEST_KEY')

        assert result is not None
        assert result['config_key'] == 'TEST_KEY'
        assert result['value'] == 'test_value'
        mock_table.get_item.assert_called_once()

    @patch('app.crud.config.get_config_table')
    @pytest.mark.asyncio
    async def test_fetch_config_setting_not_found(self, mock_get_table):
        """Test fetching non-existent config setting."""
        mock_table = MagicMock()
        mock_table.get_item.return_value = {}
        mock_get_table.return_value = mock_table

        from app.crud.config import fetch_config_setting
        result = await fetch_config_setting('NONEXISTENT_KEY')

        assert result is None

    @patch('app.crud.config.get_config_table')
    @pytest.mark.asyncio
    async def test_fetch_config_setting_error(self, mock_get_table):
        """Test error handling when fetching config setting."""
        mock_table = MagicMock()
        mock_table.get_item.side_effect = ClientError(
            {'Error': {'Code': '500', 'Message': 'Test error'}},
            'GetItem'
        )
        mock_get_table.return_value = mock_table

        from app.crud.config import fetch_config_setting
        with pytest.raises(ClientError):
            await fetch_config_setting('TEST_KEY')

    @patch('app.crud.config.get_config_table')
    @pytest.mark.asyncio
    async def test_update_config_setting_success(self, mock_get_table):
        """Test updating config setting."""
        mock_table = MagicMock()
        mock_table.put_item.return_value = {}
        mock_get_table.return_value = mock_table

        from app.crud.config import update_config_setting
        result = await update_config_setting('TEST_KEY', 'new_value')

        assert result is not None
        assert result['config_key'] == 'TEST_KEY'
        assert result['value'] == 'new_value'
        mock_table.put_item.assert_called_once()

    @patch('app.crud.config.get_config_table')
    @pytest.mark.asyncio
    async def test_update_config_setting_error(self, mock_get_table):
        """Test error handling when updating config setting."""
        mock_table = MagicMock()
        mock_table.put_item.side_effect = ClientError(
            {'Error': {'Code': '500', 'Message': 'Test error'}},
            'PutItem'
        )
        mock_get_table.return_value = mock_table

        from app.crud.config import update_config_setting
        with pytest.raises(ClientError):
            await update_config_setting('TEST_KEY', 'value')
