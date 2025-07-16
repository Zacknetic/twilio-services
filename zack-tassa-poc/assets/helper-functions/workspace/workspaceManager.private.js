/**
 * Workspace Manager for Twilio TaskRouter
 * Handles workspace management based on JSON configuration as source of truth
 */

class WorkspaceManager {
    constructor(context) {
        this.client = context.getTwilioClient();
        this.taskrouter = this.client.taskrouter;
    }

    /**
     * Sync workspace configuration with JSON as source of truth
     * @param {string} workspaceSid - Workspace SID
     * @param {Object} config - Configuration object with workers, taskQueues, workflows, activities, settings
     * @returns {Object} Results of sync operations
     */
    async syncWorkspace(workspaceSid, config) {
        const results = {
            workers: { added: [], updated: [], deleted: [] },
            taskQueues: { added: [], updated: [], deleted: [] },
            workflows: { added: [], updated: [], deleted: [] },
            activities: { added: [], updated: [], deleted: [] },
            settings: { updated: false }
        };

        try {
            // Sync settings first
            if (config.settings) {
                await this.syncSettings(workspaceSid, config.settings);
                results.settings.updated = true;
            }

            // Sync activities FIRST (task queues depend on them for activity names)
            if (config.activities) {
                results.activities = await this.syncActivities(workspaceSid, config.activities);
            }

            // Sync task queues AFTER activities (to resolve activity names to SIDs)
            if (config.taskQueues) {
                results.taskQueues = await this.syncTaskQueues(workspaceSid, config.taskQueues);
            }

            // Sync workflows AFTER task queues (to resolve queue names to SIDs)
            if (config.workflows) {
                results.workflows = await this.syncWorkflows(workspaceSid, config.workflows);
            }

            // Sync workers
            if (config.workers) {
                results.workers = await this.syncWorkers(workspaceSid, config.workers);
            }

            return results;
        } catch (error) {
            console.error('Error syncing workspace:', error);
            throw error;
        }
    }

    /**
     * Sync workspace settings
     */
    async syncSettings(workspaceSid, settings) {
        const workspace = await this.taskrouter.v1.workspaces(workspaceSid).fetch();
        
        const updateData = {};
        if (settings.eventCallbackUrl !== undefined) updateData.eventCallbackUrl = settings.eventCallbackUrl;
        if (settings.eventsFilter !== undefined) updateData.eventsFilter = settings.eventsFilter;
        if (settings.multiTaskEnabled !== undefined) updateData.multiTaskEnabled = settings.multiTaskEnabled;
        if (settings.timeoutActivitySid !== undefined) updateData.timeoutActivitySid = settings.timeoutActivitySid;
        if (settings.prioritizeQueueOrder !== undefined) updateData.prioritizeQueueOrder = settings.prioritizeQueueOrder;

        if (Object.keys(updateData).length > 0) {
            await this.taskrouter.v1.workspaces(workspaceSid).update(updateData);
            console.log('Updated workspace settings');
        }
    }

    /**
     * Sync activities - add missing, update different, delete extra
     */
    async syncActivities(workspaceSid, jsonActivities) {
        const results = { added: [], updated: [], deleted: [] };
        
        // Get current activities from Twilio
        const twilioActivities = await this.taskrouter.v1.workspaces(workspaceSid).activities.list();
        
        // Create maps for easy lookup
        const jsonActivityMap = new Map(jsonActivities.map(a => [a.friendlyName, a]));
        const twilioActivityMap = new Map(twilioActivities.map(a => [a.friendlyName, a]));

        // Add missing activities
        for (const [name, jsonActivity] of jsonActivityMap) {
            if (!twilioActivityMap.has(name)) {
                const activity = await this.taskrouter.v1.workspaces(workspaceSid).activities.create({
                    friendlyName: jsonActivity.friendlyName,
                    available: jsonActivity.available,
                    timeout: jsonActivity.timeout
                });
                results.added.push(name);
                console.log(`Added activity: ${name}`);
            }
        }

        // Update different activities
        for (const [name, jsonActivity] of jsonActivityMap) {
            const twilioActivity = twilioActivityMap.get(name);
            if (twilioActivity && this.isActivityDifferent(jsonActivity, twilioActivity)) {
                await this.taskrouter.v1.workspaces(workspaceSid).activities(twilioActivity.sid).update({
                    available: jsonActivity.available,
                    timeout: jsonActivity.timeout
                });
                results.updated.push(name);
                console.log(`Updated activity: ${name}`);
            }
        }

        // Delete extra activities (including default ones if not in JSON)
        for (const [name, twilioActivity] of twilioActivityMap) {
            if (!jsonActivityMap.has(name)) {
                await this.taskrouter.v1.workspaces(workspaceSid).activities(twilioActivity.sid).remove();
                results.deleted.push(name);
                console.log(`Deleted activity: ${name}`);
            }
        }

        return results;
    }

