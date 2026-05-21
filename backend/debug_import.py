import traceback

try:
    import main
    print('Imported main OK')
except Exception:
    traceback.print_exc()
    raise
