const jwt = require('jsonwebtoken');

function verifyToken(token, secret, providedIdentity) {
    if (!token) throw new Error('Missing token');
    const decoded = jwt.verify(token, secret, { algorithms: ['HS256'] });
    const identity = decoded.identity || (decoded.grants && decoded.grants.identity);
    if (!identity || identity !== providedIdentity) throw new Error('Identity is not correct.');
    return identity;
};

module.exports = {
    verifyToken
};