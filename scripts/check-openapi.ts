import { readFile } from 'node:fs/promises';
import { isDeepStrictEqual } from 'node:util';
import { resolve } from 'node:path';
import { app, openApiConfig } from '../src/app.js';

const artifactPath = resolve(process.cwd(), 'openapi/openapi.json');
const expected: unknown = app.getOpenAPIDocument(openApiConfig);
const actual: unknown = JSON.parse(await readFile(artifactPath, 'utf8'));

if (!isDeepStrictEqual(actual, expected)) {
  console.error('OpenAPI artifact is stale. Run npm run openapi:generate.');
  process.exitCode = 1;
} else {
  console.log(`OpenAPI artifact is current: ${artifactPath}`);
}
