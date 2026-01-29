# Backend Handoff 🚀

## Project Overview
**Campus Pulse Server** is a Node.js/Express backend that powers the Campus Pulse real-time forum. It handles user authentication, CRUD operations for "Pings" (posts), commenting, and voting logic.

## 🛠 Tech Stack
- **Runtime**: Node.js
- **Framework**: Express.js
- **Database**: MySQL (using `mysql2` with Promise wrapper)
- **Image Handling**: `multer` (MemoryStorage) + `sharp` (Compression) -> Stored as `LONGBLOB` in MySQL.
- **Auth**: JWT (`jsonwebtoken`) + Password Hashing (`bcryptjs`).
- **Hosting Compat**: configured for cloud platforms like Render (includes `ca.pem` handling and SSL settings).

---

## 🔑 Environment Variables
You **MUST** set these environment variables in your `.env` file (locally) or your deployment platform (Render/Heroku/etc.):

| Variable | Description | Default (if any) |
| :--- | :--- | :--- |
| `PORT` | Server Port | `3000` |
| `DB_HOST` | Database Hostname | - |
| `DB_USER` | Database Username | - |
| `DB_PASSWORD` | Database Password | - |
| `DB_NAME` | Database Name | - |
| `DB_PORT` | Database Port | `3306` |
| `JWT_SECRET` | Secret key for signing tokens | `campus_pulse_secret_key_123` |

> **Note**: If using a managed database (like Aiven or Render Postgres), SSL is enabled by default in the config (`rejectUnauthorized: false`).

---

## 🗄 Database Schema
See `db_schema.sql` for the full initialization script.

### Tables
1. **`users`**: `id`, `username`, `password` (hashed), `role` (student/admin/ig_rep).
2. **`pings`**: `id`, `user_id`, `content`, `location_name`, `image_data` (BLOB), `upvotes`, `is_active`.
3. **`comments`**: `id`, `ping_id`, `user_id`, `content`, `image_data` (BLOB).
4. **`ping_votes`**: `id`, `user_id`, `ping_id`, `vote_type`. Tracks unique votes to prevent spam.

**Key Design Choice**: Images are stored directly in the database as `LONGBLOB`s to simplify deployment (no S3 bucket required for this MVP). Images are compressed to JPEG/80% quality via `sharp` before storage.

---

## 📡 API Endpoints

### Authentication
- **`POST /register`**: Create account. Body: `{ username, password, role }`.
- **`POST /login`**: Returns JWT. Body: `{ username, password }`.

### Pings (Feeds)
- **`GET /pings`**: Returns active pings with `image_base64` strings.
- **`POST /pings`**: Create ping. **Multipart/Form-Data**. Fields: `content`, `category`, `location_name`, `image` (file). **Auth Required**.
- **`POST /pings/:id/vote`**: Toggle upvote. **Auth Required**.
- **`DELETE /pings/:id`**: Users delete own; Admin deletes any. **Auth Required**.

### Comments
- **`GET /pings/:id/comments`**: Get comments for a ping.
- **`POST /pings/:id/comments`**: Add comment. **Multipart/Form-Data**. Fields: `content`, `image` (file). **Auth Required**.

---

## 🏃‍♂️ How to Run
1. **Install**: `npm install`
2. **Setup DB**: Run `db_schema.sql` queries in your MySQL instance.
3. **Configure**: Create `.env` based on the table above.
4. **Start**: 
   - Dev: `npx nodemon server.js`
   - Prod: `node server.js`

## ⚠️ Implementation Notes
- **CORS**: Currently allows `http://localhost:3000`, `http://localhost:5173`, and `https://campus-pulse-server.onrender.com/`. Update `allowedOrigins` in `server.js` if frontend URL changes.
- **Memory Limit**: Multer is configured to limit uploads to 5MB.
- **Base64 Images**: The `GET /pings` and `GET /.../comments` endpoints automatically convert the Buffer content from DB to Base64 strings (`image_base64`) for easy frontend rendering.
