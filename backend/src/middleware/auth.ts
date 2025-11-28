import { Request, Response, NextFunction } from 'express';
import jwt from 'jsonwebtoken';
import { ApiError } from './errorHandler';

export interface JwtPayload {
  userId: string;
  email: string;
  role: 'student' | 'barber' | 'admin';
  campusId: number;
}

export interface AuthRequest extends Request {
  user?: JwtPayload;
}

export const authenticate = (
  req: AuthRequest,
  res: Response,
  next: NextFunction
) => {
  try {
    const authHeader = req.headers.authorization;

    // DEVELOPMENT MODE BYPASS: Allow access without token
    // TODO: Remove this bypass in production!
    if (process.env.NODE_ENV === 'development' && (!authHeader || !authHeader.startsWith('Bearer '))) {
      console.warn('⚠️  DEV MODE: Bypassing authentication - using mock admin user');
      req.user = {
        userId: 'dev-admin-001',
        email: 'admin@campuscuts.dev',
        role: 'admin',
        campusId: 1,
      };
      return next();
    }

    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      throw new ApiError(401, 'No token provided');
    }

    const token = authHeader.substring(7);
    const secret = process.env.JWT_SECRET;

    if (!secret) {
      throw new Error('JWT_SECRET not configured');
    }

    const decoded = jwt.verify(token, secret) as JwtPayload;
    req.user = decoded;
    next();
  } catch (error) {
    if (error instanceof jwt.JsonWebTokenError) {
      next(new ApiError(401, 'Invalid token'));
    } else if (error instanceof jwt.TokenExpiredError) {
      next(new ApiError(401, 'Token expired'));
    } else {
      next(error);
    }
  }
};

export const requireRole = (...roles: string[]) => {
  return (req: AuthRequest, res: Response, next: NextFunction) => {
    if (!req.user) {
      return next(new ApiError(401, 'Not authenticated'));
    }

    if (!roles.includes(req.user.role)) {
      return next(new ApiError(403, 'Insufficient permissions'));
    }

    next();
  };
};

export const requireEmailVerification = (
  req: AuthRequest,
  res: Response,
  next: NextFunction
) => {
  // This would check the user's email_verified status from database
  // Implementation depends on how you structure your queries
  next();
};

