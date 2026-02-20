-- SyncUp Database Schema (PostgreSQL)
-- Each CREATE TABLE block defines a "table" in the database.
-- Think of a table like a spreadsheet: columns define the data fields,
-- and each row is one record (e.g., one user, one event).

-- ============================================================
-- USERS: stores everyone who signs up
-- ============================================================
CREATE TABLE IF NOT EXISTS users (
    id            SERIAL PRIMARY KEY,                      -- unique ID, auto-assigned
    username      TEXT    NOT NULL UNIQUE,                 -- display name, must be unique
    email         TEXT    NOT NULL UNIQUE,                 -- email address, must be unique
    password_hash TEXT    NOT NULL,                        -- hashed password (never store plain text!)
    full_name     TEXT    NOT NULL,                        -- real name
    bio           TEXT    DEFAULT '',                      -- short about-me blurb
    avatar_url    TEXT    DEFAULT '/images/default-avatar.svg',
    created_at    TIMESTAMP DEFAULT NOW(),                 -- when they signed up
    updated_at    TIMESTAMP DEFAULT NOW()
);

-- ============================================================
-- EVENTS: parties, concerts, club nights, etc.
-- ============================================================
CREATE TABLE IF NOT EXISTS events (
    id            SERIAL PRIMARY KEY,
    creator_id    INTEGER NOT NULL REFERENCES users(id),   -- which user created this event
    title         TEXT    NOT NULL,                        -- event name
    description   TEXT    NOT NULL,                        -- what the event is about
    venue         TEXT    NOT NULL,                        -- location / club name
    address       TEXT    DEFAULT '',                      -- street address
    event_date    TIMESTAMP NOT NULL,                      -- when it happens
    event_end     TIMESTAMP,                               -- optional end time
    dj_artist     TEXT    DEFAULT '',                      -- performing DJ or artist
    genre         TEXT    DEFAULT '',                      -- music genre
    price         REAL    DEFAULT 0,                       -- ticket price (0 = free)
    currency      TEXT    DEFAULT 'USD',
    capacity      INTEGER DEFAULT 0,                       -- 0 means unlimited
    image_url     TEXT    DEFAULT '/images/default-event.svg',
    status        TEXT    DEFAULT 'active',                -- active, cancelled, completed
    created_at    TIMESTAMP DEFAULT NOW(),
    updated_at    TIMESTAMP DEFAULT NOW()
);

-- ============================================================
-- VIP TABLES: users can list spare seats at their VIP tables
-- ============================================================
CREATE TABLE IF NOT EXISTS vip_tables (
    id              SERIAL PRIMARY KEY,
    event_id        INTEGER NOT NULL REFERENCES events(id),  -- which event this table is at
    host_id         INTEGER NOT NULL REFERENCES users(id),   -- the user offering seats
    table_label     TEXT    DEFAULT '',                      -- e.g. "Table 12", "VIP Section A"
    total_seats     INTEGER NOT NULL,                        -- how many seats in total
    available_seats INTEGER NOT NULL,                        -- how many are still open
    price_per_seat  REAL    DEFAULT 0,                       -- cost per seat
    currency        TEXT    DEFAULT 'USD',
    description     TEXT    DEFAULT '',                      -- any extras (bottle service, etc.)
    status          TEXT    DEFAULT 'available',             -- available, full, cancelled
    created_at      TIMESTAMP DEFAULT NOW(),
    updated_at      TIMESTAMP DEFAULT NOW()
);

-- ============================================================
-- TABLE BOOKINGS: when someone reserves a seat
-- ============================================================
CREATE TABLE IF NOT EXISTS table_bookings (
    id            SERIAL PRIMARY KEY,
    table_id      INTEGER NOT NULL REFERENCES vip_tables(id),  -- which VIP table
    user_id       INTEGER NOT NULL REFERENCES users(id),       -- who booked it
    seats         INTEGER NOT NULL DEFAULT 1,                  -- how many seats they want
    status        TEXT    DEFAULT 'pending',                   -- pending, confirmed, cancelled
    created_at    TIMESTAMP DEFAULT NOW(),
    updated_at    TIMESTAMP DEFAULT NOW()
);

-- ============================================================
-- MESSAGES: private chat between users
-- ============================================================
CREATE TABLE IF NOT EXISTS messages (
    id            SERIAL PRIMARY KEY,
    sender_id     INTEGER NOT NULL REFERENCES users(id),
    receiver_id   INTEGER NOT NULL REFERENCES users(id),
    content       TEXT    NOT NULL,
    is_read       BOOLEAN DEFAULT FALSE,                    -- false = unread, true = read
    created_at    TIMESTAMP DEFAULT NOW()
);

