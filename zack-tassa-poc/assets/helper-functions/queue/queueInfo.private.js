const { updateOrCreateSyncDoc } = require(Runtime.getAssets()['/helper-functions/general/updateSyncDoc.js'].path);

async function updateQueueInfo(context, event, callback) {
    const client = context.getTwilioClient();
    const WORKSPACE_SID = context.WORKSPACE_SID;
    const SYNC_SERVICE_SID = context.SYNC_SERVICE_SID || 'default';
    const SYNC_DOC_NAME = 'queue-status'; // Or per-queue if needed

    try {
        // 1. Get all pending tasks in all queues (or just relevant queues if you wish)
        const pendingTasks = await client.taskrouter.v1
            .workspaces(WORKSPACE_SID)
            .tasks
            .list({
                assignmentStatus: 'pending',
                limit: 300
            });

        // 2. Get all eligible tellers (workers in "in-call", "post-call", "available")
        const allWorkers = await client.taskrouter.v1
            .workspaces(WORKSPACE_SID)
            .workers
            .list({ limit: 300 });

        const eligibleTellers = allWorkers
            .filter(w =>
                ["in-call", "post-call", "available"].includes(w.activityName)
            )
            .map(w => ({
                sid: w.sid,
                activityName: w.activityName,
                attributes: w.attributes && JSON.parse(w.attributes)
            }));

        // 3. Compose data for syncdoc
        const docData = {
            pendingTasks: pendingTasks.map(t => ({
                sid: t.sid,
                attributes: t.attributes && JSON.parse(t.attributes),
                dateCreated: t.dateCreated
            })),
            eligibleTellers,
            lastUpdated: new Date().toISOString()
        };

        // 4. Use your helper function to update/create the sync doc
        await updateOrCreateSyncDoc(client, SYNC_SERVICE_SID, SYNC_DOC_NAME, docData);

        return callback(null, { status: "ok", doc: SYNC_DOC_NAME });
    } catch (err) {
        console.error('Error updating SyncDoc for worker activity:', err);
        return callback(err);
    }
};

module.exports = {
    updateQueueInfo
};
