const mysql=require('mysql2/promise');

const pool=mysql.createPool({
    host: process.env.DB_HOST || 'localhost',
    user: process.env.DB_USER || 'root',
    password: process.env.DB_PASSWORD || '',
    database: process.env.DB_NAME || 'DOQ',
    waitForConnections: true,
    connectionLimit: 10,
    queueLimit: 0
})

// await pool.query('SET SESSION innodb_lock_wait_timeout = 100');

pool.getConnection((err, connection) => {
    if (err) {
        console.error('Error connecting to the database:', err);
        return;
    }
    console.log('Connected to the database');
    connection.release();
});

pool.on('error', (err) => {
    console.error('Database error:', err);
});

pool.on('acquire', (connection) => {
    console.log('Connection %d acquired', connection.threadId);
});

pool.on('release', (connection) => {
    console.log('Connection %d released', connection.threadId);
});

module.exports=pool;