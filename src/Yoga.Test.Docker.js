import { spawn, spawnSync } from "child_process";

const getCompose = () => {
  if (spawnSync("docker", ["compose", "version"], { stdio: "pipe" }).status === 0)
    return ["docker", "compose"];
  if (spawnSync("podman", ["compose", "version"], { stdio: "pipe" }).status === 0)
    return ["podman", "compose"];
  throw new Error("Neither docker compose nor podman compose found");
};

const compose = getCompose();

const runAsync = (args, cwd) =>
  new Promise((resolve, reject) => {
    const [cmd, ...baseArgs] = compose;
    const proc = spawn(cmd, [...baseArgs, ...args], { cwd, stdio: "pipe" });
    let stdout = "";
    let stderr = "";
    proc.stdout.on("data", (d) => { stdout += d; });
    proc.stderr.on("data", (d) => { stderr += d; });
    proc.on("close", (code) => {
      if (code === 0) resolve(stdout);
      else reject(new Error("compose failed (exit " + code + "): " + stderr));
    });
    proc.on("error", reject);
  });

export const dockerComposeUpImpl = (composeFile) => (onError, onSuccess) => {
  const cwd = process.cwd();
  console.log("Starting test service (" + composeFile + ")...");
  runAsync(["-f", composeFile, "up", "-d"], cwd)
    .then(() => onSuccess())
    .catch((e) => onError(e));
  return (cancelError, onCancelerError, onCancelerSuccess) => onCancelerSuccess();
};

export const dockerComposeDownImpl = (composeFile) => (onError, onSuccess) => {
  const cwd = process.cwd();
  console.log("Stopping test service (" + composeFile + ")...");
  runAsync(["-f", composeFile, "down"], cwd)
    .then(() => onSuccess())
    .catch((e) => {
      console.error("Warning: Failed to stop compose service:", e.message);
      onSuccess();
    });
  return (cancelError, onCancelerError, onCancelerSuccess) => onCancelerSuccess();
};

export const isServiceHealthyImpl = (composeFile) => (onError, onSuccess) => {
  const cwd = process.cwd();
  runAsync(["-f", composeFile, "ps", "--format", "json"], cwd)
    .then((output) => {
      const healthy =
        output.includes('"Health":"healthy"') ||
        output.includes('"Health": "healthy"') ||
        output.includes("(healthy)");
      onSuccess(healthy);
    })
    .catch(() => onSuccess(false));
  return (cancelError, onCancelerError, onCancelerSuccess) => onCancelerSuccess();
};
