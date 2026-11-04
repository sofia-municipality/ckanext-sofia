"""CKAN's table view (datatables_view) for Bulgarian data and users.

Search: the view's search handlers (ckanext/datatablesview/blueprint.py) turn
every character outside [0-9a-zA-Z-] into the full-text wildcard "_" before
querying the DataStore, so a search for Cyrillic text such as "Нови" becomes
"_:*" and finds nothing. Here that pattern also keeps letters and digits of any
script, for the table's search box, its column filters and its filtered
download.

Language: the DataTables language file CKAN ships for Bulgarian has only the
table's info and paging texts; public/sofia/datatables/bg.json adds the
buttons' messages, row selection and the rest.
"""
import re

import ckan.plugins.toolkit as toolkit

ASCII_ONLY = r'[^0-9a-zA-Z\-]+'
ANY_SCRIPT = r'[^\w\-]+'


class _UnicodeSearchRe:
    """Stands in for the `re` module inside datatablesview's blueprint."""

    def __getattr__(self, name):
        return getattr(re, name)

    @staticmethod
    def sub(pattern, repl, string, *args, **kwargs):
        if pattern == ASCII_ONLY:
            pattern = ANY_SCRIPT
        return re.sub(pattern, repl, string, *args, **kwargs)


def patch_datatables_search():
    try:
        from ckanext.datatablesview import blueprint
    except ImportError:
        return
    blueprint.re = _UnicodeSearchRe()


LANGUAGE_FILES = {'bg': 'sofia/datatables/bg.json'}


@toolkit.chained_helper
def datatablesview_get_language_file_path(next_helper, lang):
    if lang in LANGUAGE_FILES:
        return toolkit.h.url_for_static(LANGUAGE_FILES[lang])
    return next_helper(lang)
