from packages.api import create_app

# Gunicorn/Uvicorn production entrypoint.
app = create_app()
