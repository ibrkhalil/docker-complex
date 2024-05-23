const keys = require('./keys');

// Express app setup
const express = require('express');
const bodyParser = require('body-parser');
const cors = require('cors');
const MAX_FIB_NUMBER = 40;
const PORT = 5000;

const app = express();
app.use(cors());
app.use(bodyParser.json());

// PG client setup
const { Pool } = require('pg');
const pgClient = new Pool({
    user: keys.pgUser,
    host: keys.pgHost,
    database: keys.pgDatabase,
    password: keys.pgPassword,
    port: keys.pgPort,
    ssl:
    process.env.NODE_ENV !== 'production'
      ? false
      : { rejectUnauthorized: false },
});

pgClient.on("connect", (client) => {
    client
      .query("CREATE TABLE IF NOT EXISTS values (number INT)")
      .catch((err) => console.error(err));
  });

// Redis client setup
const redis = require('redis');

const redisClient = redis.createClient({
    host: keys.redisHost,
    port: keys.redisPort,
    retry_strategy: () => 1000
});

const redisPublisher = redisClient.duplicate(); // Duplicate as redis clients can either listen for changes or publish changes

// Express route handlers
app.get('/', (_req, res) => {
    res.send('Hi')
})

app.get('/values/all', async (_req, res) => {
    const values = await pgClient.query('SELECT * FROM VALUES')
    res.send(values.rows)
})

app.get('/values/current', async (_req, res) => {
    redisClient.hgetall('values', (err, values) => {
        res.send(values);
    })
})

app.post('/values', async (req, res) => {
    const index = req.body.index
    const intIndex = parseInt(index);
    if (intIndex > MAX_FIB_NUMBER) return res.status(422).send('Index too high!')

    redisClient.hset('values', index, 'Nothing yet!');
    redisPublisher.publish('insert', index);
    pgClient.query('INSERT INTO values(number) VALUSE($1)', [index]);

    res.send({working: true});
});

app.listen(PORT, err => {
    console.log(`Listening on port ${PORT}`)
})
