from sqlalchemy import create_engine, text

ENGINE = create_engine("sqlite:///./app.db")

def has_column(conn, table, column):
    res = conn.execute(text(f"PRAGMA table_info('{table}')")).fetchall()
    return any(r[1] == column for r in res)

with ENGINE.begin() as conn:
    if not has_column(conn, 'reservations', 'restaurant_id'):
        print('Adding column restaurant_id to reservations')
        conn.execute(text('ALTER TABLE reservations ADD COLUMN restaurant_id INTEGER'))
    else:
        print('restaurant_id exists')

    if not has_column(conn, 'reservations', 'table_id'):
        print('Adding column table_id to reservations')
        conn.execute(text('ALTER TABLE reservations ADD COLUMN table_id INTEGER'))
    else:
        print('table_id exists')

    conn.commit()
    print('Migration complete')
