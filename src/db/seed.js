// Seed script: populates the database with sample users, events, and reviews
// Run with:  node src/db/seed.js

const bcrypt = require('bcrypt');
const db = require('./database');
const fs = require('fs');
const path = require('path');

// Re-initialize schema first
const schema = fs.readFileSync(path.join(__dirname, 'schema.sql'), 'utf-8');
db.exec(schema);

const SALT_ROUNDS = 12;

async function seed() {
  // --- USERS ---
  const users = [
    { username: 'djmarcus', email: 'marcus@example.com', password: 'Password123', full_name: 'Marcus Chen', bio: 'DJ and event organizer based in LA. House & techno enthusiast.' },
    { username: 'partyplanner', email: 'sarah@example.com', password: 'Password123', full_name: 'Sarah Williams', bio: 'Professional event planner. Making nights unforgettable since 2018.' },
    { username: 'nightowl99', email: 'alex@example.com', password: 'Password123', full_name: 'Alex Rivera', bio: 'Music lover. Always looking for the next great party.' },
    { username: 'beatdrop', email: 'nina@example.com', password: 'Password123', full_name: 'Nina Patel', bio: 'Bass music fanatic. Catch me at every dubstep event.' },
    { username: 'vibecheck', email: 'jordan@example.com', password: 'Password123', full_name: 'Jordan Blake', bio: 'Hip-hop head and VIP table regular.' },
  ];

  const userIds = [];
  for (const u of users) {
    const hash = await bcrypt.hash(u.password, SALT_ROUNDS);
    const result = db.prepare(
      'INSERT OR IGNORE INTO users (username, email, password_hash, full_name, bio) VALUES (?, ?, ?, ?, ?)'
    ).run(u.username, u.email, hash, u.full_name, u.bio);
    userIds.push(result.lastInsertRowid);
  }

  console.log(`Seeded ${userIds.length} users`);

  // --- EVENTS ---
  // Dates are set in the future so they appear as "upcoming"
  const events = [
    {
      creator_id: userIds[0],
      title: 'Neon Nights: Summer Opening',
      description: 'The biggest summer opening party is here! Three floors of music, world-class sound system, and an outdoor terrace with city views. Dress code: smart casual. Early bird tickets available.\n\nFeaturing sets from international and local DJs spinning house, techno, and everything in between.',
      venue: 'Skyline Rooftop Club',
      address: '450 S Grand Ave, Los Angeles, CA',
      event_date: '2026-06-15T22:00',
      event_end: '2026-06-16T04:00',
      dj_artist: 'DJ Marcus & Friends',
      genre: 'House',
      price: 35.00,
      capacity: 500,
    },
    {
      creator_id: userIds[1],
      title: 'Bass Canyon Underground',
      description: 'Descend into the underground for a night of heavy bass, dubstep, and drum & bass. Warehouse vibes, industrial decor, and a sound system that will shake your soul. Limited capacity for an intimate experience.',
      venue: 'The Warehouse District',
      address: '789 Industrial Blvd, Brooklyn, NY',
      event_date: '2026-07-04T21:00',
      event_end: '2026-07-05T05:00',
      dj_artist: 'Subtronics b2b Excision',
      genre: 'Dubstep',
      price: 55.00,
      capacity: 300,
    },
    {
      creator_id: userIds[1],
      title: 'Sunset Grooves - Beach Party',
      description: 'Dance barefoot in the sand as the sun sets over the ocean. Tropical house, chill vibes, and beachside cocktails. Food trucks on site. All ages welcome.\n\nBring your own blanket and good energy!',
      venue: 'Venice Beach Pavilion',
      address: '1800 Ocean Front Walk, Venice, CA',
      event_date: '2026-06-28T16:00',
      event_end: '2026-06-28T23:00',
      dj_artist: 'Kygo (tribute set)',
      genre: 'Tropical House',
      price: 0,
      capacity: 1000,
    },
    {
      creator_id: userIds[0],
      title: 'Techno Tuesdays: Resident Night',
      description: 'Our weekly techno night featuring rotating resident DJs. Dark room, minimal lighting, maximum immersion. No phones on the dance floor policy.\n\n$5 drinks before midnight.',
      venue: 'Club Void',
      address: '222 E 6th St, Austin, TX',
      event_date: '2026-06-10T22:00',
      event_end: '2026-06-11T03:00',
      dj_artist: 'Resident DJs',
      genre: 'Techno',
      price: 15.00,
      capacity: 200,
    },
    {
      creator_id: userIds[4],
      title: 'Hip-Hop Royalty: Golden Era Night',
      description: 'Celebrating the golden era of hip-hop with classic tracks from the 90s and 2000s. Live MC battles, breakdancing showcase, and graffiti art installations. VIP tables with bottle service available.',
      venue: 'The Grand Ballroom',
      address: '1500 Broadway, New York, NY',
      event_date: '2026-07-12T20:00',
      event_end: '2026-07-13T02:00',
      dj_artist: 'DJ Premier & Pete Rock',
      genre: 'Hip-Hop',
      price: 45.00,
      capacity: 800,
    },
    {
      creator_id: userIds[3],
      title: 'Electric Garden Festival',
      description: 'A two-day outdoor festival featuring four stages, art installations, wellness areas, and gourmet food vendors. Camp under the stars or grab a day pass.\n\nLineup spans EDM, house, trance, and live electronic acts.',
      venue: 'Riverside Meadows Park',
      address: '3200 River Rd, Portland, OR',
      event_date: '2026-08-01T12:00',
      event_end: '2026-08-02T23:00',
      dj_artist: 'Above & Beyond, Rufus Du Sol, Lane 8',
      genre: 'EDM',
      price: 120.00,
      capacity: 5000,
    },
    {
      creator_id: userIds[2],
      title: 'Jazz & Cocktails Evening',
      description: 'An elegant evening of live jazz performances paired with craft cocktails. Smart dress code. Perfect for a sophisticated night out.\n\nReservations recommended for dining tables.',
      venue: 'Blue Note Lounge',
      address: '131 W 3rd St, New York, NY',
      event_date: '2026-06-20T19:00',
      event_end: '2026-06-20T23:30',
      dj_artist: 'The Marcus Miller Quartet',
      genre: 'Jazz',
      price: 40.00,
      capacity: 150,
    },
    {
      creator_id: userIds[4],
      title: 'Afrobeats & Amapiano Night',
      description: 'Feel the rhythm of Africa! A vibrant night of Afrobeats, Amapiano, and Afro-house. Expect high energy, incredible dancers, and non-stop movement.\n\nSpecial guest performers to be announced.',
      venue: 'Mango Room',
      address: '88 Atlantic Ave, Miami, FL',
      event_date: '2026-07-19T21:00',
      event_end: '2026-07-20T04:00',
      dj_artist: 'DJ Maphorisa & Kabza De Small',
      genre: 'Afrobeats',
      price: 30.00,
      capacity: 400,
    },
  ];

  const eventIds = [];
  for (const e of events) {
    const result = db.prepare(`
      INSERT INTO events (creator_id, title, description, venue, address, event_date, event_end, dj_artist, genre, price, capacity)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `).run(e.creator_id, e.title, e.description, e.venue, e.address, e.event_date, e.event_end, e.dj_artist, e.genre, e.price, e.capacity);
    eventIds.push(result.lastInsertRowid);
  }

  console.log(`Seeded ${eventIds.length} events`);

  // --- REVIEWS ---
  const reviews = [
    { user_id: userIds[2], event_id: eventIds[3], rating: 5, title: 'Incredible vibe', content: 'Techno Tuesdays never disappoints. The sound system at Club Void is unreal and the no-phone policy makes the experience so much more immersive.' },
    { user_id: userIds[3], event_id: eventIds[3], rating: 4, title: 'Great but crowded', content: 'Love the music selection and the dark room atmosphere. Gets pretty packed after midnight though - arrive early!' },
    { user_id: userIds[4], event_id: eventIds[0], rating: 5, title: 'Best rooftop party', content: 'Skyline Rooftop Club delivers every time. The city views combined with DJ Marcus spinning house tracks made for a magical night.' },
    { user_id: userIds[2], event_id: eventIds[0], rating: 4, title: 'Amazing venue', content: 'Beautiful rooftop setting and great music. Only dock one star because drinks were pricey, but the atmosphere made up for it.' },
    { user_id: userIds[1], event_id: eventIds[4], rating: 5, title: 'Hip-hop heaven', content: 'DJ Premier absolutely killed it. The golden era tracks had everyone dancing. MC battles were a highlight.' },
  ];

  for (const r of reviews) {
    db.prepare(
      'INSERT INTO reviews (user_id, event_id, rating, title, content) VALUES (?, ?, ?, ?, ?)'
    ).run(r.user_id, r.event_id, r.rating, r.title, r.content);
  }

  console.log(`Seeded ${reviews.length} reviews`);

  // --- VIP TABLES ---
  const tables = [
    { event_id: eventIds[0], host_id: userIds[4], table_label: 'Table 7 - Terrace', total_seats: 8, available_seats: 4, price_per_seat: 75.00, description: 'Premium terrace table with bottle of Grey Goose included.' },
    { event_id: eventIds[0], host_id: userIds[1], table_label: 'VIP Booth 3', total_seats: 6, available_seats: 3, price_per_seat: 50.00, description: 'Indoor VIP booth near the DJ stage.' },
    { event_id: eventIds[4], host_id: userIds[4], table_label: 'Balcony Table A', total_seats: 10, available_seats: 6, price_per_seat: 60.00, description: 'Balcony overlooking the main stage. Bottle service available.' },
    { event_id: eventIds[1], host_id: userIds[3], table_label: 'Front Row Section', total_seats: 4, available_seats: 2, price_per_seat: 100.00, description: 'Right next to the speakers. Not for the faint-hearted.' },
  ];

  for (const t of tables) {
    db.prepare(
      'INSERT INTO vip_tables (event_id, host_id, table_label, total_seats, available_seats, price_per_seat, description) VALUES (?, ?, ?, ?, ?, ?, ?)'
    ).run(t.event_id, t.host_id, t.table_label, t.total_seats, t.available_seats, t.price_per_seat, t.description);
  }

  console.log(`Seeded ${tables.length} VIP tables`);
  console.log('\nSeed complete! You can log in with any seeded user using password: Password123');
  console.log('Users:', users.map(u => u.username).join(', '));
}

seed().catch(console.error);
