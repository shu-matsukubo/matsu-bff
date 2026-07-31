export interface RuntimeDependencies {
  fetch: typeof globalThis.fetch;
  now: () => number;
}

const defaults: RuntimeDependencies = {
  fetch: globalThis.fetch.bind(globalThis),
  now: Date.now,
};

let dependencies: RuntimeDependencies = defaults;

export const runtime = {
  fetch: (...parameters: Parameters<typeof globalThis.fetch>) => dependencies.fetch(...parameters),
  now: (): number => dependencies.now(),
};

export const setRuntimeDependenciesForTests = (
  replacements: Partial<RuntimeDependencies>
): void => {
  dependencies = { ...dependencies, ...replacements };
};

export const resetRuntimeDependenciesForTests = (): void => {
  dependencies = defaults;
};
