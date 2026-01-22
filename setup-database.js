/**
 * Database setup script for ScriptPal
 * This script creates the database and tables if they don't exist
 */

import mysql from 'mysql2/promise';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

// Use DATABASE_URL or fallback to individual config
const DATABASE_URL = process.env.DATABASE_URL || 'mysql://root@localhost:3306/scriptpal';

// Parse DATABASE_URL
const url = new URL(DATABASE_URL);
const DB_CONFIG = {
    host: url.hostname,
    port: parseInt(url.port) || 3306,
    user: url.username,
    password: url.password,
    multipleStatements: true
};

const DB_NAME = url.pathname.slice(1); // Remove leading slash

async function setupDatabase() {
    let connection;
    
    try {
        console.log('Connecting to MySQL...');
        connection = await mysql.createConnection(DB_CONFIG);
        
        // Create database if it doesn't exist
        console.log(`Creating database '${DB_NAME}' if it doesn't exist...`);
        await connection.query(`CREATE DATABASE IF NOT EXISTS \`${DB_NAME}\``);
        
        // Use the database
        await connection.query(`USE \`${DB_NAME}\``);
        
        // Read and execute schema
        console.log('Reading schema file...');
        const schemaPath = path.join(process.cwd(), 'server', 'schema.sql');
        const schema = fs.readFileSync(schemaPath, 'utf8');
        
        console.log('Executing schema...');
        await connection.query(schema);

        // Ensure users table has required auth columns (for existing databases)
        await ensureUserAuthColumns(connection, DB_NAME);
        await ensureScriptAuthorColumn(connection, DB_NAME);
        
        console.log('Database setup completed successfully!');
        
        // Test the connection
        const [rows] = await connection.execute('SHOW TABLES');
        console.log('Tables created:', rows.map(row => Object.values(row)[0]));
        
    } catch (error) {
        console.error('Database setup failed:', error.message);
        throw error;
    } finally {
        if (connection) {
            await connection.end();
        }
    }
}

async function ensureUserAuthColumns(connection, databaseName) {
    const [columns] = await connection.query(
        `SELECT COLUMN_NAME FROM INFORMATION_SCHEMA.COLUMNS 
         WHERE TABLE_SCHEMA = ? AND TABLE_NAME = 'users'`,
        [databaseName]
    );

    const columnNames = new Set(columns.map((column) => column.COLUMN_NAME));
    const missing = [];

    if (!columnNames.has('password_hash')) {
        missing.push("ADD COLUMN password_hash VARCHAR(128) NOT NULL");
    }
    if (!columnNames.has('password_salt')) {
        missing.push("ADD COLUMN password_salt VARCHAR(32) NOT NULL");
    }

    if (missing.length) {
        console.log('Updating users table to add auth columns...');
        await connection.query(`ALTER TABLE users ${missing.join(', ')}`);
    }
}

async function ensureScriptAuthorColumn(connection, databaseName) {
    const [columns] = await connection.query(
        `SELECT COLUMN_NAME FROM INFORMATION_SCHEMA.COLUMNS 
         WHERE TABLE_SCHEMA = ? AND TABLE_NAME = 'scripts'`,
        [databaseName]
    );

    const columnNames = new Set(columns.map((column) => column.COLUMN_NAME));
    if (!columnNames.has('author')) {
        console.log('Updating scripts table to add author column...');
        await connection.query('ALTER TABLE scripts ADD COLUMN author VARCHAR(255) DEFAULT NULL AFTER title');
    }
}

// Run setup if this script is executed directly
const currentFilePath = fileURLToPath(import.meta.url);
if (currentFilePath === path.resolve(process.argv[1])) {
    setupDatabase()
        .then(() => {
            console.log('Setup completed successfully!');
            process.exit(0);
        })
        .catch((error) => {
            console.error('Setup failed:', error);
            process.exit(1);
        });
}

export { setupDatabase };
