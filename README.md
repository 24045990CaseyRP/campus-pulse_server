# Campus Pulse Server

This is the backend server for the **Campus Pulse** application, a real-time forum for campus engagement.

## Project Structure

*   **`server.js`**: The main entry point. It sets up the Express server, connects to the database, and defines all API routes.
*   **`db_schema.sql`**: A SQL script to initialize your database tables (`users`, `pings`, `ping_votes`).
*   **`.env`**: Stores sensitive configuration like database passwords and API keys. **Do not commit this to GitHub.**
*   **`.gitignore`**: Tells Git which files to ignore (like `node_modules` and `.env`).
*   **`ca.pem`**: (Optional) The SSL certificate authority file, required if connecting to certain cloud databases like Aiven.

## Setup Instructions

1.  **Install Dependencies**:
    ```bash
    npm install
    ```

2.  **Configure Environment**:
    *   Open the `.env` file.
    *   Fill in your Database credentials (`DB_HOST`, `DB_USER`, etc.).
    *   Set a secure `JWT_SECRET`.

3.  **Setup Database**:
    *   Run the contents of `db_schema.sql` in your database tool (MySQL Workbench, phpMyAdmin, or Render's SQL tab).

4.  **Run Server**:
    ```bash
    npm start
    # or for development with auto-restart (if nodemon is installed)
    npx nodemon server.js
    ```

## API Endpoints

### Authentication
*   **POST** `/register`: Create a new account.
    *   Body: `{ "username": "...", "password": "...", "role": "student" }`
*   **POST** `/login`: Login and receive a JWT token.
    *   Body: `{ "username": "...", "password": "..." }`

### Pings (The Feed)
*   **GET** `/pings`: Get the latest 50 active pings for the feed.
*   **POST** `/pings`: Create a new ping.
    *   Header: `Authorization: Bearer <token>`
    *   Body: `{ "content": "Free pizza!", "category": "Food", "location_name": "Atrium" }`
*   **POST** `/pings/:id/vote`: Upvote a ping (toggle).
    *   Header: `Authorization: Bearer <token>`
*   **DELETE** `/pings/:id`: Delete a ping (Users can delete their own; Admins can delete any).
    *   Header: `Authorization: Bearer <token>`

### Database Info
The database consists of three main tables:
1.  **Users**: Stores user credentials and roles.
2.  **Pings**: Stores the actual posts/events.
3.  **Ping_Votes**: Tracks unique upvotes to prevent spam.

## Deployment to Render
1.  Push this code to GitHub.
2.  Create a new **Web Service** on Render.
3.  Connect your repo.
4.  Add your Environment Variables (from your `.env` file) into the Render dashboard.
