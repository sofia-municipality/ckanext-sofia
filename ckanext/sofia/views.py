from flask import Blueprint


sofia = Blueprint(
    "sofia", __name__)


def page():
    return "Hello, sofia!"


sofia.add_url_rule(
    "/sofia/page", view_func=page)


def get_blueprints():
    return [sofia]
