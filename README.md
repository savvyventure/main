# SyncUp

A social platform for party and event enthusiasts. Find events, share VIP tables, connect with fellow partygoers, and leave reviews.

## Features

- **User Authentication** - Secure signup/login with bcrypt password hashing
- **Event Listings** - Browse, search, and filter upcoming events
- **VIP Table Sharing** - List your table or book seats at others' tables
- **Real-time Messaging** - Chat with other users (consent-based)
- **Reviews & Ratings** - Rate events and vote on helpful reviews
- **User Blocking** - Safety feature to block unwanted contacts
- **Notifications** - Get alerts for bookings and messages
- **Analytics Dashboard** - Track page views and popular events (admin only)

## Tech Stack

- **Backend**: Node.js + Express.js
- **Database**: SQLite (via better-sqlite3)
- **Templates**: EJS (server-side rendering)
- **Real-time**: Socket.io
- **Auth**: express-session + bcrypt
- **Styling**: Custom CSS (dark theme)

## Quick Start

### Prerequisites

- Node.js 18+ installed
- npm (comes with Node.js)

### Installation

```bash
# Clone the repository
git clone <repository-url>
cd syncup

# Install dependencies
npm install

# Initialize the database
npm run db:init

# (Optional) Seed with sample data
npm run db:seed

# Start the server
npm start
```

The app will be running at `http://localhost:3000`

### Development Mode

```bash
npm run dev
```

This starts the server with auto-reload on file changes.

## Environment Variables

Copy `.env.example` to `.env` and configure:

| Variable | Description | Default |
|----------|-------------|---------|
| `PORT` | Server port | `3000` |
| `NODE_ENV` | Environment (`development` or `production`) | `development` |
| `SESSION_SECRET` | Secret for session cookies | (dev default) |
| `DATABASE_PATH` | Path to SQLite database | `data/syncup.db` |
| `SESSIONS_PATH` | Directory for session database | `data/` |

**Important**: Generate a secure `SESSION_SECRET` for production:
```bash
node -e "console.log(require('crypto').randomBytes(64).toString('hex'))"
```

## Database Management

### Initialize Database
```bash
npm run db:init
```
Creates all tables defined in `src/db/schema.sql`.

### Seed Sample Data
```bash
npm run db:seed
```
Populates the database with sample users, events, and reviews.

**Test users** (password: `Password123`):
- djmarcus
- partyplanner
- nightowl99
- beatdrop
- vibecheck

### Reset Database
```bash
npm run db:reset
```
Deletes the database and recreates it with fresh seed data.

### Database Schema

| Table | Description |
|-------|-------------|
| `users` | User accounts |
| `events` | Event listings |
| `vip_tables` | VIP table listings |
| `table_bookings` | Seat reservations |
| `messages` | Private chat messages |
| `chat_consent` | Chat request/approval |
| `reviews` | Event reviews |
| `review_votes` | Helpful/not helpful votes |
| `notifications` | User notifications |
| `user_blocks` | Blocked users |
| `page_views` | Analytics data |

## Deployment

### Railway (Recommended)

1. Push your code to GitHub
2. Create a new project on [Railway](https://railway.app)
3. Connect your GitHub repository
4. Add environment variables:
   - `NODE_ENV=production`
   - `SESSION_SECRET=<your-secure-secret>`
5. Deploy!

Railway will automatically:
- Install dependencies
- Run `npm run db:init` (via postinstall)
- Start the server

### Render

1. Create a new Web Service on [Render](https://render.com)
2. Connect your repository
3. Set build command: `npm install`
4. Set start command: `npm start`
5. Add environment variables
6. Create a persistent disk and mount at `/data`

### Manual / VPS

```bash
# Clone and install
git clone <repository-url>
cd syncup
npm install --production

# Set environment variables
export NODE_ENV=production
export SESSION_SECRET="your-secure-secret"
export PORT=3000

# Initialize database
npm run db:init

# Start with a process manager
npm install -g pm2
pm2 start src/server.js --name syncup
```

## Project Structure

```
syncup/
├── src/
│   ├── server.js          # Entry point
│   ├── db/
│   │   ├── database.js    # SQLite connection
│   │   ├── schema.sql     # Table definitions
│   │   ├── init.js        # DB initialization
│   │   └── seed.js        # Sample data
│   ├── routes/
│   │   ├── index.js       # Home page
│   │   ├── auth.js        # Signup/login
│   │   ├── events.js      # Event CRUD
│   │   ├── tables.js      # VIP tables
│   │   ├── messages.js    # Messaging
│   │   ├── reviews.js     # Reviews
│   │   ├── profile.js     # User profiles
│   │   ├── notifications.js
│   │   └── analytics.js   # Admin dashboard
│   ├── middleware/
│   │   └── auth.js        # Auth middleware
│   └── utils/
│       └── socket.js      # Socket.io handler
├── views/
│   ├── partials/          # Header/footer
│   └── pages/             # Page templates
├── public/
│   ├── css/style.css      # Styles
│   └── images/            # Static images
├── data/                  # SQLite databases
├── package.json
├── railway.json           # Railway config
├── Procfile               # Heroku/Render
└── README.md
```

## Troubleshooting

### "Database is locked"
This can happen with concurrent writes. The app uses WAL mode to minimize this. If it persists:
```bash
# Stop the server
# Delete the WAL files
rm data/syncup.db-wal data/syncup.db-shm
# Restart
npm start
```

### "Session not persisting"
- Ensure `SESSION_SECRET` is set and consistent across restarts
- Check that `data/sessions.db` is writable
- In production, ensure `secure: true` cookies work (requires HTTPS)

### "bcrypt installation fails"
bcrypt requires build tools. On Ubuntu/Debian:
```bash
sudo apt-get install build-essential python3
```
On macOS:
```bash
xcode-select --install
```

### "Port already in use"
```bash
# Find the process
lsof -i :3000
# Kill it
kill -9 <PID>
```

## API Routes

### Public
- `GET /` - Home page
- `GET /events` - Event listing
- `GET /events/:id` - Event detail
- `GET /profile/:username` - User profile

### Authentication
- `GET /auth/signup` - Signup form
- `POST /auth/signup` - Create account
- `GET /auth/login` - Login form
- `POST /auth/login` - Authenticate
- `POST /auth/logout` - Log out

### Protected (requires login)
- `GET /events/new/create` - Create event form
- `POST /events` - Create event
- `GET /messages` - Inbox
- `GET /messages/chat/:userId` - Chat with user
- `GET /tables/my-tables` - Your table listings
- `GET /tables/my-bookings` - Your reservations
- `GET /notifications` - Your notifications
- `GET /analytics` - Admin dashboard (first user only)

## Contributing

1. Fork the repository
2. Create a feature branch
3. Make your changes
4. Test thoroughly
5. Submit a pull request

## License

ISC License
