/**
 * Expert Definitions Tests
 *
 * Tests for ExpertAgent interface and three expert definitions
 * (security, performance, documentation)
 */

import { AgencyAgent } from '../../../../src/agents/definitions/agency-agents';
import {
  ExpertAgent,
  ExpertDefinition,
  isExpertAgent,
  hasCapability,
} from '../../../../src/skills/expert-definitions/expert-agent';
import { securityExpert } from '../../../../src/skills/expert-definitions/security/definition';
import { performanceExpert } from '../../../../src/skills/expert-definitions/performance/definition';
import { documentationExpert } from '../../../../src/skills/expert-definitions/documentation/definition';

describe('ExpertAgent Interface', () => {
  it('should extend AgencyAgent with required fields', () => {
    const expert: ExpertAgent = {
      // AgencyAgent fields
      id: 'test-expert',
      name: 'Test Expert',
      division: 'Engineering',
      role: 'expert',
      description: 'A test expert',
      personality: 'Test personality',
      tools: ['tool1', 'tool2'],
      deliverables: ['output1'],
      workflow: ['step1'],
      successMetrics: ['metric1'],
      // ExpertAgent fields
      skills: ['skill1', 'skill2'],
      capabilities: ['capability1'],
      expertiseLevel: 'senior',
      outputFormats: ['json', 'markdown'],
    };

    expect(expert.id).toBe('test-expert');
    expect(expert.name).toBe('Test Expert');
    expect(expert.skills).toEqual(['skill1', 'skill2']);
    expect(expert.capabilities).toEqual(['capability1']);
    expect(expert.expertiseLevel).toBe('senior');
    expect(expert.outputFormats).toEqual(['json', 'markdown']);
  });

  it('should have skills array of skill names', () => {
    const expert: ExpertAgent = {
      id: 'test',
      name: 'Test',
      division: 'Test',
      role: 'test',
      description: 'Test',
      personality: 'Test',
      tools: [],
      deliverables: [],
      workflow: [],
      successMetrics: [],
      skills: ['security-review', 'performance-analysis'],
      capabilities: [],
      expertiseLevel: 'mid',
      outputFormats: ['json'],
    };

    expect(Array.isArray(expert.skills)).toBe(true);
    expect(expert.skills.length).toBe(2);
  });

  it('should have capabilities array with high-level descriptions', () => {
    const expert: ExpertAgent = {
      id: 'test',
      name: 'Test',
      division: 'Test',
      role: 'test',
      description: 'Test',
      personality: 'Test',
      tools: [],
      deliverables: [],
      workflow: [],
      successMetrics: [],
      skills: [],
      capabilities: ['detect-secrets', 'scan-vulnerabilities', 'analyze-patterns'],
      expertiseLevel: 'senior',
      outputFormats: ['json'],
    };

    expect(Array.isArray(expert.capabilities)).toBe(true);
    expect(expert.capabilities).toContain('detect-secrets');
  });

  it('should have expertiseLevel as junior, mid, or senior', () => {
    const junior: ExpertAgent = {
      id: 'test',
      name: 'Test',
      division: 'Test',
      role: 'test',
      description: 'Test',
      personality: 'Test',
      tools: [],
      deliverables: [],
      workflow: [],
      successMetrics: [],
      skills: [],
      capabilities: [],
      expertiseLevel: 'junior',
      outputFormats: ['json'],
    };

    const mid: ExpertAgent = {
      ...junior,
      expertiseLevel: 'mid',
    };

    const senior: ExpertAgent = {
      ...junior,
      expertiseLevel: 'senior',
    };

    expect(junior.expertiseLevel).toBe('junior');
    expect(mid.expertiseLevel).toBe('mid');
    expect(senior.expertiseLevel).toBe('senior');
  });

  it('should have outputFormats array with json and/or markdown', () => {
    const expert: ExpertAgent = {
      id: 'test',
      name: 'Test',
      division: 'Test',
      role: 'test',
      description: 'Test',
      personality: 'Test',
      tools: [],
      deliverables: [],
      workflow: [],
      successMetrics: [],
      skills: [],
      capabilities: [],
      expertiseLevel: 'senior',
      outputFormats: ['json', 'markdown'],
    };

    expect(expert.outputFormats).toContain('json');
    expect(expert.outputFormats).toContain('markdown');
  });

  it('ExpertDefinition should combine ExpertAgent with skill factory', () => {
    const definition: ExpertDefinition = {
      id: 'test-expert',
      name: 'Test Expert',
      division: 'Engineering',
      role: 'expert',
      description: 'A test expert',
      personality: 'Test personality',
      tools: ['tool1'],
      deliverables: ['output1'],
      workflow: ['step1'],
      successMetrics: ['metric1'],
      skills: ['test-skill'],
      capabilities: ['test-capability'],
      expertiseLevel: 'senior',
      outputFormats: ['json', 'markdown'],
      createSkill: () => ({ id: 'test-skill' } as any),
    };

    expect(definition.createSkill).toBeDefined();
    expect(typeof definition.createSkill).toBe('function');
  });
});

describe('isExpertAgent type guard', () => {
  it('should return true for valid ExpertAgent', () => {
    const expert = {
      id: 'test',
      name: 'Test',
      division: 'Test',
      role: 'test',
      description: 'Test',
      personality: 'Test',
      tools: [],
      deliverables: [],
      workflow: [],
      successMetrics: [],
      skills: [],
      capabilities: [],
      expertiseLevel: 'senior',
      outputFormats: ['json'],
    };

    expect(isExpertAgent(expert)).toBe(true);
  });

  it('should return false for non-ExpertAgent objects', () => {
    expect(isExpertAgent(null)).toBe(false);
    expect(isExpertAgent(undefined)).toBe(false);
    expect(isExpertAgent({})).toBe(false);
    expect(isExpertAgent({ id: 'test' })).toBe(false);
  });

  it('should return false for AgencyAgent without ExpertAgent fields', () => {
    const agencyAgent: AgencyAgent = {
      id: 'test',
      name: 'Test',
      division: 'Test',
      role: 'test',
      description: 'Test',
      personality: 'Test',
      tools: [],
      deliverables: [],
      workflow: [],
      successMetrics: [],
    };

    expect(isExpertAgent(agencyAgent)).toBe(false);
  });
});

