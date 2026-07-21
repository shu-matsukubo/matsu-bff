import { mkdir, writeFile } from 'node:fs/promises';
import { dirname, resolve } from 'node:path';
import { app, openApiConfig } from '../src/app.js';

const outputPath = resolve(process.cwd(), 'openapi/openapi.json');
const document = app.getOpenAPIDocument(openApiConfig);

await mkdir(dirname(outputPath), { recursive: true });
await writeFile(outputPath, `${JSON.stringify(document, null, 2)}\n`, 'utf8');

console.log(`OpenAPI document generated: ${outputPath}`);
