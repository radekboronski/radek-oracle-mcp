import { readFileSync, existsSync } from 'fs';
import { join } from 'path';
import type { DbConfig } from './types.js';

export function loadConfig(): DbConfig {
  const configPath = join(process.cwd(), 'db.config.json');

  if (!existsSync(configPath)) {
    console.error(
      'ERROR: db.config.json not found.\n' +
      'Copy db.config.example.json to db.config.json and fill in your credentials.'
    );
    process.exit(1);
  }

  let raw: string;
  try {
    raw = readFileSync(configPath, 'utf8');
  } catch (e) {
    console.error('ERROR: Cannot read db.config.json:', (e as Error).message);
    process.exit(1);
  }

  let config: DbConfig;
  try {
    config = JSON.parse(raw) as DbConfig;
  } catch (e) {
    console.error('ERROR: db.config.json is not valid JSON:', (e as Error).message);
    process.exit(1);
  }

  if (!config.auth?.secret) {
    console.error('ERROR: db.config.json missing auth.secret');
    process.exit(1);
  }

  return config;
}
