import { MongoClient } from 'mongodb';

const uri = process.env.MONGODB_URI;
const defaultDb = process.env.MONGODB_DB || 'ingles';
if (!uri) throw new Error('Falta MONGODB_URI en .env.local');

let client;
let clientPromise;

if (!global._mongoClientPromise) {
    client = new MongoClient(uri);
    global._mongoClientPromise = client.connect();
}
clientPromise = global._mongoClientPromise;

export default clientPromise;

export async function getDb(dbName = defaultDb) {
    const client = await clientPromise;
    return client.db(dbName);
}