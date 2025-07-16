# Workspace Management API

This document describes the workspace management functionality for Twilio TaskRouter, which allows you to sync workspaces and their components using JSON configuration files as the source of truth.

## Overview

The workspace management system provides APIs to:
- Sync workspace configuration with JSON as source of truth
- Create workspaces if they don't exist
- Retrieve workspace information
- Manage workers, task queues, workflows, activities, and settings

All APIs are protected with Twilio's built-in JWT authentication and can be called from Jenkins or other CI/CD processes.

## Authentication

All workspace management endpoints use Twilio's built-in JWT protection. Jenkins can handle JWT token generation and include it in the request headers.

### JWT Authentication
```bash
curl -X POST https://your-domain.com/manage-workspace \
  -H "Authorization: Bearer your-jwt-token" \
  -H "Content-Type: application/json" \
  -d @workspace-config.json
```

## API Endpoints

### 1. Manage Workspace
**Endpoint:** `POST /manage-workspace`

Syncs workspace configuration with JSON as source of truth. Creates workspace if it doesn't exist.
The system will:
- Create workspace if it doesn't exist (when using workspaceName)
- Add items present in JSON but missing in Twilio
- Update items that differ between JSON and Twilio
- Delete items present in Twilio but missing in JSON

**Request Body:** JSON configuration (see sample-workspace-config.json)

**Response:**
```json
{
  "success": true,
  "message": "Workspace created and configuration synced successfully",
  "workspaceSid": "WS...",
  "workspaceName": "Support Center",
  "workspaceCreated": true,
  "results": {
    "workers": {
      "added": ["Agent John"],
      "updated": ["Agent Sarah"],
      "deleted": ["Old Agent"]
    },
    "taskQueues": {
      "added": ["New Queue"],
      "updated": ["Updated Queue"],
      "deleted": ["Old Queue"]
    },
    "workflows": {
      "added": ["New Workflow"],
      "updated": ["Updated Workflow"],
      "deleted": ["Old Workflow"]
    },
    "activities": {
      "added": ["Available for Tasks"],
      "updated": ["On Break"],
      "deleted": ["Old Activity"]
    },
    "settings": {
      "updated": true
    }
  }
}
```

### 2. Get Workspace Information
**Endpoint:** `GET /get-workspace`

Retrieves complete workspace information.

**Query Parameters:**
- `workspaceSid`: Workspace SID (required if not using friendlyName)
- `friendlyName`: Workspace friendly name (alternative to workspaceSid)

**Example:**
```bash
curl -X GET "https://your-domain.com/get-workspace?workspaceSid=WS..." \
  -H "Authorization: Bearer your-jwt-token"
```

**Response:**
```json
{
  "success": true,
  "workspace": {
    "sid": "WS...",
    "friendlyName": "Support Center",
    "dateCreated": "2024-01-01T00:00:00Z",
    "dateUpdated": "2024-01-01T00:00:00Z",
    "eventCallbackUrl": "https://example.com/events",
    "eventsFilter": "task.created,task.completed",
    "multiTaskEnabled": true,
    "timeoutActivitySid": null,
    "prioritizeQueueOrder": "FIFO"
  },
  "activities": [...],
  "taskQueues": [...],
  "workflows": [...],
  "workers": [...]
}
```

## Configuration Format

### Complete Configuration
```json
{
  "workspaceName": "Support Center",
  "settings": {
    "eventCallbackUrl": "https://your-domain.com/events",
    "eventsFilter": "task.created,task.completed,worker.activity.update",
    "multiTaskEnabled": true,
    "timeoutActivitySid": null,
    "prioritizeQueueOrder": "FIFO"
  },
  "activities": [...],
  "taskQueues": [...],
  "workflows": [...],
  "workers": [...]
}
```

### Workspace Identification
You can identify the workspace in two ways:

1. **By Name (Recommended for new workspaces):**
```json
{
  "workspaceName": "Support Center",
  ...
}
```

2. **By SID (For existing workspaces):**
```json
{
  "workspaceSid": "WS...",
  ...
}
```

### Settings
```json
{
  "eventCallbackUrl": "https://your-domain.com/events",
  "eventsFilter": "task.created,task.completed,worker.activity.update",
  "multiTaskEnabled": true,
  "timeoutActivitySid": null,
  "prioritizeQueueOrder": "FIFO"
}
```

