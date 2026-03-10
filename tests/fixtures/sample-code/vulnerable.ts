/**
 * Sample vulnerable code for testing security scanning
 * Contains intentional security issues for test detection
 */

// Hardcoded API keys and secrets for testing secret detection
const GITHUB_TOKEN = 'ghp_xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx';
const AWS_ACCESS_KEY = 'AKIAIOSFODNN7EXAMPLE';
const AWS_SECRET_KEY = 'wJalrXUtnFEMI/K7MDENG/bPxRfiCYEXAMPLEKEY';

// Database credentials
const DB_PASSWORD = 'SuperSecretPassword123!';
const DB_CONNECTION_STRING = 'mongodb://admin:password123@localhost:27017/mydb';

/**
 * Function that uses hardcoded secrets (anti-pattern)
 */
export function connectToServices(): void {
  // Using hardcoded token
  const headers = {
    'Authorization': `Bearer ${GITHUB_TOKEN}`,
    'X-API-Key': AWS_ACCESS_KEY,
  };

  console.log('Connecting with headers:', headers);
}

/**
 * Function with SQL injection vulnerability
 */
export function getUserData(userId: string): string {
  // Vulnerable: directly concatenating user input into SQL
  const query = `SELECT * FROM users WHERE id = '${userId}'`;
  return query;
}

/**
 * Function with eval usage (code injection risk)
 */
export function processUserInput(input: string): unknown {
  // Vulnerable: using eval on user input
  return eval(input);
}

/**
 * Function with insecure randomness
 */
export function generateToken(): string {
  // Insecure: Math.random() is not cryptographically secure
  return Math.random().toString(36).substring(2);
}

export { GITHUB_TOKEN, AWS_ACCESS_KEY, AWS_SECRET_KEY };
