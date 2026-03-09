import { withDb } from "../db/client.js";

async function main() {
    await withDb(async (db) => {
        const res = await db.query("SELECT * FROM pgmigrations ORDER BY run_on DESC LIMIT 20");
        console.log("MIGRATIONS IN DB:");
        console.table(res.rows);
    });
}

main().catch(console.error);
