import ckan.plugins as plugins
import ckan.plugins.toolkit as toolkit
from ckan.lib.helpers import url_for

class SofiaPlugin(plugins.SingletonPlugin):
    plugins.implements(plugins.IConfigurer)
    plugins.implements(plugins.ITemplateHelpers)

    # IConfigurer
    def update_config(self, config_):
        toolkit.add_template_directory(config_, 'templates')
        toolkit.add_public_directory(config_, 'public')
        toolkit.add_resource('fanstatic', 'sofia')

    # ITemplateHelpers
    def get_helpers(self):
        return {
            'popular_datasets': self.popular_datasets,
            'newest_datasets': self.newest_datasets,
            'recently_updated_datasets': self.recently_updated_datasets,
            'groups': self.groups
        }

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
