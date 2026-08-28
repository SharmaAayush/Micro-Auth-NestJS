import { DataSource } from 'typeorm';
import { config } from 'dotenv';

// Load .env file variables manually for the CLI context
config();

export default new DataSource({
  type: 'postgres',
  // Use environment variables for database connection settings
  host: process.env.DB_HOST || 'localhost',
  port: parseInt(process.env.DB_PORT || '5432', 10),
  username: process.env.DB_USERNAME || '',
  password: process.env.DB_PASSWORD || '',
  database: process.env.DB_DATABASE || '',
  synchronize: process.env.DB_SYNCHRONIZE === 'true' ? true : false,
  logging: process.env.DB_LOGGING === 'true' ? true : false,

  // Look for compiled JS in dist/ and TS source files in src/
  entities: [__dirname + '/../**/*.entity{.ts,.js}'],
  // Keep migration source files strictly in TS format inside src/
  migrations: [__dirname + '/migrations/*.ts'],
});
