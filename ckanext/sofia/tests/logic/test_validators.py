"""Tests for validators.py."""

import pytest

import ckan.plugins.toolkit as tk

from ckanext.sofia.logic import validators


def test_sofia_reauired_with_valid_value():
    assert validators.sofia_required("value") == "value"


def test_sofia_reauired_with_invalid_value():
    with pytest.raises(tk.Invalid):
        validators.sofia_required(None)