describe('hasCapability type guard', () => {
  it('should return true when expert has capability', () => {
    const expert: ExpertAgent = {
      id: 'test',
      name: 'Test',
      division: 'Test',
      role: 'test',
      description: 'Test',
      personality: 'Test',
      tools: [],
      deliverables: [],
      workflow: [],
      successMetrics: [],
      skills: [],
      capabilities: ['detect-secrets', 'scan-vulnerabilities'],
      expertiseLevel: 'senior',
      outputFormats: ['json'],
    };

    expect(hasCapability(expert, 'detect-secrets')).toBe(true);
    expect(hasCapability(expert, 'scan-vulnerabilities')).toBe(true);
  });

  it('should return false when expert does not have capability', () => {
    const expert: ExpertAgent = {
      id: 'test',
      name: 'Test',
      division: 'Test',
      role: 'test',
      description: 'Test',
      personality: 'Test',
      tools: [],
      deliverables: [],
      workflow: [],
      successMetrics: [],
      skills: [],
      capabilities: ['detect-secrets'],
      expertiseLevel: 'senior',
      outputFormats: ['json'],
    };

    expect(hasCapability(expert, 'scan-vulnerabilities')).toBe(false);
  });
});

describe('securityExpert definition', () => {
  it('should have correct id and division', () => {
    expect(securityExpert.id).toBe('security-expert');
    expect(securityExpert.division).toBe('Security');
    expect(securityExpert.expertiseLevel).toBe('senior');
  });

  it('should have security-review skill', () => {
    expect(securityExpert.skills).toContain('security-review');
  });

  it('should have security capabilities', () => {
    expect(securityExpert.capabilities).toContain('detect-secrets');
    expect(securityExpert.capabilities).toContain('scan-dependencies');
    expect(securityExpert.capabilities).toContain('analyze-patterns');
    expect(securityExpert.capabilities).toContain('assess-risk');
  });

  it('should have createSkill factory function', () => {
    expect(typeof securityExpert.createSkill).toBe('function');
  });

  it('should create SecurityReviewSkill instance', () => {
    const skill = securityExpert.createSkill();
    expect(skill).toBeDefined();
    expect(skill.id).toBe('security-review');
  });

  it('should have tools for secret detection and vulnerability scanning', () => {
    expect(securityExpert.tools).toContain('secret-detection');
    expect(securityExpert.tools).toContain('vulnerability-scan');
  });

  it('should support both output formats', () => {
    expect(securityExpert.outputFormats).toContain('json');
    expect(securityExpert.outputFormats).toContain('markdown');
  });
});

describe('performanceExpert definition', () => {
  it('should have correct id and division', () => {
    expect(performanceExpert.id).toBe('perf-expert');
    expect(performanceExpert.division).toBe('Engineering');
    expect(performanceExpert.expertiseLevel).toBe('senior');
  });

  it('should have performance-expert skill', () => {
    expect(performanceExpert.skills).toContain('performance-expert');
  });

  it('should have performance capabilities', () => {
    expect(performanceExpert.capabilities).toContain('complexity-analysis');
    expect(performanceExpert.capabilities).toContain('bottleneck-detection');
    expect(performanceExpert.capabilities).toContain('optimization-suggestions');
  });

  it('should have createSkill factory function', () => {
    expect(typeof performanceExpert.createSkill).toBe('function');
  });

  it('should create PerformanceExpertSkill instance', () => {
    const skill = performanceExpert.createSkill();
    expect(skill).toBeDefined();
    expect(skill.id).toBe('performance-expert');
  });

  it('should have tools for complexity and bottleneck analysis', () => {
    expect(performanceExpert.tools).toContain('complexity-analysis');
    expect(performanceExpert.tools).toContain('bottleneck-detection');
  });

  it('should support both output formats', () => {
    expect(performanceExpert.outputFormats).toContain('json');
    expect(performanceExpert.outputFormats).toContain('markdown');
  });
});

describe('documentationExpert definition', () => {
  it('should have correct id and division', () => {
    expect(documentationExpert.id).toBe('doc-expert');
    expect(documentationExpert.division).toBe('Documentation');
    expect(documentationExpert.expertiseLevel).toBe('senior');
  });

  it('should have documentation-expert skill', () => {
    expect(documentationExpert.skills).toContain('documentation-expert');
  });

  it('should have documentation capabilities', () => {
    expect(documentationExpert.capabilities).toContain('drift-detection');
    expect(documentationExpert.capabilities).toContain('doc-generation');
    expect(documentationExpert.capabilities).toContain('readme-creation');
  });

  it('should have createSkill factory function', () => {
    expect(typeof documentationExpert.createSkill).toBe('function');
  });

  it('should create DocumentationExpertSkill instance', () => {
    const skill = documentationExpert.createSkill();
    expect(skill).toBeDefined();
    expect(skill.id).toBe('documentation-expert');
  });

  it('should have tools for drift detection and doc generation', () => {
    expect(documentationExpert.tools).toContain('drift-detection');
    expect(documentationExpert.tools).toContain('doc-generation');
  });

  it('should support both output formats', () => {
    expect(documentationExpert.outputFormats).toContain('json');
    expect(documentationExpert.outputFormats).toContain('markdown');
  });
});
