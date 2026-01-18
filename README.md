# Insurance Policy Management System

A Node.js REST API for managing insurance policies with MongoDB, featuring CSV/XLSX upload processing using worker threads.

## Prerequisites

- Node.js (v14 or higher)
- MongoDB (running locally or MongoDB Atlas connection string)

## Installation

1. Install dependencies:
```bash
npm install
```

2. Create a `.env` file in the root directory:
```
PORT=5001
MONGODB_URI=mongodb://localhost:27017/insured-mine
```

3. Start MongoDB (if running locally):
```bash
mongod
```

4. Start the server:
```bash
npm start
```

For development with auto-reload:
```bash
npm run dev
```

## API Endpoints

### 1. Upload CSV/XLSX File
**POST** `/api/upload`

Upload a CSV or XLSX file to process and store data in MongoDB using worker threads.

**Request:**
- Method: POST
- Content-Type: multipart/form-data
- Body: Form data with `file` field containing the CSV/XLSX file

**Example using curl:**
```bash
curl -X POST http://localhost:5001/api/upload \
  -F "file=@data-sheet.csv"
```

**Response:**
```json
{
  "status": "processing",
  "message": "File upload successful. Processing started.",
  "file": "data-sheet.csv"
}
```

### 2. Search Policies by Username
**GET** `/api/policies/search?username=<name>`

Search for policy information using username (firstname).

**Example:**
```bash
curl http://localhost:5001/api/policies/search?username=Lura
```

**Response:**
```json
{
  "message": "Found 1 policy(s) for username: Lura",
  "count": 1,
  "policies": [
    {
      "policy_number": "YEEX9MOIBU7X",
      "policy_start_date": "2018-11-02T00:00:00.000Z",
      "policy_end_date": "2019-11-02T00:00:00.000Z",
      "policy_category": "Commercial Auto",
      "company_name": "Integon Gen Ins Corp",
      "user": {
        "id": "...",
        "firstname": "Lura Lucca",
        "email": "madler@yahoo.ca",
        ...
      }
    }
  ]
}
```

### 3. Get Aggregated Policies by User
**GET** `/api/policies/aggregated`

Get all policies grouped by user with aggregated statistics.

**Example:**
```bash
curl http://localhost:5001/api/policies/aggregated
```

**Response:**
```json
{
  "message": "Found 150 user(s) with policies",
  "total_users": 150,
  "total_policies": 1198,
  "data": [
    {
      "user": {
        "id": "...",
        "firstname": "Lura Lucca",
        "email": "madler@yahoo.ca",
        ...
      },
      "policy_count": 2,
      "policies": [
        {
          "policy_number": "YEEX9MOIBU7X",
          "policy_start_date": "2018-11-02T00:00:00.000Z",
          "policy_end_date": "2019-11-02T00:00:00.000Z",
          "policy_category": "Commercial Auto",
          "company_name": "Integon Gen Ins Corp"
        },
        ...
      ]
    },
    ...
  ]
}
```

### 4. Health Check
**GET** `/health`

Check if the server is running.

**Response:**
```json
{
  "status": "OK",
  "message": "Server is running",
  "timestamp": "2024-01-01T12:00:00.000Z"
}
```

### 5. CPU Status
**GET** `/api/cpu-status`

Get current CPU usage and monitoring status.

**Example:**
```bash
curl http://localhost:5001/api/cpu-status
```

**Response:**
```json
{
  "cpu_usage": "45.23",
  "threshold": 70,
  "is_monitoring": true,
  "status": "OK",
  "timestamp": "2024-01-01T12:00:00.000Z"
}
```

### 6. Schedule a Message
**POST** `/api/scheduled-messages`

Schedule a message to be inserted into the database at a specific day and time.

**Request Body:**
```json
{
  "message": "This is a scheduled message",
  "day": "monday",
  "time": "14:30"
}
```

**Parameters:**
- `message` (string, required): The message content to be inserted
- `day` (string, required): Day of the week (monday, tuesday, wednesday, thursday, friday, saturday, sunday)
- `time` (string, required): Time in 24-hour format (HH:mm, e.g., "14:30")

**Example:**
```bash
curl -X POST http://localhost:5001/api/scheduled-messages \
  -H "Content-Type: application/json" \
  -d '{
    "message": "Scheduled notification message",
    "day": "friday",
    "time": "15:00"
  }'
```

**Response:**
```json
{
  "message": "Scheduled message created successfully",
  "data": {
    "id": "...",
    "message": "Scheduled notification message",
    "scheduled_day": "friday",
    "scheduled_time": "15:00",
    "scheduled_datetime": "2024-01-05T15:00:00.000Z",
    "status": "pending"
  }
}
```

