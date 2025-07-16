/**
 * Validation helper for workspace configurations
 * Ensures JSON input is properly formatted and contains required fields
 */

class WorkspaceValidator {
    /**
     * Validate workspace configuration
     * @param {Object} config - Workspace configuration object
     * @returns {Object} Validation result with isValid boolean and errors array
     */
    static validateWorkspaceConfig(config) {
        const errors = [];

        if (!config || typeof config !== 'object') {
            errors.push('Configuration must be a valid JSON object');
            return { isValid: false, errors };
        }

        // Validate workspace identifier
        if (!config.workspaceSid && !config.workspaceName) {
            console.log(config);
            console.log(`workspaceSid: ${config.workspaceSid}, workspaceName: ${config.workspaceName}`);
            errors.push('Either workspaceSid or workspaceName is required');
        }

        if (config.workspaceSid && typeof config.workspaceSid !== 'string') {
            errors.push('workspaceSid must be a string');
        }

        if (config.workspaceName && typeof config.workspaceName !== 'string') {
            errors.push('workspaceName must be a string');
        }

        // Validate settings
        if (config.settings) {
            const settingsErrors = this.validateSettings(config.settings);
            errors.push(...settingsErrors);
        }

        // Validate activities
        if (config.activities) {
            if (!Array.isArray(config.activities)) {
                errors.push('Activities must be an array');
            } else {
                config.activities.forEach((activity, index) => {
                    const activityErrors = this.validateActivity(activity, index);
                    errors.push(...activityErrors);
                });
            }
        }

        // Validate task queues
        if (config.taskQueues) {
            if (!Array.isArray(config.taskQueues)) {
                errors.push('Task queues must be an array');
            } else {
                config.taskQueues.forEach((queue, index) => {
                    const queueErrors = this.validateTaskQueue(queue, index);
                    errors.push(...queueErrors);
                });
            }
        }

        // Validate workflows
        if (config.workflows) {
            if (!Array.isArray(config.workflows)) {
                errors.push('Workflows must be an array');
            } else {
                config.workflows.forEach((workflow, index) => {
                    const workflowErrors = this.validateWorkflow(workflow, index);
                    errors.push(...workflowErrors);
                });
            }
        }

        // Validate workers
        if (config.workers) {
            if (!Array.isArray(config.workers)) {
                errors.push('Workers must be an array');
            } else {
                config.workers.forEach((worker, index) => {
                    const workerErrors = this.validateWorker(worker, index);
                    errors.push(...workerErrors);
                });
            }
        }

        return {
            isValid: errors.length === 0,
            errors
        };
    }

    /**
     * Validate settings object
     * @param {Object} settings - Settings configuration
     * @returns {Array} Array of validation errors
     */
    static validateSettings(settings) {
        const errors = [];

        if (settings.eventCallbackUrl && typeof settings.eventCallbackUrl !== 'string') {
            errors.push('Settings eventCallbackUrl must be a string');
        }

        if (settings.eventsFilter && typeof settings.eventsFilter !== 'string') {
            errors.push('Settings eventsFilter must be a string');
        }

        if (settings.multiTaskEnabled !== undefined && typeof settings.multiTaskEnabled !== 'boolean') {
            errors.push('Settings multiTaskEnabled must be a boolean');
        }

        if (settings.timeoutActivitySid && typeof settings.timeoutActivitySid !== 'string') {
            errors.push('Settings timeoutActivitySid must be a string');
        }

        if (settings.prioritizeQueueOrder && typeof settings.prioritizeQueueOrder !== 'string') {
            errors.push('Settings prioritizeQueueOrder must be a string');
        }

        return errors;
    }

