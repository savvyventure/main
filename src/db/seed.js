// Seed script: populates the database with sample users, events, and reviews
// Run with:  npm run db:seed

const bcrypt = require('bcrypt');
const db = require('./database');
const fs = require('fs');
const path = require('path');

const SALT_ROUNDS = 12;

async function seed() {
  try {
    // Re-initialize schema first
    const schema = fs.readFileSync(path.join(__dirname, 'schema.sql'), 'utf-8');
    const statements = schema.split(';').filter(s => s.trim());
    for (const statement of statements) {
      if (statement.trim()) {
        try {
          await db.pool.query(statement);
        } catch (err) {
          // Ignore errors for existing objects
          if (!err.message.includes('already exists')) {
            console.error('Schema error:', err.message);
          }
        }
      }
    }
    console.log('Schema initialized');

    // --- USERS (10 total) ---
    const users = [
      { username: 'djmarcus', email: 'marcus@example.com', password: 'Password123', full_name: 'Marcus Chen', bio: 'DJ and event organizer based in LA. House & techno enthusiast.' },
      { username: 'partyplanner', email: 'sarah@example.com', password: 'Password123', full_name: 'Sarah Williams', bio: 'Professional event planner. Making nights unforgettable since 2018.' },
      { username: 'nightowl99', email: 'alex@example.com', password: 'Password123', full_name: 'Alex Rivera', bio: 'Music lover. Always looking for the next great party.' },
      { username: 'beatdrop', email: 'nina@example.com', password: 'Password123', full_name: 'Nina Patel', bio: 'Bass music fanatic. Catch me at every dubstep event.' },
      { username: 'vibecheck', email: 'jordan@example.com', password: 'Password123', full_name: 'Jordan Blake', bio: 'Hip-hop head and VIP table regular.' },
      { username: 'lucygrooves', email: 'lucy@example.com', password: 'Password123', full_name: 'Lucy Thompson', bio: 'House music devotee. Resident DJ at Sunset Club. Love connecting people through music.' },
      { username: 'maxbeats', email: 'max@example.com', password: 'Password123', full_name: 'Max Rodriguez', bio: 'Producer and promoter in the Miami scene. Bringing Latin flavor to the dancefloor.' },
      { username: 'emmarave', email: 'emma@example.com', password: 'Password123', full_name: 'Emma Johansson', bio: 'Festival enthusiast from Sweden. Trance and progressive house are my life.' },
      { username: 'tokyo_dj', email: 'kenji@example.com', password: 'Password123', full_name: 'Kenji Tanaka', bio: 'Bringing the Tokyo underground sound to the US. Minimal techno specialist.' },
      { username: 'soulqueen', email: 'destiny@example.com', password: 'Password123', full_name: 'Destiny Adams', bio: 'R&B and soul lover. Organizing the smoothest listening parties in NYC.' },
    ];

    const userIds = [];
    for (const u of users) {
      const hash = await bcrypt.hash(u.password, SALT_ROUNDS);
      const result = await db.pool.query(
        `INSERT INTO users (username, email, password_hash, full_name, bio)
         VALUES ($1, $2, $3, $4, $5)
         ON CONFLICT (username) DO NOTHING
         RETURNING id`,
        [u.username, u.email, hash, u.full_name, u.bio]
      );
      if (result.rows[0]) {
        userIds.push(result.rows[0].id);
      }
    }

    console.log(`Seeded ${userIds.length} users`);

    // If no new users were created (already exist), fetch existing IDs
    if (userIds.length === 0) {
      const existingUsers = await db.pool.query(
        'SELECT id FROM users ORDER BY id LIMIT 10'
      );
      existingUsers.rows.forEach(row => userIds.push(row.id));
    }

    // --- EVENTS (20 total) ---
    const events = [
      {
        creator_id: userIds[0],
        title: 'Neon Nights: Summer Opening',
        description: 'The biggest summer opening party is here! Three floors of music, world-class sound system, and an outdoor terrace with city views. Dress code: smart casual.',
        venue: 'Skyline Rooftop Club',
        address: '450 S Grand Ave, Los Angeles, CA',
        event_date: '2026-06-15T22:00',
        event_end: '2026-06-16T04:00',
        dj_artist: 'DJ Marcus & Friends',
        genre: 'House',
        price: 35.00,
        currency: 'USD',
        capacity: 500,
      },
      {
        creator_id: userIds[1],
        title: 'Bass Canyon Underground',
        description: 'Descend into the underground for a night of heavy bass, dubstep, and drum & bass. Warehouse vibes, industrial decor, and a sound system that will shake your soul.',
        venue: 'The Warehouse District',
        address: '789 Industrial Blvd, Brooklyn, NY',
        event_date: '2026-07-04T21:00',
        event_end: '2026-07-05T05:00',
        dj_artist: 'Subtronics b2b Excision',
        genre: 'Dubstep',
        price: 55.00,
        currency: 'USD',
        capacity: 300,
      },
      {
        creator_id: userIds[1],
        title: 'Sunset Grooves - Beach Party',
        description: 'Dance barefoot in the sand as the sun sets over the ocean. Tropical house, chill vibes, and beachside cocktails. Food trucks on site. All ages welcome.',
        venue: 'Venice Beach Pavilion',
        address: '1800 Ocean Front Walk, Venice, CA',
        event_date: '2026-06-28T16:00',
        event_end: '2026-06-28T23:00',
        dj_artist: 'Kygo Tribute Set',
        genre: 'Tropical House',
        price: 0,
        currency: 'USD',
        capacity: 1000,
      },
      {
        creator_id: userIds[0],
        title: 'Techno Tuesdays: Resident Night',
        description: 'Our weekly techno night featuring rotating resident DJs. Dark room, minimal lighting, maximum immersion. No phones on the dance floor policy.',
        venue: 'Club Void',
        address: '222 E 6th St, Austin, TX',
        event_date: '2026-06-10T22:00',
        event_end: '2026-06-11T03:00',
        dj_artist: 'Resident DJs',
        genre: 'Techno',
        price: 15.00,
        currency: 'USD',
        capacity: 200,
      },
      {
        creator_id: userIds[4],
        title: 'Hip-Hop Royalty: Golden Era Night',
        description: 'Celebrating the golden era of hip-hop with classic tracks from the 90s and 2000s. Live MC battles, breakdancing showcase, and graffiti art installations.',
        venue: 'The Grand Ballroom',
        address: '1500 Broadway, New York, NY',
        event_date: '2026-07-12T20:00',
        event_end: '2026-07-13T02:00',
        dj_artist: 'DJ Premier & Pete Rock',
        genre: 'Hip-Hop',
        price: 45.00,
        currency: 'USD',
        capacity: 800,
      },
      {
        creator_id: userIds[3],
        title: 'Electric Garden Festival',
        description: 'A two-day outdoor festival featuring four stages, art installations, wellness areas, and gourmet food vendors. Camp under the stars or grab a day pass.',
        venue: 'Riverside Meadows Park',
        address: '3200 River Rd, Portland, OR',
        event_date: '2026-08-01T12:00',
        event_end: '2026-08-02T23:00',
        dj_artist: 'Above & Beyond, Rufus Du Sol, Lane 8',
        genre: 'EDM',
        price: 120.00,
        currency: 'USD',
        capacity: 5000,
      },
      {
        creator_id: userIds[2],
        title: 'Jazz & Cocktails Evening',
        description: 'An elegant evening of live jazz performances paired with craft cocktails. Smart dress code. Perfect for a sophisticated night out.',
        venue: 'Blue Note Lounge',
        address: '131 W 3rd St, New York, NY',
        event_date: '2026-06-20T19:00',
        event_end: '2026-06-20T23:30',
        dj_artist: 'The Marcus Miller Quartet',
        genre: 'Jazz',
        price: 40.00,
        currency: 'USD',
        capacity: 150,
      },
      {
        creator_id: userIds[4],
        title: 'Afrobeats & Amapiano Night',
        description: 'Feel the rhythm of Africa! A vibrant night of Afrobeats, Amapiano, and Afro-house. Expect high energy, incredible dancers, and non-stop movement.',
        venue: 'Mango Room',
        address: '88 Atlantic Ave, Miami, FL',
        event_date: '2026-07-19T21:00',
        event_end: '2026-07-20T04:00',
        dj_artist: 'DJ Maphorisa & Kabza De Small',
        genre: 'Afrobeats',
        price: 30.00,
        currency: 'USD',
        capacity: 400,
      },
      {
        creator_id: userIds[5],
        title: 'House Music Sundays',
        description: 'Every Sunday we bring the best house music to the rooftop. Day drinking, good vibes, and dancing until sunset. Free entry before 4pm!',
        venue: 'Sunset Club Rooftop',
        address: '555 Market St, San Francisco, CA',
        event_date: '2026-06-22T14:00',
        event_end: '2026-06-22T22:00',
        dj_artist: 'Lucy Grooves',
        genre: 'House',
        price: 20.00,
        currency: 'USD',
        capacity: 300,
      },
      {
        creator_id: userIds[6],
        title: 'Latin Heat: Reggaeton & Salsa',
        description: 'Get ready to move! A fiery mix of reggaeton, salsa, bachata, and Latin house. Dance lessons at 9pm before the party starts.',
        venue: 'Club Havana',
        address: '1234 Ocean Drive, Miami, FL',
        event_date: '2026-07-25T21:00',
        event_end: '2026-07-26T04:00',
        dj_artist: 'DJ Max Rodriguez',
        genre: 'Latin',
        price: 25.00,
        currency: 'USD',
        capacity: 450,
      },
      {
        creator_id: userIds[7],
        title: 'Trance Family Gathering',
        description: 'Calling all trance lovers! An epic night of uplifting trance, progressive, and psytrance. Lasers, fog machines, and pure euphoria.',
        venue: 'Avalon Hollywood',
        address: '1735 Vine St, Hollywood, CA',
        event_date: '2026-08-08T21:00',
        event_end: '2026-08-09T06:00',
        dj_artist: 'Armin van Buuren, Paul van Dyk',
        genre: 'Trance',
        price: 65.00,
        currency: 'USD',
        capacity: 1200,
      },
      {
        creator_id: userIds[8],
        title: 'Tokyo Underground: Minimal Techno',
        description: 'Experience the sound of Tokyo underground. Minimal, hypnotic, and deep. This is techno in its purest form. Early arrival recommended.',
        venue: 'Basement Club',
        address: '42 Division St, Chicago, IL',
        event_date: '2026-06-14T23:00',
        event_end: '2026-06-15T07:00',
        dj_artist: 'Kenji Tanaka & Guests',
        genre: 'Techno',
        price: 30.00,
        currency: 'USD',
        capacity: 180,
      },
      {
        creator_id: userIds[9],
        title: 'Soul Sessions: R&B Night',
        description: 'Smooth R&B, neo-soul, and classic slow jams. Dress to impress, sip champagne, and let the music move you. VIP booths available.',
        venue: 'Velvet Room',
        address: '789 Peachtree St, Atlanta, GA',
        event_date: '2026-07-05T20:00',
        event_end: '2026-07-06T02:00',
        dj_artist: 'DJ Destiny & Special Guests',
        genre: 'R&B',
        price: 35.00,
        currency: 'USD',
        capacity: 250,
      },
      {
        creator_id: userIds[5],
        title: 'Deep House Yacht Party',
        description: 'Set sail on the bay with deep house, disco, and good vibes. Limited to 100 guests for an intimate experience. Boat departs at 7pm sharp!',
        venue: 'Marina Bay Yacht Club',
        address: 'Pier 39, San Francisco, CA',
        event_date: '2026-07-18T19:00',
        event_end: '2026-07-18T23:00',
        dj_artist: 'Lucy Grooves & Friends',
        genre: 'Deep House',
        price: 85.00,
        currency: 'USD',
        capacity: 100,
      },
      {
        creator_id: userIds[6],
        title: 'Dubai Nights: Luxury Pool Party',
        description: 'Experience Dubai-style luxury in Miami. Poolside cabanas, premium bottle service, and international DJs. Swimwear and resort chic.',
        venue: 'Fontainebleau Miami Beach',
        address: '4441 Collins Ave, Miami Beach, FL',
        event_date: '2026-08-15T13:00',
        event_end: '2026-08-15T21:00',
        dj_artist: 'International Guest DJs',
        genre: 'House',
        price: 150.00,
        currency: 'AED',
        capacity: 600,
      },
      {
        creator_id: userIds[7],
        title: 'Ibiza Classics: White Party',
        description: 'All white everything! Inspired by the legendary Ibiza parties. Progressive house, melodic techno, and sunset views. White dress code strictly enforced.',
        venue: 'W Hotel Rooftop',
        address: '485 Brickell Ave, Miami, FL',
        event_date: '2026-08-22T17:00',
        event_end: '2026-08-23T01:00',
        dj_artist: 'Solomun, Tale of Us',
        genre: 'Melodic House',
        price: 75.00,
        currency: 'EUR',
        capacity: 400,
      },
      {
        creator_id: userIds[8],
        title: 'Drum & Bass Revolution',
        description: 'Fast beats, heavy bass, and nonstop energy. The best DnB DJs in one night. Jump up, liquid, and neurofunk on two stages.',
        venue: 'Factory 93',
        address: '888 S Hope St, Los Angeles, CA',
        event_date: '2026-09-05T21:00',
        event_end: '2026-09-06T04:00',
        dj_artist: 'Andy C, Netsky, Dimension',
        genre: 'Drum & Bass',
        price: 50.00,
        currency: 'USD',
        capacity: 700,
      },
      {
        creator_id: userIds[9],
        title: 'Gospel Brunch & Day Party',
        description: 'Start your Sunday right with gospel house, soulful brunch, and day party vibes. Bottomless mimosas included with entry.',
        venue: 'The Glass House',
        address: '95 Morton St, New York, NY',
        event_date: '2026-06-29T11:00',
        event_end: '2026-06-29T18:00',
        dj_artist: 'Various Soul & Gospel DJs',
        genre: 'Gospel House',
        price: 55.00,
        currency: 'USD',
        capacity: 200,
      },
      {
        creator_id: userIds[2],
        title: 'Indie Dance Night',
        description: 'Alternative dance music for those who like it different. Indie electronica, synth-pop, and new wave. Come as you are.',
        venue: 'The Echo',
        address: '1822 Sunset Blvd, Los Angeles, CA',
        event_date: '2026-07-11T21:00',
        event_end: '2026-07-12T02:00',
        dj_artist: 'Local Indie DJs',
        genre: 'Indie Dance',
        price: 18.00,
        currency: 'USD',
        capacity: 350,
      },
      {
        creator_id: userIds[3],
        title: 'Full Moon Beach Rave',
        description: 'Dance under the full moon on the beach. Trance, psytrance, and progressive beats. Fire dancers, art installations, and sunrise yoga.',
        venue: 'Secret Beach Location',
        address: 'Malibu, CA (location sent 24h before)',
        event_date: '2026-08-19T20:00',
        event_end: '2026-08-20T08:00',
        dj_artist: 'Underground Artists',
        genre: 'Psytrance',
        price: 40.00,
        currency: 'USD',
        capacity: 500,
      },
    ];

    const eventIds = [];
    for (const e of events) {
      const result = await db.pool.query(
        `INSERT INTO events (creator_id, title, description, venue, address, event_date, event_end, dj_artist, genre, price, currency, capacity)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12)
         RETURNING id`,
        [e.creator_id, e.title, e.description, e.venue, e.address, e.event_date, e.event_end, e.dj_artist, e.genre, e.price, e.currency, e.capacity]
      );
      eventIds.push(result.rows[0].id);
    }

    console.log(`Seeded ${eventIds.length} events`);

    // --- REVIEWS ---
    const reviews = [
      { user_id: userIds[2], event_id: eventIds[3], rating: 5, title: 'Incredible vibe', content: 'Techno Tuesdays never disappoints. The sound system at Club Void is unreal and the no-phone policy makes the experience so much more immersive.' },
      { user_id: userIds[3], event_id: eventIds[3], rating: 4, title: 'Great but crowded', content: 'Love the music selection and the dark room atmosphere. Gets pretty packed after midnight though - arrive early!' },
      { user_id: userIds[4], event_id: eventIds[0], rating: 5, title: 'Best rooftop party', content: 'Skyline Rooftop Club delivers every time. The city views combined with DJ Marcus spinning house tracks made for a magical night.' },
      { user_id: userIds[2], event_id: eventIds[0], rating: 4, title: 'Amazing venue', content: 'Beautiful rooftop setting and great music. Only dock one star because drinks were pricey, but the atmosphere made up for it.' },
      { user_id: userIds[1], event_id: eventIds[4], rating: 5, title: 'Hip-hop heaven', content: 'DJ Premier absolutely killed it. The golden era tracks had everyone dancing. MC battles were a highlight.' },
      { user_id: userIds[5], event_id: eventIds[8], rating: 5, title: 'Sunday perfection', content: 'House Music Sundays is my new favorite weekend ritual. Great crowd, great music, and the rooftop views are unbeatable.' },
      { user_id: userIds[7], event_id: eventIds[10], rating: 5, title: 'Trance heaven', content: 'The lasers were insane and the energy was through the roof. Armin played for 4 hours straight!' },
      { user_id: userIds[9], event_id: eventIds[12], rating: 4, title: 'Smooth vibes', content: 'Perfect R&B night. The Velvet Room has such a classy atmosphere. Will definitely be back.' },
      { user_id: userIds[6], event_id: eventIds[9], rating: 5, title: 'Latin fire!', content: 'Best Latin night in Miami! The salsa lessons before the party were so fun. Great mix of old and new hits.' },
      { user_id: userIds[8], event_id: eventIds[11], rating: 5, title: 'Pure techno bliss', content: 'Kenji brought the authentic Tokyo underground sound. Minimal, hypnotic, perfect. The basement venue added to the vibe.' },
    ];

    for (const r of reviews) {
      await db.pool.query(
        'INSERT INTO reviews (user_id, event_id, rating, title, content) VALUES ($1, $2, $3, $4, $5) ON CONFLICT (user_id, event_id) DO NOTHING',
        [r.user_id, r.event_id, r.rating, r.title, r.content]
      );
    }

    console.log(`Seeded ${reviews.length} reviews`);

    // --- VIP TABLES ---
    const tables = [
      { event_id: eventIds[0], host_id: userIds[4], table_label: 'Table 7 - Terrace', total_seats: 8, available_seats: 4, price_per_seat: 75.00, description: 'Premium terrace table with bottle of Grey Goose included.' },
      { event_id: eventIds[0], host_id: userIds[1], table_label: 'VIP Booth 3', total_seats: 6, available_seats: 3, price_per_seat: 50.00, description: 'Indoor VIP booth near the DJ stage.' },
      { event_id: eventIds[4], host_id: userIds[4], table_label: 'Balcony Table A', total_seats: 10, available_seats: 6, price_per_seat: 60.00, description: 'Balcony overlooking the main stage. Bottle service available.' },
      { event_id: eventIds[1], host_id: userIds[3], table_label: 'Front Row Section', total_seats: 4, available_seats: 2, price_per_seat: 100.00, description: 'Right next to the speakers. Not for the faint-hearted.' },
      { event_id: eventIds[9], host_id: userIds[6], table_label: 'VIP Cabana 1', total_seats: 8, available_seats: 5, price_per_seat: 80.00, description: 'Private cabana with bottle service and dedicated waitstaff.' },
      { event_id: eventIds[12], host_id: userIds[9], table_label: 'Champagne Booth', total_seats: 6, available_seats: 4, price_per_seat: 90.00, description: 'Premium booth with champagne package included.' },
      { event_id: eventIds[14], host_id: userIds[6], table_label: 'Poolside Cabana', total_seats: 10, available_seats: 7, price_per_seat: 200.00, description: 'Ultimate luxury poolside cabana with premium bottle service.' },
      { event_id: eventIds[10], host_id: userIds[7], table_label: 'VIP Platform', total_seats: 8, available_seats: 5, price_per_seat: 85.00, description: 'Elevated platform with best view of the stage and lasers.' },
    ];

    for (const t of tables) {
      await db.pool.query(
        'INSERT INTO vip_tables (event_id, host_id, table_label, total_seats, available_seats, price_per_seat, description) VALUES ($1, $2, $3, $4, $5, $6, $7)',
        [t.event_id, t.host_id, t.table_label, t.total_seats, t.available_seats, t.price_per_seat, t.description]
      );
    }

    console.log(`Seeded ${tables.length} VIP tables`);
    console.log('\n========================================');
    console.log('Seed complete!');
    console.log('========================================');
    console.log('Login credentials (all users): Password123');
    console.log('\nUsers:');
    users.forEach(u => console.log(`  - ${u.username} (${u.email})`));
    console.log('========================================\n');

    process.exit(0);
  } catch (err) {
    console.error('Seed failed:', err);
    process.exit(1);
  }
}

seed();
