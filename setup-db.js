const { Client } = require('pg');

async function createDb() {
  // Pilihan password umum Laragon
  const passwords = ['postgres', 'root', ''];
  
  for (const password of passwords) {
    console.log(`Mencoba password: '${password}'...`);
    const client = new Client({
      user: 'postgres',
      host: 'localhost',
      database: 'postgres',
      password: password,
      port: 5432,
    });

    try {
      await client.connect();
      console.log('✅ Berhasil connect ke PostgreSQL!');
      
      // Cek apakah database sudah ada
      const res = await client.query("SELECT 1 FROM pg_database WHERE datname = 'peta_galau'");
      if (res.rowCount === 0) {
        console.log("Database 'peta_galau' belum ada. Membuat database...");
        await client.query('CREATE DATABASE peta_galau');
        console.log("✅ Database 'peta_galau' berhasil dibuat.");
      } else {
        console.log("ℹ️ Database 'peta_galau' sudah ada.");
      }
      
      console.log(`\n!!! PASSWORD_FOUND:${password}`);
      await client.end();
      return;
    } catch (err) {
      // 28P01 is Auth failed error code
      if (err.code === '28P01') { 
        console.log('❌ Password salah.');
      } else {
        console.error('❌ Error lain:', err.message);
      }
      await client.end();
    }
  }
  console.log('\n❌ Gagal connect dengan password umum. Mohon cek password PostgreSQL kamu.');
}

createDb();
