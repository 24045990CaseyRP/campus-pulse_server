# Campus Pulse - Project Suggestions

## For Frontend Team
Here are some features your teammates can implement to make the app shine:

1.  **Interactive Map Integration**
    *   Use **React-Leaflet** or **Mapbox** to show Pings on a campus map.
    *   Users should receive a visual indicator (pins) where events are happening.
    *   Clicking a pin opens a popup with the Ping details.

2.  **Category Filters**
    *   Add buttons to filter the feed: "Free Food", "Events", "Study Space", "Alerts".
    *   Use icons or color-coding for each category (e.g., Pizza icon for food, Book for study).

3.  **"Hot" vs "New" Sorting**
    *   Allow sorting the feed by 'Newest' (default) or 'Popular' (most upvotes).
    *   Add visual cues (like a fire emoji 🔥) for pings with >10 upvotes.

4.  **Mobile-First Design**
    *   Students use phones. Ensure the UI looks like a native app.
    *   Bottom navigation bar (Map | Feed | Post | Profile).

5.  **Live Time Updates**
    *   Use `date-fns` or `moment.js` to show relative time (e.g., "posted 5 mins ago").
    *   Fade out or gray out pings older than 24 hours.

## For Backend (If you have extra time)
These are advanced features you can add to the `server.js`:

1.  **Real-Time Updates (Socket.io)**
    *   Instead of refreshing to see new pings, push them instantly to all connected clients.
    *   "A new Ping was just added near you!" toaster notification.

2.  **Image Uploads**
    *   Allow users to attach a photo to their Ping.
    *   Use `multer` middleware to handle file uploads.
    *   Store images on Cloudinary (free tier) or AWS S3.

3.  **Comments System**
    *   Create a `comments` table.
    *   Add endpoints: `GET /pings/:id/comments` and `POST /pings/:id/comments`.
    *   Allow users to discuss the event (e.g., "Is the pizza still there?").

4.  **User Reputation System (Karma)**
    *   Show a score on the user's profile based on total upvotes received.
    *   Gamify the engagement.

5.  **Clean-up Job**
    *   Write a Cron job (using `node-cron`) to automatically archive or delete pings older than 24-48 hours to keep the map clean.
