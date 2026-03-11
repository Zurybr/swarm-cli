#!/usr/bin/env node

/**
 * Weather MCP Server Example
 * Demonstrates the MCP SDK for building custom servers
 */

import { MCPServerBuilder, createTool } from '../../mcp/sdk/index.js';
import { z } from 'zod';

// Simulated weather data
const weatherData: Record<string, { temp: number; condition: string; humidity: number }> = {
  'new york': { temp: 72, condition: 'sunny', humidity: 45 },
  'london': { temp: 58, condition: 'cloudy', humidity: 78 },
  'tokyo': { temp: 68, condition: 'rainy', humidity: 82 },
  'sydney': { temp: 82, condition: 'sunny', humidity: 55 },
  'paris': { temp: 64, condition: 'partly cloudy', humidity: 60 },
};

// Create the server
const server = new MCPServerBuilder({
  name: 'weather-server',
  version: '1.0.0',
  description: 'Get weather information for cities around the world',
});

// Tool: Get weather for a city
server.addTool(
  createTool({
    name: 'get_weather',
    description: 'Get current weather for a city',
    parameters: {
      city: z.string().describe('City name'),
      units: z.enum(['celsius', 'fahrenheit']).default('fahrenheit').describe('Temperature units'),
    },
    handler: async ({ city, units }) => {
      const cityLower = city.toLowerCase();
      const weather = weatherData[cityLower];

      if (!weather) {
        return {
          content: [
            {
              type: 'text',
              text: `Weather data not available for "${city}". Available cities: ${Object.keys(weatherData).join(', ')}`,
            },
          ],
          isError: true,
        };
      }

      let temp = weather.temp;
      let unitSymbol = '°F';

      if (units === 'celsius') {
        temp = Math.round((weather.temp - 32) * 5 / 9);
        unitSymbol = '°C';
      }

      return {
        content: [
          {
            type: 'text',
            text: `Weather in ${city}:\n` +
              `  Temperature: ${temp}${unitSymbol}\n` +
              `  Condition: ${weather.condition}\n` +
              `  Humidity: ${weather.humidity}%`,
          },
        ],
      };
    },
  })
);

// Tool: List available cities
server.addTool(
  createTool({
    name: 'list_cities',
    description: 'List all cities with weather data available',
    parameters: {},
    handler: async () => {
      const cities = Object.keys(weatherData).map(c => 
        c.charAt(0).toUpperCase() + c.slice(1)
      );
      return {
        content: [
          {
            type: 'text',
            text: `Cities with weather data:\n${cities.map(c => `  • ${c}`).join('\n')}`,
          },
        ],
      };
    },
  })
);

// Tool: Compare weather between cities
server.addTool(
  createTool({
    name: 'compare_weather',
    description: 'Compare weather between two cities',
    parameters: {
      city1: z.string().describe('First city name'),
      city2: z.string().describe('Second city name'),
    },
    handler: async ({ city1, city2 }) => {
      const w1 = weatherData[city1.toLowerCase()];
      const w2 = weatherData[city2.toLowerCase()];

      if (!w1) {
        return {
          content: [{ type: 'text', text: `Weather data not available for "${city1}"` }],
          isError: true,
        };
      }

      if (!w2) {
        return {
          content: [{ type: 'text', text: `Weather data not available for "${city2}"` }],
          isError: true,
        };
      }

      const tempDiff = w1.temp - w2.temp;
      const warmer = tempDiff > 0 ? city1 : city2;
      const tempDiffAbs = Math.abs(tempDiff);

      return {
        content: [
          {
            type: 'text',
            text: `Weather comparison:\n\n` +
              `${city1}: ${w1.temp}°F, ${w1.condition}, ${w1.humidity}% humidity\n` +
              `${city2}: ${w2.temp}°F, ${w2.condition}, ${w2.humidity}% humidity\n\n` +
              `${warmer} is ${tempDiffAbs}°F warmer`,
          },
        ],
      };
    },
  })
);

// Start the server
console.error('Starting weather MCP server...');
server.start().catch((error) => {
  console.error('Server failed:', error);
  process.exit(1);
});
