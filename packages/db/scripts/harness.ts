// Shared runner for one-off data scripts (e.g. seeding default rows). Each
// script calls runScript(...) with its own async function; the harness
// takes care of consistent logging and a non-zero exit code on failure, so
// a script can just focus on what it inserts.
export async function runScript(
  name: string,
  script: () => Promise<void>,
): Promise<void> {
  console.log(`Running ${name}...`);

  try {
    await script();
    console.log(`Done: ${name}`);
  } catch (error) {
    console.error(`Failed: ${name}`);
    console.error(error);
    process.exitCode = 1;
  }
}
