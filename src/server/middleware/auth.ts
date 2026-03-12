import { Request, Response, NextFunction } from 'express';
import crypto from 'crypto';

export interface AuthConfig {
  enabled: boolean;
  apiKeys: Set<string>;
  jwtSecret: string | null;
}

export interface AuthenticatedRequest extends Request {
  user?: {
    type: 'api-key' | 'jwt';
    value: string;
  };
}

const config: AuthConfig = {
  enabled: process.env.SWARM_AUTH_ENABLED === 'true',
  apiKeys: new Set((process.env.SWARM_API_KEYS || '').split(',').filter(Boolean)),
  jwtSecret: process.env.SWARM_JWT_SECRET || null
};

function verifyJWT(token: string, secret: string): { sub: string } | null {
  try {
    const parts = token.split('.');
    if (parts.length !== 3) return null;
    
    const payload = JSON.parse(Buffer.from(parts[1], 'base64').toString());
    const signature = parts[0] + '.' + parts[1];
    const expectedSig = crypto
      .createHmac('sha256', secret)
      .update(signature)
      .digest('base64url');
    
    if (expectedSig !== parts[2]) return null;
    
    return payload as { sub: string };
  } catch {
    return null;
  }
}

export function authMiddleware(
  req: AuthenticatedRequest,
  res: Response,
  next: NextFunction
): void | Response {
  if (!config.enabled) {
    return next();
  }

  const apiKey = req.headers['x-api-key'] as string | undefined;
  const authHeader = req.headers['authorization'] as string | undefined;

  if (apiKey && config.apiKeys.has(apiKey)) {
    req.user = { type: 'api-key', value: apiKey };
    return next();
  }

  if (authHeader?.startsWith('Bearer ')) {
    const token = authHeader.slice(7);
    if (config.jwtSecret) {
      const decoded = verifyJWT(token, config.jwtSecret);
      if (decoded) {
        req.user = { type: 'jwt', value: decoded.sub };
        return next();
      } else {
        return res.status(401).json({
          error: 'Invalid JWT token',
          code: 'UNAUTHORIZED'
        });
      }
    }
  }

  if (!apiKey && !authHeader) {
    return res.status(401).json({
      error: 'API key or JWT token required',
      code: 'UNAUTHORIZED'
    });
  }

  return res.status(401).json({
    error: 'Invalid credentials',
    code: 'UNAUTHORIZED'
  });
}

export function generateToken(payload: object): string | null {
  if (!config.jwtSecret) return null;
  
  const header = Buffer.from(JSON.stringify({ alg: 'HS256', typ: 'JWT' })).toString('base64url');
  const payloadB64 = Buffer.from(JSON.stringify(payload)).toString('base64url');
  const signature = crypto
    .createHmac('sha256', config.jwtSecret)
    .update(header + '.' + payloadB64)
    .digest('base64url');
  
  return `${header}.${payloadB64}.${signature}`;
}

export function validateApiKey(key: string): boolean {
  return config.apiKeys.has(key);
}
