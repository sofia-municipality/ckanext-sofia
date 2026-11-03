import ckan.plugins.toolkit as tk
import ckanext.sofia.logic.schema as schema
from ckanext.sofia import geojson


@tk.side_effect_free
def sofia_get_sum(context, data_dict):
    tk.check_access(
        "sofia_get_sum", context, data_dict)
    data, errors = tk.navl_validate(
        data_dict, schema.sofia_get_sum(), context)

    if errors:
        raise tk.ValidationError(errors)

    return {
        "left": data["left"],
        "right": data["right"],
        "sum": data["left"] + data["right"]
    }


@tk.chained_action
@tk.side_effect_free
def resource_view_list(original_action, context, data_dict):
    """Leaves out GeoJSON views of resources that aren't GeoJSON files, also
    ones created before the check (see geojson.is_geojson_resource)."""
    views = original_action(context, data_dict)
    # Set by the original action
    resource = context["resource"]
    if not geojson.is_geojson_resource(resource.url, resource.format):
        views = [view for view in views
                 if view["view_type"] != geojson.VIEW_TYPE]
    return views


def get_actions():
    return {
        'sofia_get_sum': sofia_get_sum,
        'resource_view_list': resource_view_list,
    }
