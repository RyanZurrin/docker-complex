const keys = require("./keys");

// Express App Setup
const express = require("express");
const bodyParser = require("body-parser");
const cors = require("cors");

const app = express(); // app is an object that receives and responds to http requests
app.use(cors()); // cross origin resource sharing
app.use(bodyParser.json()); // parse incoming requests from react app and turn the body of the post request into json value

// Postgres Client Setup
const { Pool } = require("pg"); // pg is a postgres library that allows us to connect to postgres and issue queries
const pgClient = new Pool({
  // pgClient is an object that connects to postgres and allows us to issue queries
  user: keys.pgUser,
  host: keys.pgHost,
  database: keys.pgDatabase,
  password: keys.pgPassword,
  port: keys.pgPort,
});

pgClient.on("connect", (client) => {
  pgClient
    .query("CREATE TABLE IF NOT EXISTS values (number INT)")
    .catch((err) => console.log(err));
});

// Redis Client Setup
const redis = require("redis");
const redisClient = redis.createClient({
  // redisClient is an object that connects to redis and allows us to issue queries
  host: keys.redisHost,
  port: keys.redisPort,
  retry_strategy: () => 1000, // if we lose connection to redis, try to reconnect once every 1000 ms
});

const redisPublisher = redisClient.duplicate(); // duplicate redis client so that we can have two clients listening/publishing to redis

// Express route handlers

app.get("/", (req, res) => {
  res.send("Hi");
});

app.get("/values/all", async (req, res) => {
  const values = await pgClient.query("SELECT * from values");
  res.send(values.rows);
});

app.get("/values/current", async (req, res) => {
  redisClient.hgetall("values", (err, values) => {
    res.send(values);
  });
});

app.post("/values", async (req, res) => {
  const index = req.body.index;

  if (parseInt(index) > 40) {
    return res.status(422).send("Index too high");
  }

  redisClient.hset("values", index, "Nothing yet!");
  redisPublisher.publish("insert", index);
  pgClient.query("INSERT INTO values(number) VALUES($1)", [index]);

  res.send({ working: true });
});

app.listen(5000, (err) => {
  console.log("Listening");
});
