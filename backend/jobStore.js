const { MongoClient } = require("mongodb");

const DEFAULT_DB_NAME = "email_outreach";
const COLLECTION_NAME = "jobs";
const memoryJobs = new Map();

let clientPromise = null;
let dbPromise = null;
let mode = process.env.MONGODB_URI ? "mongo" : "memory";

async function connectMongo() {
  if (!process.env.MONGODB_URI) {
    mode = "memory";
    return null;
  }

  if (!clientPromise) {
    const client = new MongoClient(process.env.MONGODB_URI);
    clientPromise = client.connect();
  }

  if (!dbPromise) {
    dbPromise = clientPromise.then(async (client) => {
      const database = client.db(process.env.MONGODB_DB_NAME || DEFAULT_DB_NAME);
      const collection = database.collection(COLLECTION_NAME);
      await collection.createIndex({ id: 1 }, { unique: true });
      await collection.createIndex({ status: 1, nextRunAt: 1, scheduledAt: 1 });
      mode = "mongo";
      return collection;
    }).catch((error) => {
      clientPromise = null;
      dbPromise = null;
      mode = "memory";
      throw error;
    });
  }

  return dbPromise;
}

async function initJobStore() {
  try {
    await connectMongo();
  } catch (error) {
    console.warn("MongoDB connection failed. Falling back to in-memory store.", error instanceof Error ? error.message : error);
  }

  return { mode };
}

function clone(job) {
  return JSON.parse(JSON.stringify(job));
}

async function insertJob(job) {
  const payload = clone(job);
  const collection = await connectMongo().catch(() => null);
  if (!collection) {
    memoryJobs.set(payload.id, payload);
    return payload;
  }

  await collection.insertOne(payload);
  return payload;
}

async function updateJob(jobId, updates) {
  const collection = await connectMongo().catch(() => null);
  if (!collection) {
    const existing = memoryJobs.get(jobId);
    if (!existing) {
      return null;
    }

    const next = { ...existing, ...clone(updates) };
    memoryJobs.set(jobId, next);
    return next;
  }

  await collection.updateOne({ id: jobId }, { $set: clone(updates) });
  return collection.findOne({ id: jobId }, { projection: { _id: 0 } });
}

async function getJob(jobId) {
  const collection = await connectMongo().catch(() => null);
  if (!collection) {
    return clone(memoryJobs.get(jobId) || null);
  }

  return collection.findOne({ id: jobId }, { projection: { _id: 0 } });
}

async function listJobs() {
  const collection = await connectMongo().catch(() => null);
  if (!collection) {
    return Array.from(memoryJobs.values())
      .map((job) => clone(job))
      .sort((left, right) => new Date(right.createdAt).getTime() - new Date(left.createdAt).getTime());
  }

  return collection
    .find({}, { projection: { _id: 0 } })
    .sort({ createdAt: -1 })
    .toArray();
}

async function listRunnableJobs() {
  const collection = await connectMongo().catch(() => null);
  if (!collection) {
    return Array.from(memoryJobs.values())
      .filter((job) => ["scheduled", "running"].includes(job.status))
      .map((job) => clone(job));
  }

  return collection
    .find(
      { status: { $in: ["scheduled", "running"] } },
      { projection: { _id: 0 } }
    )
    .toArray();
}

function getStoreMode() {
  return mode;
}

module.exports = {
  initJobStore,
  insertJob,
  updateJob,
  getJob,
  listJobs,
  listRunnableJobs,
  getStoreMode,
};
