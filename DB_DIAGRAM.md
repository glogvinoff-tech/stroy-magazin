# Database ER Diagram

```mermaid
erDiagram
  roles ||--o{ users : assigns
  roles ||--o{ role_permissions : includes
  permissions ||--o{ role_permissions : grants

  users ||--o| baskets : owns
  baskets ||--o{ goods_baskets : contains
  goods ||--o{ goods_baskets : added_to
  categories ||--o{ goods : groups

  users ||--o{ orders : creates
  users ||--o{ email_verification_codes : receives

  users ||--o{ support_threads : opens
  support_threads ||--o{ support_messages : contains
  users ||--o{ support_messages : sends

  restaurants ||--o{ tables : contains
  restaurants ||--o{ reservations : receives
  tables ||--o{ reservations : booked

  menu_items ||--o{ warehouse_stocks : stored_as
  restaurants ||--o{ warehouse_stocks : stores
  warehouse_stocks ||--o{ warehouse_movements : changes
  menu_items ||--o{ warehouse_movements : moved
  restaurants ||--o{ warehouse_movements : location
  users ||--o{ warehouse_movements : performs
  menu_items ||--o{ warehouse_documents : documented
  restaurants ||--o{ warehouse_documents : warehouse
  users ||--o{ warehouse_documents : creates

  users ||--o{ reviews : writes
  menu_items ||--o{ reviews : rated

  roles {
    int id PK
    string name UK
  }

  permissions {
    int id PK
    string name UK
  }

  role_permissions {
    int role_id PK,FK
    int permission_id PK,FK
  }

  users {
    int id PK
    string name
    string password
    int role_id FK
    datetime registration_date
    string email
    string username
    string hashed_password
    string full_name
    string phone
    string birth_date
    boolean email_verified
    string vk_id
    string vk_username
    string vk_avatar_url
    boolean is_pro
    boolean is_active
    datetime created_at
  }

  baskets {
    int id PK
    int user_id FK,UK
  }

  categories {
    int id PK
    string name UK
  }

  goods {
    int id PK
    string name
    string code UK
    int category_id FK
    datetime import_date
    datetime finish_date
  }

  goods_baskets {
    int goods_id PK,FK
    int basket_id PK,FK
    int count
  }

  orders {
    int id PK
    int user_id FK
    text items_json
    int total
    string fulfillment
    string fulfillment_time
    int restaurant_id
    string address
    string payment
    text comment
    string status
    boolean stock_reserved
    boolean stock_committed
    datetime created_at
  }

  reservations {
    int id PK
    int user_id
    string email
    string phone
    string date
    string time
    int guests
    text special_requests
    boolean is_confirmed
    boolean is_cancelled
    int restaurant_id FK
    int table_id FK
    text table_ids
    datetime created_at
  }

  restaurants {
    int id PK
    string name
    string address
    string phone
    datetime created_at
  }

  tables {
    int id PK
    int restaurant_id
    string name
    int seats
    int x
    int y
    string kind
    float scale
    boolean is_blocked
    datetime created_at
  }

  email_verification_codes {
    int id PK
    int user_id
    string email
    string code
    datetime expires_at
    boolean is_used
    datetime created_at
  }

  support_threads {
    int id PK
    int user_id FK
    string status
    datetime last_message_at
    datetime created_at
  }

  support_messages {
    int id PK
    int thread_id FK
    string sender_role
    int sender_user_id FK
    text text
    datetime created_at
  }

  menu_items {
    int id PK
    string cat
    string name
    int price
    int discount_percent
    string weight
    string badge
    text tags_json
    string img
    text gallery_json
    text desc
    text ingr
    boolean is_active
    datetime created_at
    datetime updated_at
  }

  warehouse_stocks {
    int id PK
    int menu_item_id FK
    int restaurant_id FK
    int quantity
    int reserved
    int min_quantity
    string sku
    string barcode
    string data_matrix
    string batch
    string location
    string storage_condition
    string supplier
    string expires_at
    datetime updated_at
  }

  warehouse_movements {
    int id PK
    int stock_id FK
    int menu_item_id FK
    int restaurant_id FK
    int user_id FK
    int delta
    int quantity_after
    string reason
    string document_no
    datetime created_at
  }

  warehouse_documents {
    int id PK
    string kind
    string document_no
    int menu_item_id FK
    int restaurant_id FK
    int quantity
    int quantity_before
    int quantity_after
    int user_id FK
    text comment
    datetime created_at
  }

  events {
    int id PK
    string title
    text description
    datetime starts_at
    datetime ends_at
    string image_url
    boolean is_private
    datetime created_at
  }

  reviews {
    int id PK
    int user_id FK
    int item_id FK
    string author_name
    int rating
    text text
    text admin_reply
    boolean is_featured
    string order_id
    datetime created_at
  }
```

Note: `restaurants` and `tables` are legacy technical names in the database. In the current application they are used as store addresses/locations and old compatibility entities.
