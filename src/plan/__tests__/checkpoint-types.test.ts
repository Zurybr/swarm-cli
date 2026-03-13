import { describe, it, expect } from '@jest/globals';
import { parsePlan } from '../parser.js';
import type { PlanTask } from '../types.js';

describe('Checkpoint Types', () => {
  it('should parse checkpoint:human-verify task', () => {
    const content = `---
phase: test
plan: checkpoint-test
type: execute
wave: 1
---

<objective>Test checkpoint parsing</objective>

<task type="checkpoint:human-verify" gate="blocking">
  <name>Verify dashboard layout</name>
  <action>Build responsive dashboard</action>
  <what-built>Dashboard at http://localhost:3000</what-built>
  <how-to-verify>
    Visit URL and verify:
    1. Desktop: Sidebar left, content right
    2. Tablet: Sidebar collapses
  </how-to-verify>
  <resume-signal>Type "approved" or describe issues</resume-signal>
  <done>Approved by human</done>
</task>
`;
    const result = parsePlan(content);
    
    expect(result.success).toBe(true);
    expect(result.plan?.tasks).toHaveLength(1);
    
    const task = result.plan!.tasks[0];
    expect(task.type).toBe('checkpoint:human-verify');
    expect(task.checkpointData?.gate).toBe('blocking');
    expect(task.checkpointData?.whatBuilt).toBe('Dashboard at http://localhost:3000');
    expect(task.checkpointData?.howToVerify).toContain('Desktop');
    expect(task.checkpointData?.resumeSignal).toBe('Type "approved" or describe issues');
  });

  it('should parse checkpoint:decision task with options', () => {
    const content = `---
phase: test
plan: decision-test
type: execute
wave: 1
---

<objective>Test decision checkpoint</objective>

<task type="checkpoint:decision">
  <name>Choose auth provider</name>
  <action>Select authentication</action>
  <decision>Which authentication provider to use?</decision>
  <context>The app needs OAuth for Google, GitHub, and email.</context>
  <options>
    <option id="supabase">Supabase Auth - Open source, generous free tier</option>
    <option id="auth0">Auth0 - Enterprise-grade, extensive docs</option>
  </options>
  <resume-signal>Select: supabase or auth0</resume-signal>
  <done>Decision made</done>
</task>
`;
    const result = parsePlan(content);
    
    expect(result.success).toBe(true);
    expect(result.plan?.tasks[0].type).toBe('checkpoint:decision');
    expect(result.plan?.tasks[0].checkpointData?.decision).toBe('Which authentication provider to use?');
    expect(result.plan?.tasks[0].checkpointData?.options).toHaveLength(2);
    expect(result.plan?.tasks[0].checkpointData?.options?.[0].id).toBe('supabase');
    expect(result.plan?.tasks[0].checkpointData?.options?.[1].id).toBe('auth0');
  });

  it('should parse checkpoint:human-action task', () => {
    const content = `---
phase: test
plan: action-test
type: execute
wave: 1
---

<objective>Test human action</objective>

<task type="checkpoint:human-action">
  <name>Create Stripe account</name>
  <action>Setup payments</action>
  <action-required>Create Stripe account and retrieve API keys</action-required>
  <why>Stripe requires human verification for account creation.</why>
  <steps>
    1. Go to https://dashboard.stripe.com/register
    2. Complete account setup
    3. Navigate to Developers > API keys
    4. Copy keys
  </steps>
  <provide-secrets>
    STRIPE_PUBLISHABLE_KEY
    STRIPE_SECRET_KEY
  </provide-secrets>
  <resume-signal>Paste keys and type "done"</resume-signal>
  <done>Secrets provided</done>
</task>
`;
    const result = parsePlan(content);
    
    expect(result.success).toBe(true);
    expect(result.plan?.tasks[0].type).toBe('checkpoint:human-action');
    expect(result.plan?.tasks[0].checkpointData?.actionRequired).toBe('Create Stripe account and retrieve API keys');
    expect(result.plan?.tasks[0].checkpointData?.steps).toHaveLength(4);
    expect(result.plan?.tasks[0].checkpointData?.why).toBe('Stripe requires human verification for account creation.');
    expect(result.plan?.tasks[0].checkpointData?.provideSecrets).toHaveProperty('STRIPE_PUBLISHABLE_KEY');
    expect(result.plan?.tasks[0].checkpointData?.provideSecrets).toHaveProperty('STRIPE_SECRET_KEY');
  });

  it('should parse regular auto task without checkpoint data', () => {
    const content = `---
phase: test
plan: regular-test
type: execute
wave: 1
---

<objective>Test regular task</objective>

<task type="auto">
  <name>Build feature</name>
  <action>Build a feature</action>
  <done>Feature built</done>
</task>
`;
    const result = parsePlan(content);
    
    expect(result.success).toBe(true);
    expect(result.plan?.tasks[0].type).toBe('auto');
    expect(result.plan?.tasks[0].checkpointData).toBeUndefined();
  });
});
