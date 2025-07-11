/**
 * Helper to create or update a Twilio Sync Document.
 * If the doc exists, update. If not, create.
 */
async function createOrUpdateSyncDoc(client, serviceSid, uniqueName, data) {
  try {
    await client.sync.v1.services(serviceSid).documents.create({
      uniqueName,
      data,
    });
    return { action: 'created', data };
  } catch (err) {
    if (err.code === 54301) {
      // Document exists, so update instead
      await client.sync.v1.services(serviceSid).documents(uniqueName).update({ data });
      return { action: 'updated', data };
    } else {
      throw err;
    }
  }
}

module.exports = { createOrUpdateSyncDoc };
