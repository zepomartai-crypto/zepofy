/**
 * Global Sanitization Middleware
 * Converts empty strings ("") in request body to null
 * This prevents Mongoose CastError for ObjectId fields
 */
const sanitizeEmptyStrings = (req, res, next) => {
    if (req.body && typeof req.body === 'object') {
        const sanitize = (obj) => {
            Object.keys(obj).forEach(key => {
                if (obj[key] === '') {
                    obj[key] = null;
                } else if (obj[key] !== null && typeof obj[key] === 'object') {
                    sanitize(obj[key]);
                }
            });
        };
        sanitize(req.body);
    }
    next();
};

module.exports = { sanitizeEmptyStrings };
