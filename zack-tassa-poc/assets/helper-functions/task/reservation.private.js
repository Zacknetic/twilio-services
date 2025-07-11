const { createOrUpdateSyncDoc } = require(Runtime.getAssets()['/helper-functions/general/updateSyncDoc.js'].path);

async function reservationHandler(context, event, callback) {
  console.log('reservationHandler called with event:', event.EventType);
  const { EventType, WorkerSid, ReservationSid, TaskAttributes = '{}' } = event;
  const client = context.getTwilioClient();
  const SYNC_SERVICE_SID = context.SYNC_SERVICE_SID || 'default';

  try {
    const attributes = JSON.parse(TaskAttributes);
    const topic = attributes.details?.topic;
    if (!topic) {
      console.log('Missing details.topic in TaskAttributes:', attributes);
      return callback(null, { error: 'Missing details.topic in TaskAttributes' });
    }

    let data;
    switch (EventType) {
      case 'task.created':
        data = { topic, status: 'waiting' };
        break;
      case 'reservation.accepted':
        data = { status: 'assigned', topic, assignedTo: WorkerSid, reservationSid: ReservationSid };
        break;
      case 'reservation.completed':
      case 'reservation.canceled':
      case 'task.canceled':
      case 'task.deleted':
        data = { status: 'completed', topic, reservationSid: ReservationSid };
        break;
      default:
        // fallback: ignore unhandled reservation events
        return callback(null, { ignored: true, reason: 'Unhandled reservation EventType', event: EventType });
    }

    await createOrUpdateSyncDoc(client, SYNC_SERVICE_SID, topic, data);
    return callback(null, { success: true, event: EventType, topic });


  } catch (err) {
    console.error('Error in reservation callback:', err);
    return callback(null, { error: 'Internal error', details: err.message });
  }
};

module.exports = {
  reservationHandler
};
