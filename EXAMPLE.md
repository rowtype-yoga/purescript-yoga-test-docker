# Example: Adding Docker-Managed Tests to a New Package

This guide shows how to add integration tests with automatic Docker management to a new package.

## Step-by-Step

### 1. Create Docker Compose File

Create `docker-compose.test.yml` in your package directory:

```yaml
# packages/my-package/docker-compose.test.yml
version: '3.8'

services:
  myservice-test:
    image: myimage:latest
    ports:
      - "12345:12345"
    environment:
      MY_VAR: test_value
    healthcheck:
      test: ["CMD", "my-health-check-command"]
      interval: 2s
      timeout: 3s
      retries: 10
    restart: unless-stopped
```

**Important**: 
- Use unique ports to avoid conflicts
- Define a proper health check
- Use `-test` suffix for service names

### 2. Add Test Dependencies

In `packages/my-package/spago.yaml`:

```yaml
package:
  name: my-package
  dependencies:
    - aff
    - effect
    - prelude
  # ... other config ...
  
  test:
    main: Test.MyPackage.Main
    dependencies:
      - spec
      - yoga-test-docker    # Add this!
      - console
      - exceptions
```

### 3. Create Test Suite

Create `packages/my-package/test/Main.purs`:

```purescript
module Test.MyPackage.Main where

import Prelude

import Effect (Effect)
import Effect.Aff (Aff, bracket, launchAff_)
import Effect.Class (liftEffect)
import Effect.Console (log)
import Test.Spec (Spec, describe, it)
import Test.Spec.Assertions (shouldEqual)
import Test.Spec.Reporter.Console (consoleReporter)
import Test.Spec.Runner (runSpec)
import Yoga.Test.Docker as Docker
import MyPackage as MyPkg  -- Your package

-- Test specs
spec :: Spec Unit
spec = do
  describe "MyPackage Integration Tests" do
    
    it "connects to service" do
      -- Your test code here
      client <- liftEffect $ MyPkg.createClient { host: "localhost", port: 12345 }
      result <- MyPkg.ping client
      result `shouldEqual` "PONG"
    
    it "performs operation" do
      -- More tests...
      pure unit

-- Main entry point with Docker management
main :: Effect Unit
main = launchAff_ do
  liftEffect $ log "\n🧪 Starting MyPackage Integration Tests (with Docker)\n"
  
  bracket
    -- Start Docker before tests
    ( do
        liftEffect $ log "⏳ Starting service and waiting for it to be ready..."
        Docker.startService "packages/my-package/docker-compose.test.yml" 30
        liftEffect $ log "✅ Service is ready!\n"
    )
    -- Stop Docker after tests (always runs!)
    ( \_ -> do
        Docker.stopService "packages/my-package/docker-compose.test.yml"
        liftEffect $ log "✅ Cleanup complete\n"
    )
    -- Run tests
    (\_ -> runSpec [ consoleReporter ] spec)
```

### 4. Run Tests

```bash
# From package directory
cd packages/my-package
spago test

# Or from workspace root
bun run test:my-package
```

That's it! Docker starts automatically, waits for healthy, runs tests, and stops Docker.

---

## Advanced: Connection Helpers

For cleaner tests, create connection helpers:

```purescript
-- Helper to create and manage client connection
withClient :: (MyPkg.Client -> Aff Unit) -> Aff Unit
withClient test = do
  client <- liftEffect $ MyPkg.createClient 
    { host: "localhost"
    , port: 12345
    }
  MyPkg.connect client
  test client
  MyPkg.disconnect client

-- Use with `around` for automatic connection management
spec :: Spec Unit
spec = do
  around withClient do
    describe "MyPackage Operations" do
      it "performs operation" \client -> do
        result <- MyPkg.someOperation client
        result `shouldEqual` expected
```

---

## Tips

### 1. Test Port Selection

Use non-standard ports to avoid conflicts:
- Standard ports: 6379 (Redis), 5432 (Postgres), 9042 (Cassandra)
- Test ports: 6380, 5433, 9043

### 2. Wait Times

Choose appropriate wait times based on service startup:
- Fast services (Redis): 10-30 seconds
- Databases (Postgres): 30 seconds
- Heavy services (ScyllaDB): 60 seconds

### 3. Health Checks

Ensure your health check actually verifies the service is ready:

```yaml
healthcheck:
  # Good: Checks actual functionality
  test: ["CMD", "redis-cli", "ping"]
  
  # Bad: Only checks process exists
  test: ["CMD-SHELL", "pgrep redis"]
```

### 4. Cleanup

The `bracket` pattern guarantees cleanup even if:
- Tests fail
- An exception occurs
- User presses Ctrl+C

Always use `bracket` for resource management!

### 5. Package Scripts

Add convenient scripts to your `package.json`:

```json
{
  "scripts": {
    "test": "spago test"
  }
}
```

Then run with: `bun run test`

---

## Real Examples

See these packages for working examples:
- `packages/yoga-redis/test/Main.purs` - Redis integration tests
- `packages/yoga-postgres/test/Main.purs` - Postgres integration tests
- `packages/yoga-scylladb/test/Main.purs` - ScyllaDB integration tests

---

## Troubleshooting

### Service Won't Start

```
Error: Failed to start Docker: spawn docker ENOENT
```

**Solution**: Ensure Docker Desktop is installed and running.

### Port Already in Use

```
Error: port is already allocated
```

**Solution**: Stop conflicting containers
```bash
cd packages/my-package
docker compose -f docker-compose.test.yml down
```

### Health Check Timeout

```
Error: Service failed to become healthy
```

**Solution**: 
1. Check logs: `docker compose -f docker-compose.test.yml logs`
2. Increase wait time: `Docker.startService "..." 60` (60 seconds)
3. Verify health check command works manually

### Wrong Working Directory

If Docker can't find your compose file, ensure the path is relative to workspace root:

```purescript
-- Correct (from workspace root)
Docker.startService "packages/my-package/docker-compose.test.yml" 30

-- Incorrect (relative to test file)
Docker.startService "../docker-compose.test.yml" 30
```

---

## Summary

To add Docker-managed integration tests:

1. ✅ Create `docker-compose.test.yml` with health check
2. ✅ Add `yoga-test-docker` to test dependencies
3. ✅ Import `Yoga.Test.Docker` in test Main
4. ✅ Use `bracket` with `startService`/`stopService`
5. ✅ Run `spago test`

Simple, clean, automatic! 🚀
