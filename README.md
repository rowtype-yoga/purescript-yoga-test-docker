# yoga-test-docker

Docker Compose management for PureScript integration tests.

## Overview

This package provides utilities for managing Docker Compose services in integration test suites. It uses FFI to call `docker compose` commands and integrates seamlessly with PureScript's `bracket` pattern for guaranteed cleanup.

## Installation

Add to your test dependencies in `spago.yaml`:

```yaml
test:
  dependencies:
    - yoga-test-docker
```

## Usage

### Basic Example

```purescript
module Test.MyPackage.Main where

import Prelude
import Effect (Effect)
import Effect.Aff (launchAff_, bracket)
import Effect.Class (liftEffect)
import Effect.Console (log)
import Test.Spec.Runner (runSpec)
import Yoga.Test.Docker as Docker

main :: Effect Unit
main = launchAff_ do
  liftEffect $ log "🧪 Starting tests with Docker\n"
  
  bracket
    -- Start Docker before tests
    (do
      liftEffect $ log "⏳ Starting Docker service..."
      Docker.startService "docker-compose.test.yml" 30
      liftEffect $ log "✅ Docker service ready!\n"
    )
    -- Stop Docker after tests (always runs!)
    (\_ -> do
      Docker.stopService "docker-compose.test.yml"
      liftEffect $ log "✅ Cleanup complete\n"
    )
    -- Run tests
    (\_ -> runSpec [ consoleReporter ] spec)
```

### Advanced: Relative Paths

If your `docker-compose.test.yml` is in the package directory:

```purescript
-- From packages/my-package/test/Main.purs
Docker.startService "../docker-compose.test.yml" 30
```

Or specify the full relative path from workspace root:

```purescript
Docker.startService "packages/my-package/docker-compose.test.yml" 30
```

## API

### `startService`

```purescript
startService :: String -> Int -> Aff Unit
```

Start a Docker Compose service and wait for it to be healthy.

**Parameters:**
- `composeFile` - Path to docker-compose.yml file (relative to workspace root)
- `maxWaitSeconds` - Maximum seconds to wait for service to become healthy

**Example:**
```purescript
Docker.startService "docker-compose.test.yml" 30
```

### `stopService`

```purescript
stopService :: String -> Aff Unit
```

Stop a Docker Compose service.

**Parameters:**
- `composeFile` - Path to docker-compose.yml file

**Example:**
```purescript
Docker.stopService "docker-compose.test.yml"
```

### `waitForHealthy`

```purescript
waitForHealthy :: String -> Int -> Aff Unit
```

Wait for a service to become healthy.

**Parameters:**
- `composeFile` - Path to docker-compose.yml file
- `maxAttempts` - Maximum number of 1-second attempts

### Low-Level Functions

```purescript
dockerComposeUp :: String -> Aff Unit
dockerComposeDown :: String -> Aff Unit
isServiceHealthy :: String -> Aff Boolean
```

Direct access to Docker Compose commands if you need custom logic.

## Docker Compose File

Your `docker-compose.test.yml` should include health checks:

```yaml
version: '3.8'

services:
  myservice-test:
    image: redis:7-alpine
    ports:
      - "6380:6379"
    healthcheck:
      test: ["CMD", "redis-cli", "ping"]
      interval: 2s
      timeout: 3s
      retries: 10
```

## Guaranteed Cleanup

The `bracket` pattern ensures Docker services are stopped even if:
- Tests fail
- An exception occurs
- User presses Ctrl+C

This prevents orphaned Docker containers.

## How It Works

1. **FFI Layer**: JavaScript implementation uses Node's `child_process.spawnSync`
2. **Aff Integration**: Functions return `Aff` for composable async operations
3. **Bracket Pattern**: Guarantees cleanup via PureScript's resource management
4. **Health Checks**: Polls `docker compose ps` until service reports healthy

## Troubleshooting

### Docker Not Found

```
Error: spawn docker ENOENT
```

**Solution**: Install Docker Desktop and ensure it's running.

### Port Already in Use

```
Error: port is already allocated
```

**Solution**: Stop conflicting containers
```bash
docker compose -f docker-compose.test.yml down
```

### Service Never Healthy

```
Error: Service failed to become healthy
```

**Solution**: Check logs
```bash
docker compose -f docker-compose.test.yml logs
```

Increase `maxWaitSeconds` for slower services (e.g., ScyllaDB needs 60s).

## Best Practices

1. **Use bracket**: Always use `bracket` for guaranteed cleanup
2. **Health checks**: Define proper health checks in docker-compose.yml
3. **Unique ports**: Use non-standard ports to avoid conflicts (e.g., 6380 instead of 6379)
4. **Test isolation**: Each package should have its own docker-compose.test.yml
5. **Sufficient timeout**: Allow enough time for services to start (30s for most, 60s for databases like ScyllaDB)

## License

MIT
