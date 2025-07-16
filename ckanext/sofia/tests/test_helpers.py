"""Tests for helpers.py."""

import ckanext.sofia.helpers as helpers


def test_sofia_hello():
    assert helpers.sofia_hello() == "Hello, sofia!"
