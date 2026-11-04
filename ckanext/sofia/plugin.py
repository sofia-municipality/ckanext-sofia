import ckan.plugins as plugins
import ckan.plugins.toolkit as toolkit
from ckan.lib import datapreview
from ckan.lib.helpers import url_for
from ckan.lib.plugins import DefaultTranslation
from ckanext.sofia.logic import action, auth
from ckanext.sofia import datatables, geojson, views

class SofiaPlugin(plugins.SingletonPlugin, DefaultTranslation):
    plugins.implements(plugins.ITranslation)
    plugins.implements(plugins.IConfigurer)
    plugins.implements(plugins.ITemplateHelpers)
    plugins.implements(plugins.IActions)
    plugins.implements(plugins.IAuthFunctions)
    plugins.implements(plugins.IBlueprint)
    plugins.implements(plugins.IResourceController, inherit=True)

    # IActions
    def get_actions(self):
        return action.get_actions()

    # IAuthFunctions
    def get_auth_functions(self):
        return auth.get_auth_functions()

    # IBlueprint
    def get_blueprint(self):
        return views.get_blueprints()

    # IConfigurer
    def update_config(self, config_):
        toolkit.add_template_directory(config_, 'templates')
        toolkit.add_public_directory(config_, 'public')
        toolkit.add_resource('assets', 'sofia')
        geojson.patch_geojson_view()
        datatables.patch_datatables_search()

    # IResourceController
    def after_resource_update(self, context, resource):
        # CKAN adds default views on update only when the format changes, but
        # a new file can make a resource GeoJSON with the same format
        default_views = toolkit.aslist(
            toolkit.config.get('ckan.views.default_views'))
        if geojson.VIEW_TYPE in default_views:
            datapreview.add_views_to_resource(
                {'user': context.get('user'), 'ignore_auth': True},
                resource, view_types=[geojson.VIEW_TYPE])

    # ITemplateHelpers
    def get_helpers(self):
        helpers = {
            'popular_datasets': self.popular_datasets,
            'newest_datasets': self.newest_datasets,
            'recently_updated_datasets': self.recently_updated_datasets,
            'groups': self.groups
        }
        # A chained helper needs the helper it extends: CKAN won't start
        # when datatables_view isn't loaded (e.g. in the tests)
        if plugins.plugin_loaded('datatables_view'):
            helpers['datatablesview_get_language_file_path'] = \
                datatables.datatablesview_get_language_file_path
        return helpers

    def groups(self):
        """Return a list of popular datasets"""
        groups = toolkit.get_action('group_list')(
            data_dict={'sort': 'package_count desc', 'all_fields': True})
        groups = groups[:10]
        return groups
    def popular_datasets(self):
        """Return a list of popular datasets"""
        data_dict = {
            'rows': 5,
            'sort': 'views_recent desc'
        }
        try:
            result = toolkit.get_action('package_search')({}, data_dict)
            return result.get('results', [])
        except Exception:
            return []

    def newest_datasets(self):
        """Return a list of newest datasets"""
        data_dict = {
            'rows': 5,
            'sort': 'metadata_created desc'
        }
        try:
            result = toolkit.get_action('package_search')({}, data_dict)
            return result.get('results', [])
        except Exception:
            return []

    def recently_updated_datasets(self):
        """Return a list of recently updated datasets"""
        data_dict = {
            'rows': 5,
            'sort': 'metadata_modified desc'
        }
        try:
            result = toolkit.get_action('package_search')({}, data_dict)
            return result.get('results', [])
        except Exception:
            return []