    /**
     * Sync task queues - add missing, update different, delete extra
     */
    async syncTaskQueues(workspaceSid, jsonQueues) {
        const results = { added: [], updated: [], deleted: [] };
        
        // Get current task queues from Twilio
        const twilioQueues = await this.taskrouter.v1.workspaces(workspaceSid).taskQueues.list();
        
        // Create maps for easy lookup
        const jsonQueueMap = new Map(jsonQueues.map(q => [q.friendlyName, q]));
        const twilioQueueMap = new Map(twilioQueues.map(q => [q.friendlyName, q]));

        // Add missing task queues
        for (const [name, jsonQueue] of jsonQueueMap) {
            if (!twilioQueueMap.has(name)) {
                const queueData = {
                    friendlyName: jsonQueue.friendlyName,
                    targetWorkers: jsonQueue.targetWorkers,
                    maxReservedWorkers: jsonQueue.maxReservedWorkers,
                    taskOrder: jsonQueue.taskOrder
                };
                
                // Resolve activity names to SIDs if provided
                if (jsonQueue.assignmentActivityName) {
                    const assignmentSid = await this.resolveActivityNameToSid(workspaceSid, jsonQueue.assignmentActivityName);
                    if (assignmentSid) {
                        queueData.assignmentActivitySid = assignmentSid;
                    } else {
                        console.warn(`Assignment activity name "${jsonQueue.assignmentActivityName}" not found for queue "${name}"`);
                    }
                }
                if (jsonQueue.reservationActivityName) {
                    const reservationSid = await this.resolveActivityNameToSid(workspaceSid, jsonQueue.reservationActivityName);
                    if (reservationSid) {
                        queueData.reservationActivitySid = reservationSid;
                    } else {
                        console.warn(`Reservation activity name "${jsonQueue.reservationActivityName}" not found for queue "${name}"`);
                    }
                }
                
                const queue = await this.taskrouter.v1.workspaces(workspaceSid).taskQueues.create(queueData);
                results.added.push(name);
                console.log(`Added task queue: ${name}`);
            }
        }

        // Update different task queues
        for (const [name, jsonQueue] of jsonQueueMap) {
            const twilioQueue = twilioQueueMap.get(name);
            if (twilioQueue && await this.isTaskQueueDifferent(jsonQueue, twilioQueue)) {
                const updateData = {
                    targetWorkers: jsonQueue.targetWorkers,
                    maxReservedWorkers: jsonQueue.maxReservedWorkers,
                    taskOrder: jsonQueue.taskOrder
                };
                
                // Resolve activity names to SIDs if provided
                if (jsonQueue.assignmentActivityName !== undefined) {
                    if (jsonQueue.assignmentActivityName) {
                        const assignmentSid = await this.resolveActivityNameToSid(workspaceSid, jsonQueue.assignmentActivityName);
                        if (assignmentSid) {
                            updateData.assignmentActivitySid = assignmentSid;
                        } else {
                            console.warn(`Assignment activity name "${jsonQueue.assignmentActivityName}" not found for queue "${name}"`);
                        }
                    } else {
                        updateData.assignmentActivitySid = null; // Clear the assignment activity
                    }
                }
                if (jsonQueue.reservationActivityName !== undefined) {
                    if (jsonQueue.reservationActivityName) {
                        const reservationSid = await this.resolveActivityNameToSid(workspaceSid, jsonQueue.reservationActivityName);
                        if (reservationSid) {
                            updateData.reservationActivitySid = reservationSid;
                        } else {
                            console.warn(`Reservation activity name "${jsonQueue.reservationActivityName}" not found for queue "${name}"`);
                        }
                    } else {
                        updateData.reservationActivitySid = null; // Clear the reservation activity
                    }
                }
                
                await this.taskrouter.v1.workspaces(workspaceSid).taskQueues(twilioQueue.sid).update(updateData);
                results.updated.push(name);
                console.log(`Updated task queue: ${name}`);
            }
        }

        // Delete extra task queues
        for (const [name, twilioQueue] of twilioQueueMap) {
            if (!jsonQueueMap.has(name)) {
                await this.taskrouter.v1.workspaces(workspaceSid).taskQueues(twilioQueue.sid).remove();
                results.deleted.push(name);
                console.log(`Deleted task queue: ${name}`);
            }
        }

        return results;
    }

