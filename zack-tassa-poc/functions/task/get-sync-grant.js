
const twilio = require('twilio');
const { verifyToken } = require(Runtime.getAssets()['/helper-functions/auth/verifyToken.js'].path);
const { handleCors } = require(Runtime.getAssets()['/helper-functions/network/cors.js'].path);

// @twilio-function public
exports.handler = async function (context, event, callback) {

    //required for CORS in every Twilio Function
    const { response, isPreflight } = handleCors(event);
    if (isPreflight) return callback(null, response);

    const { ACCOUNT_SID, API_KEY, API_SECRET, SYNC_SERVICE_SID = 'default' } = context;
    const {consumerId,  token: incomingToken} = event;

    try {
        // identity validation handled by verifyToken, no need to handle it here
        const identity = verifyToken(incomingToken, API_SECRET, consumerId);

        // issue a NEW token for Sync and return a Sync Document
        const AccessToken = twilio.jwt.AccessToken;
        const SyncGrant = AccessToken.SyncGrant;
        const syncToken = new AccessToken(ACCOUNT_SID, API_KEY, API_SECRET, {
            identity,
            ttl: 3600 
        });
        const syncGrant = new SyncGrant({ serviceSid: SYNC_SERVICE_SID });
        syncToken.addGrant(syncGrant);

        response.setStatusCode(200);
        response.setBody({
            authorized: true,
            syncToken: syncToken.toJwt(),
        });
        return callback(null, response);
    } catch (err) {
        response.setStatusCode(500);
        response.setBody({ error: 'Failed to issue Sync token', details: err.message });
        return callback(null, response);
    }
};
