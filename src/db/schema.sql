-- SyncUp Database Schema
-- Each CREATE TABLE block defines a "table" in the database.
-- Think of a table like a spreadsheet: columns define the data fields,
-- and each row is one record (e.g., one user, one event).

-- ============================================================
-- USERS: stores everyone who signs up
-- ============================================================
CREATE TABLE IF NOT EXISTS users (
    id            INTEGER PRIMARY KEY AUTOINCREMENT,  -- unique ID, auto-assigned
    username      TEXT    NOT NULL UNIQUE,             -- display name, must be unique
    email         TEXT    NOT NULL UNIQUE,             -- email address, must be unique
    password_hash TEXT    NOT NULL,                    -- hashed password (never store plain text!)
    full_name     TEXT    NOT NULL,                    -- real name
    bio           TEXT    DEFAULT '',                  -- short about-me blurb
    avatar_url    TEXT    DEFAULT '/images/default-avatar.png',
    created_at    TEXT    DEFAULT (datetime('now')),   -- when they signed up
    updated_at    TEXT    DEFAULT (datetime('now'))
);

-- ============================================================
-- EVENTS: parties, concerts, club nights, etc.
-- ============================================================
CREATE TABLE IF NOT EXISTS events (
    id            INTEGER PRIMARY KEY AUTOINCREMENT,
    creator_id    INTEGER NOT NULL,                    -- which user created this event
    title         TEXT    NOT NULL,                    -- event name
    description   TEXT    NOT NULL,                    -- what the event is about
    venue         TEXT    NOT NULL,                    -- location / club name
    address       TEXT    DEFAULT '',                  -- street address
    event_date    TEXT    NOT NULL,                    -- when it happens (ISO 8601 format)
    event_end     TEXT,                                -- optional end time
    dj_artist     TEXT    DEFAULT '',                  -- performing DJ or artist
    genre         TEXT    DEFAULT '',                  -- music genre
    price         REAL    DEFAULT 0,                   -- ticket price (0 = free)
    currency      TEXT    DEFAULT 'USD',
    capacity      INTEGER DEFAULT 0,                   -- 0 means unlimited
    image_url     TEXT    DEFAULT '/images/default-event.png',
    status        TEXT    DEFAULT 'active',             -- active, cancelled, completed
    created_at    TEXT    DEFAULT (datetime('now')),
    updated_at    TEXT    DEFAULT (datetime('now')),
    FOREIGN KEY (creator_id) REFERENCES users(id)
);

-- ============================================================
-- VIP TABLES: users can list spare seats at their VIP tables
-- ============================================================
CREATE TABLE IF NOT EXISTS vip_tables (
    id            INTEGER PRIMARY KEY AUTOINCREMENT,
    event_id      INTEGER NOT NULL,                    -- which event this table is at
    host_id       INTEGER NOT NULL,                    -- the user offering seats
    table_label   TEXT    DEFAULT '',                   -- e.g. "Table 12", "VIP Section A"
    total_seats   INTEGER NOT NULL,                    -- how many seats in total
    available_seats INTEGER NOT NULL,                  -- how many are still open
    price_per_seat REAL   DEFAULT 0,                   -- cost per seat
    currency      TEXT    DEFAULT 'USD',
    description   TEXT    DEFAULT '',                   -- any extras (bottle service, etc.)
    status        TEXT    DEFAULT 'available',          -- available, full, cancelled
    created_at    TEXT    DEFAULT (datetime('now')),
    updated_at    TEXT    DEFAULT (datetime('now')),
    FOREIGN KEY (event_id) REFERENCES events(id),
    FOREIGN KEY (host_id)  REFERENCES users(id)
);

-- ============================================================
-- TABLE BOOKINGS: when someone reserves a seat
-- ============================================================
CREATE TABLE IF NOT EXISTS table_bookings (
    id            INTEGER PRIMARY KEY AUTOINCREMENT,
    table_id      INTEGER NOT NULL,                    -- which VIP table
    user_id       INTEGER NOT NULL,                    -- who booked it
    seats         INTEGER NOT NULL DEFAULT 1,           -- how many seats they want
    status        TEXT    DEFAULT 'pending',            -- pending, confirmed, cancelled
    created_at    TEXT    DEFAULT (datetime('now')),
    updated_at    TEXT    DEFAULT (datetime('now')),
    FOREIGN KEY (table_id) REFERENCES vip_tables(id),
    FOREIGN KEY (user_id)  REFERENCES users(id)
);

-- ============================================================
-- MESSAGES: private chat between users
-- ============================================================
CREATE TABLE IF NOT EXISTS messages (
    id            INTEGER PRIMARY KEY AUTOINCREMENT,
    sender_id     INTEGER NOT NULL,
    receiver_id   INTEGER NOT NULL,
    content       TEXT    NOT NULL,
    is_read       INTEGER DEFAULT 0,                   -- 0 = unread, 1 = read
    created_at    TEXT    DEFAULT (datetime('now')),
    FOREIGN KEY (sender_id)   REFERENCES users(id),
    FOREIGN KEY (receiver_id) REFERENCES users(id)
);

