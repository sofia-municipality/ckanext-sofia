import click


@click.group(short_help="sofia CLI.")
def sofia():
    """sofia CLI.
    """
    pass


@sofia.command()
@click.argument("name", default="sofia")
def command(name):
    """Docs.
    """
    click.echo("Hello, {name}!".format(name=name))


def get_commands():
    return [sofia]
