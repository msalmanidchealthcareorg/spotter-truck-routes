"""
Render’s default start command is ``gunicorn core.wsgi:application``.
This project’s Django package is ``config`` under ``backend/``.
"""

import sys
from pathlib import Path

_BACKEND = Path(__file__).resolve().parent.parent / "backend"
_backend = str(_BACKEND)
if _backend not in sys.path:
    sys.path.insert(0, _backend)

from config.wsgi import application  # noqa: F401