    /**
     * Sync workflows - add missing, update different, delete extra
     */
    async syncWorkflows(workspaceSid, jsonWorkflows) {
        const results = { added: [], updated: [], deleted: [] };
        
        // Get current workflows from Twilio
        const twilioWorkflows = await this.taskrouter.v1.workspaces(workspaceSid).workflows.list();
        
        // Create maps for easy lookup
        const jsonWorkflowMap = new Map(jsonWorkflows.map(w => [w.friendlyName, w]));
        const twilioWorkflowMap = new Map(twilioWorkflows.map(w => [w.friendlyName, w]));

        // Add missing workflows
        for (const [name, jsonWorkflow] of jsonWorkflowMap) {
            if (!twilioWorkflowMap.has(name)) {
                const resolvedConfig = await this.resolveQueueNamesToSids(workspaceSid, jsonWorkflow.configuration);
                const workflow = await this.taskrouter.v1.workspaces(workspaceSid).workflows.create({
                    friendlyName: jsonWorkflow.friendlyName,
                    configuration: JSON.stringify(resolvedConfig),
                    taskReservationTimeout: jsonWorkflow.taskReservationTimeout
                });
                results.added.push(name);
                console.log(`Added workflow: ${name}`);
            }
        }

        // Update different workflows
        for (const [name, jsonWorkflow] of jsonWorkflowMap) {
            const twilioWorkflow = twilioWorkflowMap.get(name);
            if (twilioWorkflow && this.isWorkflowDifferent(jsonWorkflow, twilioWorkflow)) {
                const resolvedConfig = await this.resolveQueueNamesToSids(workspaceSid, jsonWorkflow.configuration);
                await this.taskrouter.v1.workspaces(workspaceSid).workflows(twilioWorkflow.sid).update({
                    configuration: JSON.stringify(resolvedConfig),
                    taskReservationTimeout: jsonWorkflow.taskReservationTimeout
                });
                results.updated.push(name);
                console.log(`Updated workflow: ${name}`);
            }
        }

        // Delete extra workflows
        for (const [name, twilioWorkflow] of twilioWorkflowMap) {
            if (!jsonWorkflowMap.has(name)) {
                await this.taskrouter.v1.workspaces(workspaceSid).workflows(twilioWorkflow.sid).remove();
                results.deleted.push(name);
                console.log(`Deleted workflow: ${name}`);
            }
        }

        return results;
    }

    /**
     * Sync workers - add missing, update different, delete extra
     * IMPORTANT: Never modify existing workers' activities to avoid disrupting active workers
     */
    async syncWorkers(workspaceSid, jsonWorkers) {
        const results = { added: [], updated: [], deleted: [] };
        
        // Get current workers from Twilio
        const twilioWorkers = await this.taskrouter.v1.workspaces(workspaceSid).workers.list();
        
        // Create maps for easy lookup
        const jsonWorkerMap = new Map(jsonWorkers.map(w => [w.friendlyName, w]));
        const twilioWorkerMap = new Map(twilioWorkers.map(w => [w.friendlyName, w]));

        // Get activity SID for new workers (try Offline first, then first available activity)
        let defaultActivitySid = await this.resolveActivityNameToSid(workspaceSid, 'Offline');
        if (!defaultActivitySid) {
            // If Offline doesn't exist, use the first available activity
            const activities = await this.taskrouter.v1.workspaces(workspaceSid).activities.list();
            const availableActivity = activities.find(a => a.available);
            if (availableActivity) {
                defaultActivitySid = availableActivity.sid;
            } else if (activities.length > 0) {
                // Fallback to first activity if no available ones
                defaultActivitySid = activities[0].sid;
            }
        }

        // Add missing workers
        for (const [name, jsonWorker] of jsonWorkerMap) {
            if (!twilioWorkerMap.has(name)) {
                const worker = await this.taskrouter.v1.workspaces(workspaceSid).workers.create({
                    friendlyName: jsonWorker.friendlyName,
                    attributes: jsonWorker.attributes,
                    activitySid: defaultActivitySid // Set new workers to default activity
                });
                results.added.push(name);
                console.log(`Added worker: ${name} (set to default activity)`);
            }
        }

        // Update different workers (ONLY attributes, never activity)
        for (const [name, jsonWorker] of jsonWorkerMap) {
            const twilioWorker = twilioWorkerMap.get(name);
            if (twilioWorker && this.isWorkerAttributesDifferent(jsonWorker, twilioWorker)) {
                await this.taskrouter.v1.workspaces(workspaceSid).workers(twilioWorker.sid).update({
                    attributes: jsonWorker.attributes
                    // Note: We intentionally do NOT update activitySid to preserve worker's current state
                });
                results.updated.push(name);
                console.log(`Updated worker attributes: ${name} (preserved current activity)`);
            }
        }

        // Delete extra workers
        for (const [name, twilioWorker] of twilioWorkerMap) {
            if (!jsonWorkerMap.has(name)) {
                await this.taskrouter.v1.workspaces(workspaceSid).workers(twilioWorker.sid).remove();
                results.deleted.push(name);
                console.log(`Deleted worker: ${name}`);
            }
        }

        return results;
    }

