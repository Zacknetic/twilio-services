const { WorkspaceManager } = require(Runtime.getAssets()['/helper-functions/workspace/workspaceManager.js'].path);
const { WorkspaceValidator } = require(Runtime.getAssets()['/helper-functions/workspace/validation.js'].path);
const { handleCors } = require(Runtime.getAssets()['/helper-functions/network/cors.js'].path);

// @twilio-function public
exports.handler = async function (context, event, callback) {
    const { response, isPreflight } = handleCors(event);
    
    if (isPreflight) {
        return callback(null, response);
    }

    try {
        // Get the request body
        const requestBody = event.Body || event.body || event;
        console.log('Request Body:', requestBody);
        if (!requestBody) {
            response.setStatusCode(400);
            response.setBody({
                error: 'Bad Request',
                message: 'Request body is required'
            });
            return callback(null, response);
        }

        // Parse and validate JSON
        let config;
        if (typeof requestBody === 'string') {
            const validation = WorkspaceValidator.validateAndParseJSON(requestBody);
            if (!validation.isValid) {
                response.setStatusCode(400);
                response.setBody({
                    error: 'Bad Request',
                    message: 'Invalid JSON configuration',
                    details: validation.errors
                });
                return callback(null, response);
            }
            config = validation.data;
        } else {
            const validation = WorkspaceValidator.validateWorkspaceConfig(requestBody);
            if (!validation.isValid) {
                response.setStatusCode(400);
                response.setBody({
                    error: 'Bad Request',
                    message: 'Invalid configuration',
                    details: validation.errors
                });
                return callback(null, response);
            }
            config = requestBody;
        }

        // Validate that either workspaceSid or workspaceName is provided
        if (!config.workspaceSid && !config.workspaceName) {
            response.setStatusCode(400);
            response.setBody({
                error: 'Bad Request',
                message: 'Either workspaceSid or workspaceName is required'
            });
            return callback(null, response);
        }

        // Initialize workspace manager
        const workspaceManager = new WorkspaceManager(context);
        let workspaceSid = config.workspaceSid;
        let workspaceCreated = false;

        // If workspaceSid is not provided, try to find or create workspace by name
        if (!workspaceSid) {
            const client = context.getTwilioClient();
            const taskrouter = client.taskrouter;

            // Check if workspace exists by name
            const existingWorkspaces = await taskrouter.v1.workspaces.list({ friendlyName: config.workspaceName });
            
            if (existingWorkspaces.length > 0) {
                workspaceSid = existingWorkspaces[0].sid;
                console.log(`Found existing workspace: ${workspaceSid}`);
            } else {
                // Create new workspace
                const workspace = await taskrouter.v1.workspaces.create({
                    friendlyName: config.workspaceName,
                    eventCallbackUrl: config.settings?.eventCallbackUrl,
                    eventsFilter: config.settings?.eventsFilter,
                    multiTaskEnabled: config.settings?.multiTaskEnabled,
                    prioritizeQueueOrder: config.settings?.prioritizeQueueOrder
                });
                workspaceSid = workspace.sid;
                workspaceCreated = true;
                console.log(`Created new workspace: ${workspaceSid}`);
            }
        }

        // Sync the workspace configuration
        const results = await workspaceManager.syncWorkspace(workspaceSid, config);

        // Prepare response
        const responseData = {
            success: true,
            message: workspaceCreated ? 
                'Workspace created and configuration synced successfully' : 
                'Workspace configuration synced successfully',
            workspaceSid: workspaceSid,
            workspaceName: config.workspaceName,
            workspaceCreated: workspaceCreated,
            results: results
        };

        response.setStatusCode(200);
        response.setBody(responseData);

    } catch (error) {
        console.error('Error in manageWorkspaceHandler:', error);
        
        if (error.code === 20008) { // Twilio error code for resource not found
            response.setStatusCode(404);
            response.setBody({
                error: 'Not Found',
                message: 'Workspace not found'
            });
        } else {
            response.setStatusCode(500);
            response.setBody({
                error: 'Internal Server Error',
                message: error.message || 'An error occurred while managing the workspace configuration'
            });
        }
    }

    return callback(null, response);
}; 