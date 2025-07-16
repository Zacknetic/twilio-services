const { handleCors } = require(Runtime.getAssets()['/helper-functions/network/cors.js'].path);

/**
 * Get Workspace Information API
 * Retrieves complete workspace information including all components
 * 
 * Query Parameters:
 * - workspaceSid: The SID of the workspace to retrieve (required)
 * - friendlyName: Alternative to workspaceSid, retrieves by friendly name
 */

// @twilio-function protected
exports.handler = async function (context, event, callback) {
    const { response, isPreflight } = handleCors(event);
    
    if (isPreflight) {
        return callback(null, response);
    }

    try {
        // Get workspace identifier from query parameters
        const workspaceSid = event.workspaceSid || event.WorkspaceSid;
        const friendlyName = event.friendlyName || event.FriendlyName;

        if (!workspaceSid && !friendlyName) {
            response.setStatusCode(400);
            response.setBody({
                error: 'Bad Request',
                message: 'Either workspaceSid or friendlyName is required'
            });
            return callback(null, response);
        }

        const twilio = require('twilio');
        const client = twilio(context.ACCOUNT_SID, context.TWILIO_AUTH_TOKEN);
        const taskrouter = client.taskrouter;
        let targetWorkspaceSid = workspaceSid;

        if (!targetWorkspaceSid) {
            // Get workspace by friendly name
            const workspaces = await taskrouter.v1.workspaces.list({ friendlyName });
            
            if (workspaces.length === 0) {
                response.setStatusCode(404);
                response.setBody({
                    error: 'Not Found',
                    message: `Workspace with friendly name '${friendlyName}' not found`
                });
                return callback(null, response);
            }
            
            targetWorkspaceSid = workspaces[0].sid;
        }

        // Get workspace information
        const workspace = await taskrouter.v1.workspaces(targetWorkspaceSid).fetch();
        const activities = await taskrouter.v1.workspaces(targetWorkspaceSid).activities.list();
        const taskQueues = await taskrouter.v1.workspaces(targetWorkspaceSid).taskQueues.list();
        const workflows = await taskrouter.v1.workspaces(targetWorkspaceSid).workflows.list();
        const workers = await taskrouter.v1.workspaces(targetWorkspaceSid).workers.list();

        // Prepare response data
        const responseData = {
            success: true,
            workspace: {
                sid: workspace.sid,
                friendlyName: workspace.friendlyName,
                dateCreated: workspace.dateCreated,
                dateUpdated: workspace.dateUpdated,
                eventCallbackUrl: workspace.eventCallbackUrl,
                eventsFilter: workspace.eventsFilter,
                multiTaskEnabled: workspace.multiTaskEnabled,
                timeoutActivitySid: workspace.timeoutActivitySid,
                prioritizeQueueOrder: workspace.prioritizeQueueOrder
            },
            activities: activities.map(activity => ({
                sid: activity.sid,
                friendlyName: activity.friendlyName,
                available: activity.available,
                timeout: activity.timeout,
                dateCreated: activity.dateCreated,
                dateUpdated: activity.dateUpdated
            })),
            taskQueues: taskQueues.map(queue => ({
                sid: queue.sid,
                friendlyName: queue.friendlyName,
                targetWorkers: queue.targetWorkers,
                maxReservedWorkers: queue.maxReservedWorkers,
                taskOrder: queue.taskOrder,
                dateCreated: queue.dateCreated,
                dateUpdated: queue.dateUpdated
            })),
            workflows: workflows.map(workflow => ({
                sid: workflow.sid,
                friendlyName: workflow.friendlyName,
                configuration: workflow.configuration,
                taskReservationTimeout: workflow.taskReservationTimeout,
                dateCreated: workflow.dateCreated,
                dateUpdated: workflow.dateUpdated
            })),
            workers: workers.map(worker => ({
                sid: worker.sid,
                friendlyName: worker.friendlyName,
                attributes: worker.attributes,
                activitySid: worker.activitySid,
                dateCreated: worker.dateCreated,
                dateUpdated: worker.dateUpdated
            }))
        };

        response.setStatusCode(200);
        response.setBody(responseData);

    } catch (error) {
        console.error('Error in getWorkspaceHandler:', error);
        
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
                message: error.message || 'An error occurred while retrieving workspace information'
            });
        }
    }

    return callback(null, response);
}; 