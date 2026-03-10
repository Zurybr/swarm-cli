/**
 * Security Expert Definition
 *
 * Expert agent specializing in security analysis, secret detection,
 * vulnerability scanning, and secure code pattern analysis.
 */

import { ExpertDefinition } from '../expert-agent';
import { SecurityReviewSkill } from './skill';

/**
 * Security Expert definition
 *
 * Extends the securityEngineer personality from agency-agents with
 * specialized security analysis capabilities.
 */
export const securityExpert: ExpertDefinition = {
  // AgencyAgent fields
  id: 'security-expert',
  name: 'Security Expert',
  division: 'Security',
  role: 'security-specialist',
  description: 'Specialized security analysis expert providing deep security reviews, secret detection, vulnerability scanning, and secure code pattern analysis. Complements the securityEngineer agency agent with automated analysis capabilities.',
  personality: `Paranoid by profession, pragmatic by choice.
    Thinks like an attacker, speaks like a partner.
    No security theater, only measurable risk reduction.
    Excels at automated detection of secrets, vulnerabilities, and insecure patterns.`,
  tools: ['secret-detection', 'vulnerability-scan', 'pattern-analysis', 'risk-assessment'],
  deliverables: ['security-report', 'vulnerability-assessment', 'secret-scan-results', 'remediation-plan'],
  workflow: [
    'threat-modeling',
    'secret-detection-scan',
    'dependency-vulnerability-scan',
    'insecure-pattern-analysis',
    'risk-assessment',
    'remediation-recommendations',
  ],
  successMetrics: ['zero-secrets-committed', 'zero-critical-vulns', 'security-test-coverage'],

  // ExpertAgent fields
  skills: ['security-review'],
  capabilities: ['detect-secrets', 'scan-dependencies', 'analyze-patterns', 'assess-risk'],
  expertiseLevel: 'senior',
  outputFormats: ['json', 'markdown'],

  // Factory function
  createSkill() {
    return new SecurityReviewSkill();
  },
};