### Activities
```json
[
  {
    "friendlyName": "Available for Tasks",
    "available": true
  },
  {
    "friendlyName": "On Break",
    "available": false
  },
  {
    "friendlyName": "In Training",
    "available": false
  },
  {
    "friendlyName": "Lunch Break",
    "available": false
  },
  {
    "friendlyName": "Meeting",
    "available": false
  }
]
```

**Activity Fields:**
- **`friendlyName`**: Required string - unique name for the activity
- **`available`**: Boolean - whether workers in this activity can accept tasks

**Activity Management:**
- All activities in the JSON configuration will be created/updated
- Any activities not in the JSON will be deleted (including default activities)
- The system treats all activities equally - there are no "protected" activities

### Task Queues
```json
[
  {
    "friendlyName": "General Support",
    "targetWorkers": "1==1",
    "maxReservedWorkers": 5,
    "taskOrder": "FIFO"
  },
  {
    "friendlyName": "Technical Support",
    "targetWorkers": "worker.attributes.skills HAS \"technical\"",
    "maxReservedWorkers": 3,
    "taskOrder": "FIFO"
  },
  {
    "friendlyName": "Example with Activity Names",
    "targetWorkers": "languages HAS \"english\"",
    "maxReservedWorkers": 2,
    "taskOrder": "FIFO",
    "assignmentActivityName": "In-Call",
    "reservationActivityName": "Post-Call"
  }
]
```

**Task Queue Fields:**
- **`friendlyName`**: Required string - unique name for the task queue
- **`targetWorkers`**: String - TaskRouter expression to filter workers
- **`maxReservedWorkers`**: Number - maximum number of workers that can be reserved
- **`taskOrder`**: String - order for processing tasks ("FIFO" or "LIFO")
- **`assignmentActivityName`**: Optional string - activity name for when worker is assigned a task
- **`reservationActivityName`**: Optional string - activity name for when worker is reserved for a task

### Workflows
```json
[
  {
    "friendlyName": "Support Workflow",
    "configuration": {
      "task_routing": {
        "filters": [
          {
            "filter_friendly_name": "All Tasks",
            "expression": "1==1",
            "targets": [
              {
                "queue": "General Support",
                "timeout": 180,
                "expression": "worker.languages HAS task.requestLanguage AND worker.institutes HAS task.requestInstitute"
              },
              {
                "queue": "General Support",
                "expression": "worker.languages HAS task.requestLanguage",
                "timeout": 60
              },
              {
                "queue": "Technical Support",
                "expression": "worker.languages HAS task.requestLanguage AND worker.institutes HAS task.requestInstitute",
                "timeout": 30
              },
              {
                "queue": "Technical Support",
                "expression": "worker.languages HAS task.requestLanguage",
                "timeout": 30
              },
              {
                "queue": "Technical Support"
              }
            ]
          }
        ],
        "default_filter": {
          "queue": "Technical Support"
        }
      }
    },
    "taskReservationTimeout": 300
  }
]
```

**Important:** Workflows can reference task queues by their friendly names (like "General Support") instead of SIDs. The system automatically resolves these names to SIDs during sync.

### Workers
```json
[
  {
    "friendlyName": "teller_en_in1@fi.com",
    "attributes": "{\"languages\":[\"en-US\"],\"institutes\":[\"IN1\"],\"fullName\":\"William Riker\",\"isSupervisor\":\"No\"}"
  }
]
```

**Important:** Worker activities are handled automatically by the system:
- **New workers** are automatically set to the default activity (Offline if available, otherwise first available activity)
- **Existing workers** never have their activity modified to avoid disrupting active workers
- Only worker attributes are updated for existing workers

## Sync Behavior

The sync operation follows these rules:

1. **Workspace Creation**: If workspaceSid is not provided, the system will:
   - Look for an existing workspace with the given workspaceName
   - Create a new workspace if none exists
   - Return the workspaceSid in the response

2. **Sync Order**: Components are synced in this specific order to handle dependencies:
   - Settings (workspace configuration)
   - Activities (created before task queues)
   - Task Queues (can reference activities by name, created before workflows)
   - Workflows (can reference task queues by name)
   - Workers