    /**
     * Validate activity object
     * @param {Object} activity - Activity configuration
     * @param {number} index - Activity index for error reporting
     * @returns {Array} Array of validation errors
     */
    static validateActivity(activity, index) {
        const errors = [];

        if (!activity.friendlyName || typeof activity.friendlyName !== 'string') {
            errors.push(`Activity[${index}]: friendlyName is required and must be a string`);
        }

        if (activity.available !== undefined && typeof activity.available !== 'boolean') {
            errors.push(`Activity[${index}]: available must be a boolean`);
        }

        return errors;
    }

    /**
     * Validate task queue object
     * @param {Object} taskQueue - Task queue configuration
     * @param {number} index - Task queue index for error reporting
     * @returns {Array} Array of validation errors
     */
    static validateTaskQueue(taskQueue, index) {
        const errors = [];

        if (!taskQueue.friendlyName || typeof taskQueue.friendlyName !== 'string') {
            errors.push(`TaskQueue[${index}]: friendlyName is required and must be a string`);
        }

        if (taskQueue.targetWorkers && typeof taskQueue.targetWorkers !== 'string') {
            errors.push(`TaskQueue[${index}]: targetWorkers must be a string`);
        }

        if (taskQueue.maxReservedWorkers !== undefined && typeof taskQueue.maxReservedWorkers !== 'number') {
            errors.push(`TaskQueue[${index}]: maxReservedWorkers must be a number`);
        }

        if (taskQueue.taskOrder && typeof taskQueue.taskOrder !== 'string') {
            errors.push(`TaskQueue[${index}]: taskOrder must be a string`);
        }

        if (taskQueue.assignmentActivityName && typeof taskQueue.assignmentActivityName !== 'string') {
            errors.push(`TaskQueue[${index}]: assignmentActivityName must be a string`);
        }

        if (taskQueue.reservationActivityName && typeof taskQueue.reservationActivityName !== 'string') {
            errors.push(`TaskQueue[${index}]: reservationActivityName must be a string`);
        }

        return errors;
    }

    /**
     * Validate workflow object
     * @param {Object} workflow - Workflow configuration
     * @param {number} index - Workflow index for error reporting
     * @returns {Array} Array of validation errors
     */
    static validateWorkflow(workflow, index) {
        const errors = [];

        if (!workflow.friendlyName || typeof workflow.friendlyName !== 'string') {
            errors.push(`Workflow[${index}]: friendlyName is required and must be a string`);
        }

        if (!workflow.configuration || typeof workflow.configuration !== 'object') {
            errors.push(`Workflow[${index}]: configuration is required and must be an object`);
        }

        if (workflow.taskReservationTimeout !== undefined && typeof workflow.taskReservationTimeout !== 'number') {
            errors.push(`Workflow[${index}]: taskReservationTimeout must be a number`);
        }

        return errors;
    }

    /**
     * Validate worker object
     * @param {Object} worker - Worker configuration
     * @param {number} index - Worker index for error reporting
     * @returns {Array} Array of validation errors
     */
    static validateWorker(worker, index) {
        const errors = [];

        if (!worker.friendlyName || typeof worker.friendlyName !== 'string') {
            errors.push(`Worker[${index}]: friendlyName is required and must be a string`);
        }

        if (worker.attributes && typeof worker.attributes !== 'string') {
            errors.push(`Worker[${index}]: attributes must be a JSON string`);
        }

        // Note: activitySid is no longer used in JSON - new workers are automatically set to Offline
        // Existing workers' activities are never modified to avoid disrupting active workers

        return errors;
    }

    /**
     * Validate JSON string and parse it
     * @param {string} jsonString - JSON string to validate and parse
     * @returns {Object} Object with parsed data and validation result
     */
    static validateAndParseJSON(jsonString) {
        try {
            const parsed = JSON.parse(jsonString);
            const validation = this.validateWorkspaceConfig(parsed);
            
            return {
                isValid: validation.isValid,
                errors: validation.errors,
                data: parsed
            };
        } catch (error) {
            return {
                isValid: false,
                errors: [`Invalid JSON: ${error.message}`],
                data: null
            };
        }
    }
}

module.exports = { WorkspaceValidator }; 