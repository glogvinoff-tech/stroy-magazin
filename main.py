"""Root wrapper to expose backend app as `main:app` so uvicorn works from project root.
This loads backend/main.py by path and exposes its `app`.
"""
import importlib.util
import pathlib
import sys

_root = pathlib.Path(__file__).parent
_backend_main = _root / "backend" / "main.py"

spec = importlib.util.spec_from_file_location("backend_main", str(_backend_main))
mod = importlib.util.module_from_spec(spec)
sys.path.insert(0, str(_root / "backend"))
sys.modules[spec.name] = mod
spec.loader.exec_module(mod)

# Export app for uvicorn: `python -m uvicorn main:app` from project root
app = getattr(mod, "app")

if __name__ == "__main__":
    # allow running directly for convenience
    import uvicorn
    uvicorn.run("main:app", host="127.0.0.1", port=8001, reload=True)
