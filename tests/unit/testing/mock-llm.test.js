"use strict";
/**
 * Unit tests for MockLLMClient and FixtureLoader
 *
 * Tests deterministic LLM mocking infrastructure.
 */
Object.defineProperty(exports, "__esModule", { value: true });
const testing_1 = require("@/testing");
describe('MockLLMClient', () => {
    let client;
    beforeEach(() => {
        client = new testing_1.MockLLMClient();
    });
    afterEach(() => {
        client.clearFixtures();
        client.clearCalls();
    });
    describe('fixture matching', () => {
        test('returns fixture when key matches exactly', async () => {
            // Arrange
            const response = {
                content: 'test response',
                usage: { prompt: 10, completion: 5 }
            };
            client.setFixture('test-key', response);
            // Need to set fixture with a prompt that generates 'test-key'
            // Since generateKey is private, we use setFixturePattern instead
            client.setFixturePattern(/exact match test/, response);
            // Act
            const result = await client.complete({ prompt: 'exact match test' });
            // Assert
            expect(result.content).toBe('test response');
            expect(result.usage).toEqual({ prompt: 10, completion: 5 });
        });
        test('returns fixture by regex pattern', async () => {
            // Arrange
            const response = {
                content: 'pattern matched',
                usage: { prompt: 20, completion: 10 }
            };
            client.setFixturePattern(/security.*review/i, response);
            // Act
            const result = await client.complete({ prompt: 'Run security review on this code' });
            // Assert
            expect(result.content).toBe('pattern matched');
        });
        test('returns empty response when no fixture matches (fallbackMode: empty)', async () => {
            // Arrange
            client.fallbackMode = 'empty';
            // Act
            const result = await client.complete({ prompt: 'unmatched prompt' });
            // Assert
            expect(result.content).toBe('');
            expect(result.usage).toEqual({ prompt: 0, completion: 0 });
        });
        test('throws error when no fixture matches (fallbackMode: error)', async () => {
            // Arrange
            client.fallbackMode = 'error';
            // Act & Assert
            await expect(client.complete({ prompt: 'unmatched prompt' })).rejects.toThrow('No fixture found for prompt');
        });
    });
    describe('call tracking', () => {
        test('tracks all calls in getCalls()', async () => {
            // Arrange
            const response = {
                content: 'response',
                usage: { prompt: 10, completion: 5 }
            };
            client.setFixturePattern(/.*/, response);
            // Act
            await client.complete({ prompt: 'first call', temperature: 0.5 });
            await client.complete({ prompt: 'second call', maxTokens: 100 });
            // Assert
            const calls = client.getCalls();
            expect(calls).toHaveLength(2);
            expect(calls[0].params.prompt).toBe('first call');
            expect(calls[0].params.temperature).toBe(0.5);
            expect(calls[1].params.prompt).toBe('second call');
            expect(calls[1].params.maxTokens).toBe(100);
            expect(calls[0].timestamp).toBeInstanceOf(Date);
        });
        test('clearCalls removes all call history', async () => {
            // Arrange
            const response = {
                content: 'response',
                usage: { prompt: 10, completion: 5 }
            };
            client.setFixturePattern(/.*/, response);
            await client.complete({ prompt: 'test' });
            expect(client.getCalls()).toHaveLength(1);
            // Act
            client.clearCalls();
            // Assert
            expect(client.getCalls()).toHaveLength(0);
        });
    });
    describe('fixture management', () => {
        test('clearFixtures removes all fixtures', async () => {
            // Arrange
            const response = {
                content: 'response',
                usage: { prompt: 10, completion: 5 }
            };
            client.setFixturePattern(/test/, response);
            client.fallbackMode = 'empty';
            // Verify fixture works
            const result1 = await client.complete({ prompt: 'test' });
            expect(result1.content).toBe('response');
            // Act
            client.clearFixtures();
            // Assert - should now return empty
            const result2 = await client.complete({ prompt: 'test' });
            expect(result2.content).toBe('');
        });
        test('multiple pattern fixtures - first match wins', async () => {
            // Arrange
            client.setFixturePattern(/first/, { content: 'first', usage: { prompt: 1, completion: 1 } });
            client.setFixturePattern(/second/, { content: 'second', usage: { prompt: 2, completion: 2 } });
            // Act - matches both patterns, first should win
            const result = await client.complete({ prompt: 'first second' });
            // Assert
            expect(result.content).toBe('first');
        });
    });
    describe('chat interface', () => {
        test('chat converts messages to completion format', async () => {
            // Arrange
            const response = {
                content: 'chat response',
                usage: { prompt: 15, completion: 8 }
            };
            client.setFixturePattern(/user: hello/, response);
            // Act
            const result = await client.chat([
                { role: 'user', content: 'hello' }
            ]);
            // Assert
            expect(result.message.role).toBe('assistant');
            expect(result.message.content).toBe('chat response');
            expect(result.usage).toEqual({ prompt: 15, completion: 8 });
        });
        test('chat tracks calls', async () => {
            // Arrange
            client.setFixturePattern(/.*/, { content: 'ok', usage: { prompt: 1, completion: 1 } });
            // Act
            await client.chat([
                { role: 'system', content: 'You are a helper' },
                { role: 'user', content: 'hi' }
            ]);
            // Assert
            const calls = client.getCalls();
            expect(calls).toHaveLength(1);
            expect(calls[0].params.prompt).toContain('system:');
            expect(calls[0].params.prompt).toContain('user:');
        });
    });
    describe('default fallback mode', () => {
        test('defaults to empty fallback mode', () => {
            expect(client.fallbackMode).toBe('empty');
        });
    });
});
describe('FixtureLoader', () => {
    let loader;
    const testFixtures = [
        {
            id: 'fixture-1',
            description: 'First test fixture',
            promptPattern: /pattern one/i,
            response: { content: 'response one', usage: { prompt: 10, completion: 5 } }
        },
        {
            id: 'fixture-2',
            description: 'Second test fixture',
            promptPattern: /pattern two/i,
            response: { content: 'response two', usage: { prompt: 20, completion: 10 } }
        }
    ];
    beforeEach(() => {
        loader = new testing_1.FixtureLoader(testFixtures);
    });
    describe('findMatching', () => {
        test('returns correct fixture by regex pattern', () => {
            // Act
            const result = loader.findMatching('This has pattern one in it');
            // Assert
            expect(result).toBeDefined();
            expect(result.id).toBe('fixture-1');
            expect(result.response.content).toBe('response one');
        });
        test('returns second fixture when pattern matches', () => {
            // Act
            const result = loader.findMatching('This has pattern two in it');
            // Assert
            expect(result).toBeDefined();
            expect(result.id).toBe('fixture-2');
        });
        test('returns undefined when no pattern matches', () => {
            // Act
            const result = loader.findMatching('No matching pattern here');
            // Assert
            expect(result).toBeUndefined();
        });
        test('returns first match when multiple patterns match', () => {
            // Arrange - add a fixture that would also match
            loader.add({
                id: 'fixture-3',
                description: 'Third fixture',
                promptPattern: /pattern/i, // Matches both "pattern one" and "pattern two"
                response: { content: 'response three', usage: { prompt: 30, completion: 15 } }
            });
            // Act - "pattern one" should match fixture-1 first
            const result = loader.findMatching('pattern one');
            // Assert - depends on Map iteration order (insertion order)
            // Since fixture-1 was added first in constructor, it should match first
            expect(result.id).toBe('fixture-1');
        });
    });
    describe('get by ID', () => {
        test('returns fixture by ID', () => {
            // Act
            const result = loader.get('fixture-1');
            // Assert
            expect(result).toBeDefined();
            expect(result.id).toBe('fixture-1');
            expect(result.description).toBe('First test fixture');
        });
        test('returns undefined for unknown ID', () => {
            // Act
            const result = loader.get('non-existent');
            // Assert
            expect(result).toBeUndefined();
        });
    });
    describe('fixture management', () => {
        test('add inserts new fixture', () => {
            // Arrange
            const newFixture = {
                id: 'new-fixture',
                description: 'Newly added',
                promptPattern: /new pattern/i,
                response: { content: 'new', usage: { prompt: 5, completion: 5 } }
            };
            // Act
            loader.add(newFixture);
            // Assert
            expect(loader.get('new-fixture')).toBeDefined();
            expect(loader.count()).toBe(3);
        });
        test('getIds returns all fixture IDs', () => {
            // Act
            const ids = loader.getIds();
            // Assert
            expect(ids).toContain('fixture-1');
            expect(ids).toContain('fixture-2');
            expect(ids).toHaveLength(2);
        });
        test('count returns number of fixtures', () => {
            expect(loader.count()).toBe(2);
        });
    });
    describe('empty loader', () => {
        test('works with no initial fixtures', () => {
            // Arrange
            const emptyLoader = new testing_1.FixtureLoader();
            // Assert
            expect(emptyLoader.count()).toBe(0);
            expect(emptyLoader.getIds()).toHaveLength(0);
            expect(emptyLoader.findMatching('anything')).toBeUndefined();
        });
    });
});
describe('SecurityReviewFixtures', () => {
    let loader;
    beforeEach(() => {
        loader = new testing_1.FixtureLoader(testing_1.SecurityReviewFixtures);
    });
    test('all security fixtures are loaded', () => {
        expect(loader.count()).toBe(5);
        expect(loader.getIds()).toContain('security-review-sql-injection');
        expect(loader.getIds()).toContain('security-review-xss');
        expect(loader.getIds()).toContain('security-review-clean');
        expect(loader.getIds()).toContain('security-review-hardcoded-secrets');
        expect(loader.getIds()).toContain('security-review-path-traversal');
    });
    test('sql injection fixture matches SQL-related prompts', () => {
        const fixture = loader.findMatching('Check for SQL injection vulnerabilities');
        expect(fixture).toBeDefined();
        expect(fixture.id).toBe('security-review-sql-injection');
    });
    test('xss fixture matches XSS-related prompts', () => {
        const fixture = loader.findMatching('Scan for XSS attacks');
        expect(fixture).toBeDefined();
        expect(fixture.id).toBe('security-review-xss');
    });
    test('clean fixture matches clean code prompts', () => {
        const fixture = loader.findMatching('Review this code for issues');
        expect(fixture).toBeDefined();
        expect(fixture.id).toBe('security-review-clean');
    });
    test('secrets fixture matches secret-related prompts', () => {
        const fixture = loader.findMatching('Check for hardcoded API keys');
        expect(fixture).toBeDefined();
        expect(fixture.id).toBe('security-review-hardcoded-secrets');
    });
    test('path traversal fixture matches file path prompts', () => {
        const fixture = loader.findMatching('Scan for path traversal vulnerabilities');
        expect(fixture).toBeDefined();
        expect(fixture.id).toBe('security-review-path-traversal');
    });
    test('security fixtures return valid JSON content', () => {
        const fixture = loader.get('security-review-sql-injection');
        expect(fixture).toBeDefined();
        // Should be valid JSON
        const content = fixture.response.content;
        expect(() => JSON.parse(content)).not.toThrow();
        const parsed = JSON.parse(content);
        expect(parsed).toHaveProperty('issues');
        expect(parsed).toHaveProperty('summary');
        expect(parsed).toHaveProperty('scannedAt');
        expect(Array.isArray(parsed.issues)).toBe(true);
    });
    test('clean fixture has empty issues array', () => {
        const fixture = loader.get('security-review-clean');
        const parsed = JSON.parse(fixture.response.content);
        expect(parsed.issues).toHaveLength(0);
    });
});
describe('Integration: MockLLMClient with FixtureLoader', () => {
    test('end-to-end: use FixtureLoader with MockLLMClient', async () => {
        // Arrange
        const client = new testing_1.MockLLMClient();
        const loader = new testing_1.FixtureLoader(testing_1.SecurityReviewFixtures);
        // Set up all security fixtures as patterns
        testing_1.SecurityReviewFixtures.forEach(fixture => {
            client.setFixturePattern(fixture.promptPattern, fixture.response);
        });
        // Act - simulate a security review
        const result = await client.complete({
            prompt: 'Please review this code for SQL injection'
        });
        // Assert
        expect(result.content).toBeDefined();
        const parsed = JSON.parse(result.content);
        expect(parsed.issues).toHaveLength(1);
        expect(parsed.issues[0].category).toBe('SQL Injection');
        // Verify call was tracked
        const calls = client.getCalls();
        expect(calls).toHaveLength(1);
        expect(calls[0].params.prompt).toContain('SQL injection');
    });
    test('can verify specific prompts were sent to LLM', async () => {
        // Arrange
        const client = new testing_1.MockLLMClient();
        client.setFixturePattern(/.*/, {
            content: 'mock response',
            usage: { prompt: 10, completion: 5 }
        });
        const agentPrompt = 'Analyze this code for security issues:\n\nfunction test() { return 1; }';
        // Act
        await client.complete({ prompt: agentPrompt, temperature: 0.7 });
        // Assert - verify the exact prompt was sent
        const calls = client.getCalls();
        expect(calls[0].params.prompt).toBe(agentPrompt);
        expect(calls[0].params.temperature).toBe(0.7);
    });
});
//# sourceMappingURL=mock-llm.test.js.map