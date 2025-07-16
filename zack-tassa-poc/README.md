# Twilio Services (zack-tassa-poc)

## Overview
This project is a Twilio Serverless Toolkit proof of concept application designed to manage queueing, task routing, and Sync document updates for a contact center or similar workflow.

---

## Getting Started

### Prerequisites
- [Node.js](https://nodejs.org/) (LTS recommended)
- [Twilio CLI](https://www.twilio.com/docs/twilio-cli)
- Twilio Account (with credentials)

### Install the Twilio Serverless Toolkit

1. **Install the Twilio CLI:**
   ```sh
   npm install -g twilio-cli
   ```
2. **Install the Serverless plugin:**
   ```sh
   twilio plugins:install @twilio-labs/plugin-serverless
   ```
3. **Login to Twilio:**
   ```sh
   twilio login
   ```

### Local Development
- Start the local development server:
  ```sh
  twilio serverless:start
  ```
- Deploy to Twilio:
  ```sh
  twilio serverless:deploy
  ```

For more, see the [Twilio Serverless Toolkit docs](https://www.twilio.com/docs/labs/serverless-toolkit/getting-started).

---

## Project Structure

- `functions/` — Twilio Functions (API endpoints)
- `assets/helper-functions/` — Private helper modules for business logic

---

## Functions

### `functions/task/get-sync-grant.js`
Issues a Twilio Sync access token for a validated user.
- **CORS**: Handles preflight and CORS headers.
- **Token Verification**: Uses a JWT to verify the user's identity.
- **Sync Grant**: Issues a new Sync token for the user, valid for 1 hour.
- **Returns**: `{ authorized: true, syncToken: <jwt> }` on success.

### `functions/general/router.js`
Routes incoming events to the appropriate handler based on `EventType`.
- **reservation.* / task.* events**: Routed to the reservation handler.
- **worker.* events**: Routed to the queue info updater.
- **Unknown events**: Ignored with a reason.

### `functions/queue/get-queue-position.js`
*(Currently empty — placeholder for future queue position logic.)*

---

## Assets (Helper Functions)

### `assets/helper-functions/auth/verifyToken.private.js`
- Verifies a JWT token using a secret and checks the provided identity.
- Throws if the token is missing or invalid.

### `assets/helper-functions/network/cors.private.js`
- Adds CORS headers to Twilio Function responses.
- Handles preflight (OPTIONS) requests.

### `assets/helper-functions/general/updateSyncDoc.private.js`
- Helper to create or update a Twilio Sync Document.
- If the document exists, updates it; otherwise, creates a new one.

### `assets/helper-functions/task/reservation.private.js`
- Handles reservation and task events:
  - `task.created`: Marks topic as 'waiting'.
  - `reservation.accepted`: Marks topic as 'assigned' to a worker.
  - `reservation.completed`, `reservation.canceled`, `task.canceled`, `task.deleted`: Marks topic as 'completed'.
- Updates the relevant Sync Document for the topic.

### `assets/helper-functions/queue/queueInfo.private.js`
- Gathers all pending tasks and eligible workers from TaskRouter.
- Updates a Sync Document (`queue-status`) with:
  - List of pending tasks
  - List of eligible tellers (workers in "in-call", "post-call", or "available")
  - Timestamp of last update

---

## Environment Variables
- `ACCOUNT_SID`, `API_KEY`, `API_SECRET`: For Twilio API and token generation
- `SYNC_SERVICE_SID`: (optional) Twilio Sync Service SID
- `WORKSPACE_SID`: TaskRouter Workspace SID

---

## Useful Commands
- List all available commands:
  ```sh
  twilio serverless --help
  ```
- Get help for a specific command:
  ```sh
  twilio serverless:deploy --help
  ```

---

## Resources
- [Twilio Serverless Toolkit Docs](https://www.twilio.com/docs/labs/serverless-toolkit)
- [Twilio CLI](https://www.twilio.com/docs/twilio-cli)
- [Twilio Sync](https://www.twilio.com/docs/sync)
- [Twilio TaskRouter](https://www.twilio.com/docs/taskrouter)

## Additional Help
Need help? Reach out to me at zackavino@zacknetic.org.