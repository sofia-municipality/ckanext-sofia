"""Which resources get geoview's GeoJSON view (a "GeoJSON" tab on the resource
page).

geoview decides by the resource's format alone, so an .xlsx marked GeoJSON gets
a map tab that can't show it and a .geojson file marked JSON gets none. Here the
file name decides when its extension names a format CKAN knows, and the format
only when it doesn't: links with no file name, .json files (GeoJSON or not) and
names such as .php. The viewer then checks the file itself and removes the view
when it isn't GeoJSON (assets/js/geojson_preview.js).
"""
from urllib.parse import urlparse

from ckan.lib.datapreview import on_same_domain
from ckan.lib.helpers import resource_formats

VIEW_TYPE = "geojson_view"

GEOJSON_FORMATS = ("geojson", "gjson")


def url_extension(url):
    """Lowercased extension of the file name at the end of the URL's path, or
    "" when there is none. Uploads have just the file name as their url."""
    try:
        path = urlparse(url or "").path
    except ValueError:
        return ""
    name = path.rsplit("/", 1)[-1]
    if "." not in name:
        return ""
    return name.rsplit(".", 1)[1].lower()


def is_geojson_resource(url, format):
    extension = url_extension(url)
    if extension in GEOJSON_FORMATS:
        return True
    # [mimetype, format name, title] from CKAN's resource_formats.json
    known = resource_formats().get(extension) if extension else None
    if known and known[1] != "JSON":
        return False
    return (format or "").strip().lower() in GEOJSON_FORMATS


def patch_geojson_view():
    """Makes geoview's GeoJSON view use is_geojson_resource, so CKAN creates
    it by default and offers it to editors by the same rule."""
    try:
        from ckanext.geoview.plugin import GeoJSONView
    except ImportError:
        return

    def can_view(self, data_dict):
        resource = data_dict["resource"]
        if not is_geojson_resource(resource.get("url"), resource.get("format")):
            return False
        # geoview's own check: files on other sites need resource_proxy
        return on_same_domain(data_dict) or self.proxy_enabled

    GeoJSONView.can_view = can_view
