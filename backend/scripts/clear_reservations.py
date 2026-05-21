from sqlalchemy import create_engine, text

ENGINE = create_engine("sqlite:///./app.db")

with ENGINE.begin() as conn:
    result = conn.execute(text("DELETE FROM reservations"))
    print('Deleted rows:', result.rowcount)
