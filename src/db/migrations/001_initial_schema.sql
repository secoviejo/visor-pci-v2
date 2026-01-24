-- Initial Schema

CREATE TABLE IF NOT EXISTS campuses (
    id INTEGER PRIMARY KEY __AUTO_INC__,
    name TEXT NOT NULL,
    description TEXT,
    image_filename TEXT,
    background_image TEXT,
    offset_x REAL DEFAULT 0,
    offset_y REAL DEFAULT 0,
    scale REAL DEFAULT 0.8
);

CREATE TABLE IF NOT EXISTS buildings (
    id INTEGER PRIMARY KEY __AUTO_INC__,
    name TEXT NOT NULL,
    campus_id INTEGER DEFAULT 1,
    x REAL,
    y REAL,
    thumbnail TEXT,
    bacnet_ip TEXT,
    bacnet_port INTEGER,
    bacnet_device_id INTEGER,
    modbus_ip TEXT,
    modbus_port INTEGER,
    FOREIGN KEY (campus_id) REFERENCES campuses (id)
);

CREATE TABLE IF NOT EXISTS floors (
    id INTEGER PRIMARY KEY __AUTO_INC__,
    name TEXT NOT NULL,
    image_filename TEXT NOT NULL,
    width INTEGER DEFAULT 0,
    height INTEGER DEFAULT 0,
    building_id INTEGER DEFAULT 1,
    FOREIGN KEY (building_id) REFERENCES buildings (id)
);

CREATE TABLE IF NOT EXISTS devices (
    id INTEGER PRIMARY KEY __AUTO_INC__,
    floor_id INTEGER,
    device_id TEXT,
    number TEXT,
    type TEXT,
    x REAL,
    y REAL,
    location TEXT,
    FOREIGN KEY (floor_id) REFERENCES floors (id)
);

CREATE TABLE IF NOT EXISTS users (
    id INTEGER PRIMARY KEY __AUTO_INC__,
    username VARCHAR(255) UNIQUE,
    password_hash TEXT,
    role TEXT DEFAULT 'viewer'
);

CREATE TABLE IF NOT EXISTS gateways (
    id INTEGER PRIMARY KEY __AUTO_INC__,
    name TEXT NOT NULL,
    type TEXT NOT NULL,
    ip_address TEXT,
    port INTEGER,
    config TEXT
);

CREATE TABLE IF NOT EXISTS events (
    id INTEGER PRIMARY KEY __AUTO_INC__,
    device_id TEXT,
    type TEXT NOT NULL,
    message TEXT NOT NULL,
    timestamp DATETIME DEFAULT CURRENT_TIMESTAMP,
    acknowledged BOOLEAN DEFAULT 0,
    acknowledged_by TEXT,
    resolved BOOLEAN DEFAULT 0,
    building_id INTEGER,
    floor_id INTEGER,
    value TEXT,
    origin TEXT
);

CREATE TABLE IF NOT EXISTS notification_recipients (
    id INTEGER PRIMARY KEY __AUTO_INC__,
    name TEXT NOT NULL,
    email TEXT,
    phone TEXT,
    enabled BOOLEAN DEFAULT 1,
    notify_email BOOLEAN DEFAULT 1,
    notify_sms BOOLEAN DEFAULT 0,
    notify_telegram BOOLEAN DEFAULT 0,
    telegram_chat_id TEXT,
    sms_critical_only BOOLEAN DEFAULT 1,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS alerts (
    id INTEGER PRIMARY KEY __AUTO_INC__,
    element_id TEXT,
    type TEXT,
    building_id INTEGER,
    floor_id INTEGER,
    location TEXT,
    description TEXT,
    status TEXT,
    origin TEXT,
    started_at TEXT,
    ended_at TEXT
);

CREATE TABLE IF NOT EXISTS notification_config (
    id INTEGER PRIMARY KEY DEFAULT 1,
    email_enabled BOOLEAN DEFAULT 1,
    sms_enabled BOOLEAN DEFAULT 1,
    gmail_user TEXT,
    gmail_app_password TEXT,
    twilio_account_sid TEXT,
    twilio_auth_token TEXT,
    twilio_phone_number TEXT,
    telegram_bot_token TEXT,
    CHECK (id = 1)
);

CREATE TABLE IF NOT EXISTS notification_log (
    id INTEGER PRIMARY KEY __AUTO_INC__,
    alarm_id INTEGER,
    recipient_id INTEGER,
    type TEXT,
    status TEXT,
    error_message TEXT,
    sent_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (recipient_id) REFERENCES notification_recipients (id)
);

-- Seed Initial Data
__INSERT_IGNORE__ INTO notification_config (
    id,
    email_enabled,
    sms_enabled
)
VALUES (1, 1, 1);

__INSERT_IGNORE__ INTO campuses (
    id,
    name,
    description,
    image_filename,
    background_image
)
VALUES (
        1,
        'Campus Default',
        'Temp',
        'placeholder.jpg',
        'placeholder.jpg'
    );