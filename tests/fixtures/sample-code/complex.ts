//**
 * Sample complex code for testing performance analysis
 * Contains functions with high cyclomatic complexity and long functions
 */

/**
 * Function with high cyclomatic complexity (>10)
 * Multiple nested conditionals and loops
 */
export function processData(data: unknown[]): unknown[] {
  const results: unknown[] = [];

  for (let i = 0; i < data.length; i++) {
    const item = data[i];

    if (item !== null) {
      if (typeof item === 'string') {
        if (item.length > 0) {
          if (item.startsWith('prefix_')) {
            results.push(item.substring(7));
          } else if (item.startsWith('other_')) {
            results.push(item.substring(6));
          } else if (item.includes('special')) {
            results.push(item.replace('special', 'normal'));
          } else {
            results.push(item.toLowerCase());
          }
        }
      } else if (typeof item === 'number') {
        if (item > 0) {
          if (item < 100) {
            results.push(item * 2);
          } else if (item < 1000) {
            results.push(item * 1.5);
          } else {
            results.push(item);
          }
        } else if (item < 0) {
          results.push(Math.abs(item));
        } else {
          results.push(0);
        }
      } else if (typeof item === 'object') {
        if (Array.isArray(item)) {
          if (item.length > 0) {
            results.push(...item);
          }
        } else {
          results.push(item);
        }
      }
    }
  }

  return results;
}

/**
 * Very long function (>50 lines)
 * Does multiple unrelated things
 */
export function handleRequest(request: {
  type: string;
  payload: unknown;
  userId?: string;
  timestamp?: number;
}): { success: boolean; data?: unknown; error?: string } {
  // Validate request type
  if (!request.type) {
    return { success: false, error: 'Missing request type' };
  }

  // Validate payload exists
  if (!request.payload) {
    return { success: false, error: 'Missing payload' };
  }

  // Validate userId for authenticated requests
  if (request.type !== 'public' && !request.userId) {
    return { success: false, error: 'Authentication required' };
  }

  // Check timestamp freshness
  const now = Date.now();
  if (request.timestamp && now - request.timestamp > 300000) {
    return { success: false, error: 'Request expired' };
  }

  // Process based on request type
  let result: unknown;

  switch (request.type) {
    case 'create': {
      const payload = request.payload as Record<string, unknown>;
      if (!payload.name) {
        return { success: false, error: 'Name required for create' };
      }
      result = { id: Math.random().toString(36), ...payload };
      break;
    }
    case 'update': {
      const payload = request.payload as { id: string; data: unknown };
      if (!payload.id) {
        return { success: false, error: 'ID required for update' };
      }
      result = payload;
      break;
    }
    case 'delete': {
      const payload = request.payload as { id: string };
      if (!payload.id) {
        return { success: false, error: 'ID required for delete' };
      }
      result = { deleted: payload.id };
      break;
    }
    case 'query': {
      const payload = request.payload as { filters?: Record<string, unknown>; limit?: number };
      result = {
        items: [],
        total: 0,
        filters: payload.filters || {},
        limit: payload.limit || 10,
      };
      break;
    }
    default:
      return { success: false, error: `Unknown request type: ${request.type}` };
  }

  // Log the request
  console.log(`[${new Date().toISOString()}] ${request.type} request from ${request.userId || 'anonymous'}`);

  // Return success response
  return { success: true, data: result };
}

/**
 * Deeply nested function
 */
export function nestedLogic(value: number): string {
  if (value > 0) {
    if (value > 10) {
      if (value > 100) {
        if (value > 1000) {
          return 'very large';
        } else {
          return 'large';
        }
      } else {
        if (value > 50) {
          return 'medium-large';
        } else {
          return 'medium';
        }
      }
    } else {
      if (value > 5) {
        return 'small-medium';
      } else {
        return 'small';
      }
    }
  } else if (value < 0) {
    return 'negative';
  } else {
    return 'zero';
  }
}

/**
 * Function with many parameters (code smell)
 */
export function createUser(
  firstName: string,
  lastName: string,
  email: string,
  phone: string,
  address: string,
  city: string,
  state: string,
  zipCode: string,
  country: string,
  birthDate: string,
  preferences: Record<string, unknown>
): Record<string, unknown> {
  return {
    firstName,
    lastName,
    email,
    phone,
    address,
    city,
    state,
    zipCode,
    country,
    birthDate,
    preferences,
    createdAt: new Date().toISOString(),
  };
}
