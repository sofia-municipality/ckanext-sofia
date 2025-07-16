import ckan.plugins.toolkit as tk
import ckanext.sofia.logic.schema as schema


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


def get_actions():
    return {
        'sofia_get_sum': sofia_get_sum,
    }
