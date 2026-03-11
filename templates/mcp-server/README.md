# {{name}}

{{description}}

## Installation

```bash
npm install
npm run build
```

## Usage

```bash
npm start
```

## Development

```bash
npm run dev
```

## Testing

```bash
npm test
```

## Tools

This server provides the following tools:

- `greet` - Greet someone by name

## Configuration

Add to your Swarm CLI config (`~/.config/swarm-cli/config.yaml`):

```yaml
mcp:
  servers:
    {{name}}:
      command: node
      args: ["/path/to/{{name}}/dist/index.js"]
```

## License

MIT
