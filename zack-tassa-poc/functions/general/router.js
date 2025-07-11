const { reservationHandler } = require(Runtime.getAssets()['/helper-functions/task/reservation.js'].path);
const { updateQueueInfo } = require(Runtime.getAssets()['/helper-functions/queue/queueInfo.js'].path);

// @twilio-function protected
exports.handler = async function (context, event, callback) {
    const { EventType } = event;
    if (!EventType) {
        console.log('No EventType provided in event:', event);
        return callback(null, { ignored: true, reason: 'No EventType provided' });
    }

    // // Route reservation events to the reservation handler
    if (EventType.startsWith('reservation.') || EventType.startsWith('task.')) {

        return await reservationHandler(context, event, callback);
    }

    // Route worker events to the queue info handler
    if (EventType.startsWith('worker.')) {
        return await updateQueueInfo(context, event, callback);
    }


    // Unknown event type
    console.log('Unknown EventType:', EventType);
    return callback(null, { ignored: true, reason: 'Unrecognized EventType' });
};