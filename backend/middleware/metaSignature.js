/* 
DEPRECATED: Manual Meta Signature verification.
Ignored as per user request to simplify.
*/

// Simple pass-through middleware since signature verification is disabled
module.exports = (req, res, next) => {
    // Allow webhook processing without verification
    return next();
};
