const jwt = require('jsonwebtoken');

module.exports = function authenticate(req, res, next) {
	const authHeader = req.headers.authorization || '';
	const token = authHeader.startsWith('Bearer ') ? authHeader.substring(7) : null;

	if (!token) return res.status(401).json({ message: 'Authorization token missing' });

	try {
		const secret = process.env.JWT_SECRET;
		if (!secret) return res.status(500).json({ message: 'Server misconfigured: JWT_SECRET not set' });
		const decoded = jwt.verify(token, secret);
		req.user = { id: decoded.id };
		return next();
	} catch (err) {
		return res.status(401).json({ message: 'Invalid or expired token' });
	}
};