    // Helper methods to compare objects
    isActivityDifferent(json, twilio) {
        return json.available !== twilio.available || json.timeout !== twilio.timeout;
    }

    async isTaskQueueDifferent(json, twilio) {
        // For activity comparisons, we need to resolve names to SIDs
        let assignmentActivitySid = null;
        let reservationActivitySid = null;
        
        if (json.assignmentActivityName) {
            assignmentActivitySid = await this.resolveActivityNameToSid(twilio.workspaceSid, json.assignmentActivityName);
        }
        if (json.reservationActivityName) {
            reservationActivitySid = await this.resolveActivityNameToSid(twilio.workspaceSid, json.reservationActivityName);
        }
        
        return json.targetWorkers !== twilio.targetWorkers || 
               json.maxReservedWorkers !== twilio.maxReservedWorkers ||
               json.taskOrder !== twilio.taskOrder ||
               assignmentActivitySid !== twilio.assignmentActivitySid ||
               reservationActivitySid !== twilio.reservationActivitySid;
    }

    /**
     * Resolve activity name to SID
     * @param {string} workspaceSid - Workspace SID
     * @param {string} activityName - Activity friendly name
     * @returns {string|null} Activity SID or null if not found
     */
    async resolveActivityNameToSid(workspaceSid, activityName) {
        const activities = await this.taskrouter.v1.workspaces(workspaceSid).activities.list();
        const activity = activities.find(a => a.friendlyName === activityName);
        return activity ? activity.sid : null;
    }

    /**
     * Resolve queue names to SIDs in workflow configuration
     * @param {string} workspaceSid - Workspace SID
     * @param {Object} config - Workflow configuration object
     * @returns {Object} Configuration with queue names replaced by SIDs
     */
    async resolveQueueNamesToSids(workspaceSid, config) {
        // Get all task queues to create name-to-SID mapping
        const taskQueues = await this.taskrouter.v1.workspaces(workspaceSid).taskQueues.list();
        const queueNameToSid = new Map(taskQueues.map(q => [q.friendlyName, q.sid]));
        
        // Deep clone the config to avoid modifying the original
        const resolvedConfig = JSON.parse(JSON.stringify(config));
        
        // Helper function to resolve queue references recursively
        const resolveQueues = (obj) => {
            if (typeof obj !== 'object' || obj === null) return;
            
            // Handle arrays
            if (Array.isArray(obj)) {
                obj.forEach(item => resolveQueues(item));
                return;
            }
            
            // Handle objects
            for (const [key, value] of Object.entries(obj)) {
                if (key === 'queue' && typeof value === 'string') {
                    // Check if this is a queue name (not already a SID)
                    if (!value.startsWith('WQ')) {
                        const sid = queueNameToSid.get(value);
                        if (sid) {
                            obj[key] = sid;
                        } else {
                            console.warn(`Queue name "${value}" not found in workspace`);
                        }
                    }
                } else if (typeof value === 'object' && value !== null) {
                    resolveQueues(value);
                }
            }
        };
        
        resolveQueues(resolvedConfig);
        return resolvedConfig;
    }

    isWorkflowDifferent(json, twilio) {
        // For comparison, we need to resolve the JSON config to match Twilio's format
        // This is a simplified comparison - in practice, you might want to parse and compare the actual structure
        const jsonConfig = JSON.stringify(json.configuration);
        return jsonConfig !== twilio.configuration ||
               json.taskReservationTimeout !== twilio.taskReservationTimeout;
    }

    isWorkerAttributesDifferent(json, twilio) {
        // Only compare attributes, never compare activity to avoid disrupting active workers
        return json.attributes !== twilio.attributes;
    }

    isWorkerDifferent(json, twilio) {
        return json.attributes !== twilio.attributes ||
               json.activitySid !== twilio.activitySid;
    }


}

module.exports = { WorkspaceManager }; 