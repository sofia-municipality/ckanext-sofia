"""Tests for views.py."""

import pytest

import ckanext.sofia.validators as validators


import ckan.plugins.toolkit as tk


@pytest.mark.ckan_config("ckan.plugins", "sofia")
@pytest.mark.usefixtures("with_plugins")
def test_sofia_blueprint(app, reset_db):
    resp = app.get(tk.h.url_for("sofia.page"))
    assert resp.status_code == 200
    assert resp.body == "Hello, sofia!"
