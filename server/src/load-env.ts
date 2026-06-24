import { config } from 'dotenv';

config({
  path: ['.env', 'db.env'],
  override: false,
});
