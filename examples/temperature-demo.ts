import {
  TemperatureManager,
  calculateTemperature,
  detectWorkflowPhase,
  TEMPERATURE_PROFILES,
} from '../src/utils/temperature';

/**
 * Example: Dynamic temperature adjustment
 */

async function temperatureExample() {
  console.log('=== Dynamic Temperature Example ===\n');

  // Example 1: Detect workflow phase
  console.log('Example 1: Phase detection');
  const prompts = [
    { text: 'Implement a function to calculate fibonacci', expected: 'factual' },
    { text: 'Design a creative logo for a coffee shop', expected: 'creative' },
    { text: 'Analyze the performance implications of this code', expected: 'reasoning' },
  ];

  for (const p of prompts) {
    const phase = detectWorkflowPhase(p.text);
    console.log(`  "${p.text.substring(0, 40)}..." → ${phase} (expected: ${p.expected})`);
  }

  // Example 2: Calculate temperature
  console.log('\nExample 2: Temperature calculation');
  const manager = new TemperatureManager({
    enabled: true,
    profile: TEMPERATURE_PROFILES.balanced,
  });

  const tasks = [
    { prompt: 'Write a Python function', type: 'code' },
    { prompt: 'Create a brand identity', type: 'creative' },
    { prompt: 'Explain the trade-offs', type: 'analysis' },
  ];

  for (const task of tasks) {
    const temp = manager.getTemperature(task.prompt, task.type);
    console.log(`  ${task.type}: temp=${temp.toFixed(2)}`);
  }

  // Example 3: Override temperature
  console.log('\nExample 3: Temperature override');
  const overrideTemp = calculateTemperature(
    {
      enabled: true,
      profile: TEMPERATURE_PROFILES.coding,
      override: 0.5,
    },
    'Write code'
  );
  console.log(`  Override temp: ${overrideTemp} (should be 0.5)`);

  // Example 4: Temperature history
  console.log('\nExample 4: Temperature history');
  console.log(`  Average temp (last 10): ${manager.getAverageTemperature(10).toFixed(2)}`);
  console.log(`  History entries: ${manager.getHistory().length}`);
}

temperatureExample().catch(console.error);