3. **Component Sync**:
   - **Add**: If an item is present in JSON but missing in Twilio, it will be created
   - **Update**: If an item exists in both JSON and Twilio but differs, Twilio will be updated to match JSON
   - **Delete**: If an item is present in Twilio but missing in JSON, it will be deleted (except default activities)

### Special Cases

- **Default Activities**: The system will not delete or modify default activities (Offline, Idle, Busy, Reserved)
- **Worker Attributes**: Worker attributes must be JSON strings
- **Workflow Configuration**: Workflow configuration must be JSON objects (not strings)
- **Queue Name Resolution**: Workflows can reference task queues by friendly names instead of SIDs. The system automatically resolves names to SIDs during sync.
- **Activity Name Resolution**: Task queues can reference activities by friendly names instead of SIDs. The system automatically resolves names to SIDs during sync.
- **Worker Activity Protection**: Existing workers' activities are never modified to avoid disrupting active workers. New workers are automatically set to the default activity.


## Usage Examples

### Jenkins Pipeline Example
```groovy
pipeline {
    agent any
    
    environment {
        TWILIO_JWT_TOKEN = credentials('twilio-jwt-token')
        WORKSPACE_CONFIG = 'workspace-config.json'
    }
    
    stages {
        stage('Manage Workspace') {
            steps {
                script {
                    // Sync workspace configuration
                    sh """
                        curl -X POST https://your-domain.com/manage-workspace \\
                          -H "Authorization: Bearer ${TWILIO_JWT_TOKEN}" \\
                          -H "Content-Type: application/json" \\
                          -d @${WORKSPACE_CONFIG}
                    """
                }
            }
        }
        
        stage('Verify Sync') {
            steps {
                script {
                    // Get workspace info to verify
                    sh """
                        curl -X GET "https://your-domain.com/get-workspace?workspaceSid=WS..." \\
                          -H "Authorization: Bearer ${TWILIO_JWT_TOKEN}"
                    """
                }
            }
        }
    }
}
```

### GitHub Actions Example
```yaml
name: Manage Workspace
on:
  push:
    branches: [main]

jobs:
  manage:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v2
      
      - name: Manage Workspace
        run: |
          curl -X POST ${{ secrets.TWILIO_WORKSPACE_URL }}/manage-workspace \
            -H "Authorization: Bearer ${{ secrets.TWILIO_JWT_TOKEN }}" \
            -H "Content-Type: application/json" \
            -d @workspace-config.json
```

## Error Handling

The APIs return appropriate HTTP status codes:

- `200`: Success
- `400`: Bad Request (invalid configuration)
- `401`: Unauthorized (invalid JWT)
- `404`: Not Found (workspace not found)
- `500`: Internal Server Error

Error responses include detailed error messages:
```json
{
  "error": "Bad Request",
  "message": "Invalid configuration",
  "details": [
    "Activity[0]: friendlyName is required and must be a string"
  ]
}
```

## Security Considerations

1. **JWT Tokens**: Use Twilio's JWT tokens for authentication
2. **HTTPS**: Always use HTTPS for API calls
3. **Validation**: All input is validated before processing
4. **Logging**: All operations are logged for audit purposes
5. **Source Control**: JSON files should be version controlled

## File Structure

```
zack-tassa-poc/
├── assets/helper-functions/
│   ├── auth/
│   │   └── verifyToken.private.js       # Existing token verification
│   ├── workspace/
│   │   ├── workspaceManager.private.js  # Workspace sync logic
│   │   └── validation.private.js        # Configuration validation
│   └── network/
│       └── cors.private.js              # CORS handling
├── functions/workspace-management/
│   ├── manage-workspace.js              # Manage workspace
│   └── get-workspace.js                 # Get workspace info
├── sample-workspace-config.json         # Example configuration
└── WORKSPACE_MANAGEMENT.md              # This documentation
```

## Testing

You can test the APIs using the sample configuration:

```bash
# Test workspace management (creates if doesn't exist)
curl -X POST https://your-domain.com/manage-workspace \
  -H "Authorization: Bearer your-jwt-token" \
  -H "Content-Type: application/json" \
  -d @sample-workspace-config.json

# Test workspace retrieval
curl -X GET "https://your-domain.com/get-workspace?workspaceSid=WS..." \
  -H "Authorization: Bearer your-jwt-token"
```

## Support

For issues or questions about the workspace management API, please refer to the Twilio TaskRouter documentation or contact your system administrator. 