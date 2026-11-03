"""Tests for geojson.py."""

import pytest

from ckanext.sofia import geojson


@pytest.mark.parametrize("url, extension", [
    ("https://example.com/data/sofia.geojson", "geojson"),
    ("https://example.com/data/sofia.GeoJSON?download=1#map", "geojson"),
    ("sofia.xlsx", "xlsx"),
    ("https://api.example.com/datasets/41", ""),
    ("https://example.com/v1.2/data", ""),
    ("https://example.com/", ""),
    ("", ""),
    (None, ""),
])
def test_url_extension(url, extension):
    assert geojson.url_extension(url) == extension


@pytest.mark.parametrize("url, format, expected", [
    # The file name says GeoJSON, whatever the format
    ("https://example.com/sofia.geojson", "", True),
    ("https://example.com/sofia.geojson", "JSON", True),
    ("sofia.gjson", "CSV", True),
    # The file name says something else, whatever the format
    ("https://example.com/drinking-fountains.xlsx", "GeoJSON", False),
    ("districts.zip", "GeoJSON", False),
    ("https://example.com/sofia.csv", "geojson", False),
    # The file name doesn't say, so the format does
    ("https://api.example.com/datasets/41", "GeoJSON", True),
    ("https://api.example.com/datasets/41", "", False),
    ("https://api.example.com/datasets/41", "CSV", False),
    ("https://example.com/sofia.json", "GeoJSON", True),
    ("https://example.com/sofia.json", "JSON", False),
    ("https://example.com/export.php?layer=5", "geojson", True),
    ("https://example.com/export.php?layer=5", None, False),
])
def test_is_geojson_resource(url, format, expected):
    assert geojson.is_geojson_resource(url, format) is expected
