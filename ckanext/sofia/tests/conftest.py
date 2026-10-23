"""Prevent CKAN's destructive database fixtures from using live databases."""

import os
import re
from urllib.parse import urlsplit

import pytest


def _require_test_database(url, setting):
    database = urlsplit(str(url)).path.rsplit("/", 1)[-1]
    if not re.search(r"(^|[_-])test($|[_-])", database, re.IGNORECASE):
        raise pytest.UsageError(
            "Refusing to run Sofia tests: {} does not point to a database "
            "with 'test' in its name. CKAN test fixtures delete database "
            "contents. Use a separate test database and test services.".format(setting)
        )


# CKAN reads these environment overrides even when test.ini uses test-core.ini.
# Check during collection, before any database fixtures can execute.
for _setting in (
    "CKAN_SQLALCHEMY_URL",
    "CKAN_DATASTORE_WRITE_URL",
    "CKAN_DATASTORE_READ_URL",
):
    if os.environ.get(_setting):
        _require_test_database(os.environ[_setting], _setting)


@pytest.fixture(scope="session", autouse=True)
def require_test_database():
    from ckan.plugins import toolkit

    _require_test_database(toolkit.config["sqlalchemy.url"], "sqlalchemy.url")