-- ============================================================
-- CHAT CONSENT: both users must agree before chatting
-- ============================================================
CREATE TABLE IF NOT EXISTS chat_consent (
    id            INTEGER PRIMARY KEY AUTOINCREMENT,
    requester_id  INTEGER NOT NULL,                    -- who wants to start chatting
    target_id     INTEGER NOT NULL,                    -- who they want to chat with
    status        TEXT    DEFAULT 'pending',            -- pending, accepted, declined
    created_at    TEXT    DEFAULT (datetime('now')),
    updated_at    TEXT    DEFAULT (datetime('now')),
    FOREIGN KEY (requester_id) REFERENCES users(id),
    FOREIGN KEY (target_id)    REFERENCES users(id),
    UNIQUE(requester_id, target_id)                    -- can only request once per pair
);

-- ============================================================
-- REVIEWS: public ratings for events and artists
-- ============================================================
CREATE TABLE IF NOT EXISTS reviews (
    id            INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id       INTEGER NOT NULL,                    -- who wrote the review
    event_id      INTEGER NOT NULL,                    -- which event they're reviewing
    rating        INTEGER NOT NULL CHECK(rating >= 1 AND rating <= 5),  -- 1-5 stars
    title         TEXT    DEFAULT '',
    content       TEXT    DEFAULT '',
    created_at    TEXT    DEFAULT (datetime('now')),
    updated_at    TEXT    DEFAULT (datetime('now')),
    FOREIGN KEY (user_id)  REFERENCES users(id),
    FOREIGN KEY (event_id) REFERENCES events(id),
    UNIQUE(user_id, event_id)                          -- one review per user per event
);

-- ============================================================
-- NOTIFICATIONS: alerts for bookings, cancellations, etc.
-- ============================================================
CREATE TABLE IF NOT EXISTS notifications (
    id            INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id       INTEGER NOT NULL,                    -- who receives this notification
    type          TEXT    NOT NULL,                     -- booking_received, booking_cancelled, table_cancelled
    message       TEXT    NOT NULL,                     -- human-readable message
    link          TEXT    DEFAULT '',                   -- URL to navigate to when clicked
    is_read       INTEGER DEFAULT 0,                   -- 0 = unread, 1 = read
    created_at    TEXT    DEFAULT (datetime('now')),
    FOREIGN KEY (user_id) REFERENCES users(id)
);

-- ============================================================
-- USER BLOCKS: safety feature to block unwanted contacts
-- ============================================================
CREATE TABLE IF NOT EXISTS user_blocks (
    id            INTEGER PRIMARY KEY AUTOINCREMENT,
    blocker_id    INTEGER NOT NULL,                    -- user who blocked
    blocked_id    INTEGER NOT NULL,                    -- user who got blocked
    created_at    TEXT    DEFAULT (datetime('now')),
    FOREIGN KEY (blocker_id) REFERENCES users(id),
    FOREIGN KEY (blocked_id) REFERENCES users(id),
    UNIQUE(blocker_id, blocked_id)                    -- can only block someone once
);

-- ============================================================
-- REVIEW VOTES: helpful/not helpful votes on reviews
-- ============================================================
CREATE TABLE IF NOT EXISTS review_votes (
    id            INTEGER PRIMARY KEY AUTOINCREMENT,
    review_id     INTEGER NOT NULL,                    -- which review
    user_id       INTEGER NOT NULL,                    -- who voted
    vote          INTEGER NOT NULL CHECK(vote IN (-1, 1)),  -- 1 = helpful, -1 = not helpful
    created_at    TEXT    DEFAULT (datetime('now')),
    FOREIGN KEY (review_id) REFERENCES reviews(id) ON DELETE CASCADE,
    FOREIGN KEY (user_id)   REFERENCES users(id),
    UNIQUE(review_id, user_id)                        -- one vote per user per review
);

-- ============================================================
-- INDEXES: make searches faster
-- ============================================================
CREATE INDEX IF NOT EXISTS idx_events_date      ON events(event_date);
CREATE INDEX IF NOT EXISTS idx_events_venue     ON events(venue);
CREATE INDEX IF NOT EXISTS idx_events_status    ON events(status);
CREATE INDEX IF NOT EXISTS idx_events_genre     ON events(genre);
CREATE INDEX IF NOT EXISTS idx_vip_tables_event ON vip_tables(event_id);
CREATE INDEX IF NOT EXISTS idx_bookings_table   ON table_bookings(table_id);
CREATE INDEX IF NOT EXISTS idx_bookings_user    ON table_bookings(user_id);
CREATE INDEX IF NOT EXISTS idx_messages_sender  ON messages(sender_id);
CREATE INDEX IF NOT EXISTS idx_messages_receiver ON messages(receiver_id);
CREATE INDEX IF NOT EXISTS idx_reviews_event    ON reviews(event_id);
CREATE INDEX IF NOT EXISTS idx_consent_target   ON chat_consent(target_id);
CREATE INDEX IF NOT EXISTS idx_notifications_user ON notifications(user_id);
CREATE INDEX IF NOT EXISTS idx_blocks_blocker   ON user_blocks(blocker_id);
CREATE INDEX IF NOT EXISTS idx_blocks_blocked   ON user_blocks(blocked_id);
CREATE INDEX IF NOT EXISTS idx_review_votes     ON review_votes(review_id);
