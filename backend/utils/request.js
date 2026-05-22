export function getOpenId(req) {
  return req.headers['x-openid'] || req.query.openid || 'dev-openid';
}

export function asyncRoute(handler) {
  return async (req, res, next) => {
    try {
      await handler(req, res, next);
    } catch (error) {
      if (error.statusCode) {
        res.status(error.statusCode).json({ message: error.message });
        return;
      }
      next(error);
    }
  };
}
