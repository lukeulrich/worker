"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const fs_1 = require("./fs");
async function installSchema(client) {
    await client.query(`
    create extension if not exists pgcrypto with schema public;
    create extension if not exists "uuid-ossp" with schema public;
    create schema graphile_worker;
    create table graphile_worker.migrations(
      id int primary key,
      ts timestamptz default now() not null
    );
  `);
}
async function runMigration(client, migrationFile, migrationNumber) {
    const text = await fs_1.readFile(`${__dirname}/../sql/${migrationFile}`, "utf8");
    await client.query({
        text,
    });
    await client.query({
        text: `insert into graphile_worker.migrations (id) values ($1)`,
        values: [migrationNumber],
    });
}
async function migrate(client) {
    let latestMigration = null;
    try {
        const { rows: [row], } = await client.query("select id from graphile_worker.migrations order by id desc limit 1;");
        if (row) {
            latestMigration = row.id;
        }
    }
    catch (e) {
        if (e.code === "42P01") {
            await installSchema(client);
        }
        else {
            throw e;
        }
    }
    const migrationFiles = (await fs_1.readdir(`${__dirname}/../sql`))
        .filter(f => f.match(/^[0-9]{6}\.sql$/))
        .sort();
    for (const migrationFile of migrationFiles) {
        const migrationNumber = parseInt(migrationFile.substr(0, 6), 10);
        if (latestMigration == null || migrationNumber > latestMigration) {
            await runMigration(client, migrationFile, migrationNumber);
        }
    }
}
exports.migrate = migrate;
//# sourceMappingURL=migrate.js.map