### 7. Get All Scheduled Messages
**GET** `/api/scheduled-messages`

Get all scheduled messages. Optionally filter by status.

**Query Parameters:**
- `status` (optional): Filter by status (pending, completed, failed, cancelled)

**Example:**
```bash
curl http://localhost:5001/api/scheduled-messages?status=pending
```

**Response:**
```json
{
  "message": "Found 5 scheduled message(s)",
  "count": 5,
  "data": [
    {
      "_id": "...",
      "message": "Scheduled notification message",
      "scheduled_day": "friday",
      "scheduled_time": "15:00",
      "scheduled_datetime": "2024-01-05T15:00:00.000Z",
      "status": "pending",
      ...
    },
    ...
  ]
}
```

### 8. Get a Specific Scheduled Message
**GET** `/api/scheduled-messages/:id`

Get details of a specific scheduled message.

### 9. Cancel a Scheduled Message
**DELETE** `/api/scheduled-messages/:id`

Cancel a pending scheduled message.

## MongoDB Collections

1. **Agent** - Stores agent names
2. **User** - Stores user information (firstname, DOB, address, phone, state, zip, email, gender, userType)
3. **UserAccount** - Stores account names
4. **LOB** - Stores policy categories (Line of Business)
5. **Carrier** - Stores insurance company names
6. **Policy** - Stores policy information with references to User, LOB, and Carrier
7. **ScheduledMessage** - Stores scheduled messages with day, time, and status
8. **Message** - Stores executed messages that were inserted at their scheduled time

## Project Structure

```
insured-mine/
├── config/
│   └── database.js          # MongoDB connection
├── models/
│   ├── Agent.js             # Agent model
│   ├── User.js              # User model
│   ├── UserAccount.js       # UserAccount model
│   ├── LOB.js               # Policy Category model
│   ├── Carrier.js           # Carrier model
│   ├── Policy.js            # Policy model
│   ├── ScheduledMessage.js  # Scheduled message model
│   └── Message.js           # Executed message model
├── routes/
│   ├── upload.js            # File upload routes
│   ├── policies.js          # Policy search and aggregation routes
│   └── scheduledMessages.js # Scheduled message routes
├── services/
│   ├── cpuMonitor.js        # CPU monitoring service
│   └── scheduler.js         # Message scheduler service
├── workers/
│   └── csvProcessor.js      # Worker thread for CSV processing
├── uploads/                 # Uploaded files directory (created automatically)
├── server.js                # Main server file
├── package.json
└── README.md
```

## Worker Threads

The CSV/XLSX processing is handled by worker threads to:
- Process large files without blocking the main event loop
- Provide better performance for CPU-intensive parsing and database operations
- Allow the API to return immediately while processing continues in the background

## Error Handling

The API includes comprehensive error handling for:
- Invalid file types
- File upload errors
- Database connection issues
- Missing required fields
- Invalid queries

## Notes

- The upload API returns immediately (202 Accepted) while processing continues in the background
- Worker threads process data in batches for optimal performance
- Duplicate detection is implemented to prevent inserting the same records multiple times
- Caching is used in the worker thread to minimize database queries during processing
- **CPU Monitoring**: The server monitors CPU usage every 5 seconds. When CPU usage exceeds 70%, the server automatically restarts.
- **Server Restart**: When CPU threshold is exceeded, the server performs a graceful shutdown and spawns a new process.
- **Message Scheduling**: Messages are scheduled using node-cron and executed at the exact specified day and time.
- **Message Execution**: When a scheduled time arrives, the message is inserted into the Messages collection, and the ScheduledMessage status is updated to 'completed'.
- **Day Calculation**: If the specified day/time has already passed in the current week, the message is scheduled for the same day next week.
- **Background Processing**: Both CPU monitoring and message scheduling run in the background without blocking the main server operations.

## CPU Monitoring

The server includes real-time CPU monitoring that:
- Checks CPU usage every 5 seconds
- Automatically restarts the server when CPU usage exceeds 70%
- Provides a `/api/cpu-status` endpoint to check current CPU usage
- Uses `pidusage` package for accurate process-level CPU monitoring
- Falls back to system-wide CPU usage if process monitoring fails

## Message Scheduling

The message scheduling system:
- Accepts messages with a specific day and time (24-hour format)
- Calculates the next occurrence of the specified day/time
- Uses node-cron for reliable scheduling
- Inserts messages into the Messages collection at the scheduled time
- Updates ScheduledMessage status to track execution
- Handles errors gracefully and marks failed messages appropriately

