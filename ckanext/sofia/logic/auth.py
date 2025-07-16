import ckan.plugins.toolkit as tk


@tk.auth_allow_anonymous_access
def sofia_get_sum(context, data_dict):
    return {"success": True}


def get_auth_functions():
    return {
        "sofia_get_sum": sofia_get_sum,
    }