-- ============================================================
-- CHAT CONSENT: both users must agree before chatting
-- ============================================================
CREATE TABLE IF NOT EXISTS chat_consent (
    id            SERIAL PRIMARY KEY,
    requester_id  INTEGER NOT NULL REFERENCES users(id),    -- who wants to start chatting
    target_id     INTEGER NOT NULL REFERENCES users(id),    -- who they want to chat with
    status        TEXT    DEFAULT 'pending',                -- pending, accepted, declined
    created_at    TIMESTAMP DEFAULT NOW(),
    updated_at    TIMESTAMP DEFAULT NOW(),
    UNIQUE(requester_id, target_id)                         -- can only request once per pair
);

-- ============================================================
-- REVIEWS: public ratings for events and artists
-- ============================================================
CREATE TABLE IF NOT EXISTS reviews (
    id            SERIAL PRIMARY KEY,
    user_id       INTEGER NOT NULL REFERENCES users(id),    -- who wrote the review
    event_id      INTEGER NOT NULL REFERENCES events(id),   -- which event they're reviewing
    rating        INTEGER NOT NULL CHECK(rating >= 1 AND rating <= 5),  -- 1-5 stars
    title         TEXT    DEFAULT '',
    content       TEXT    DEFAULT '',
    created_at    TIMESTAMP DEFAULT NOW(),
    updated_at    TIMESTAMP DEFAULT NOW(),
    UNIQUE(user_id, event_id)                               -- one review per user per event
);

-- ============================================================
-- NOTIFICATIONS: alerts for bookings, cancellations, etc.
-- ============================================================
CREATE TABLE IF NOT EXISTS notifications (
    id            SERIAL PRIMARY KEY,
    user_id       INTEGER NOT NULL REFERENCES users(id),    -- who receives this notification
    type          TEXT    NOT NULL,                         -- booking_received, booking_cancelled, table_cancelled
    message       TEXT    NOT NULL,                         -- human-readable message
    link          TEXT    DEFAULT '',                       -- URL to navigate to when clicked
    is_read       BOOLEAN DEFAULT FALSE,                    -- false = unread, true = read
    created_at    TIMESTAMP DEFAULT NOW()
);

-- ============================================================
-- USER BLOCKS: safety feature to block unwanted contacts
-- ============================================================
CREATE TABLE IF NOT EXISTS user_blocks (
    id            SERIAL PRIMARY KEY,
    blocker_id    INTEGER NOT NULL REFERENCES users(id),    -- user who blocked
    blocked_id    INTEGER NOT NULL REFERENCES users(id),    -- user who got blocked
    created_at    TIMESTAMP DEFAULT NOW(),
    UNIQUE(blocker_id, blocked_id)                          -- can only block someone once
);

-- ============================================================
-- REVIEW VOTES: helpful/not helpful votes on reviews
-- ============================================================
CREATE TABLE IF NOT EXISTS review_votes (
    id            SERIAL PRIMARY KEY,
    review_id     INTEGER NOT NULL REFERENCES reviews(id) ON DELETE CASCADE,  -- which review
    user_id       INTEGER NOT NULL REFERENCES users(id),    -- who voted
    vote          INTEGER NOT NULL CHECK(vote IN (-1, 1)),  -- 1 = helpful, -1 = not helpful
    created_at    TIMESTAMP DEFAULT NOW(),
    UNIQUE(review_id, user_id)                              -- one vote per user per review
);

-- ============================================================
-- PAGE VIEWS: basic analytics tracking
-- ============================================================
CREATE TABLE IF NOT EXISTS page_views (
    id            SERIAL PRIMARY KEY,
    path          TEXT    NOT NULL,                         -- URL path visited
    user_id       INTEGER REFERENCES users(id),             -- logged-in user (optional)
    session_id    TEXT,                                     -- session identifier
    referrer      TEXT    DEFAULT '',                       -- where they came from
    user_agent    TEXT    DEFAULT '',                       -- browser info
    created_at    TIMESTAMP DEFAULT NOW()
);

-- ============================================================
-- PASSWORD RESET TOKENS: for forgot password functionality
-- ============================================================
CREATE TABLE IF NOT EXISTS password_reset_tokens (
    id            SERIAL PRIMARY KEY,
    user_id       INTEGER NOT NULL REFERENCES users(id),    -- user who requested reset
    token         TEXT    NOT NULL UNIQUE,                  -- unique reset token
    expires_at    TIMESTAMP NOT NULL,                       -- token expiration time
    used          BOOLEAN DEFAULT FALSE,                    -- whether token has been used
    created_at    TIMESTAMP DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_reset_tokens_token ON password_reset_tokens(token);
CREATE INDEX IF NOT EXISTS idx_reset_tokens_user ON password_reset_tokens(user_id);

-- ============================================================
-- SESSION TABLE: for connect-pg-simple session store
-- ============================================================
CREATE TABLE IF NOT EXISTS session (
    sid    VARCHAR NOT NULL PRIMARY KEY,
    sess   JSON NOT NULL,
    expire TIMESTAMP(6) NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_session_expire ON session(expire);

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
CREATE INDEX IF NOT EXISTS idx_page_views_path  ON page_views(path);
CREATE INDEX IF NOT EXISTS idx_page_views_date  ON page_views(created_at);
