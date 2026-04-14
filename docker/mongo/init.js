// Init MongoDB para analytics
db = db.getSiblingDB('cms_analytics');

db.createCollection('events');
db.events.createIndex({ timestamp: 1 }, { expireAfterSeconds: 63072000 }); // TTL 2 años
db.events.createIndex({ sessionId: 1 });
db.events.createIndex({ userId: 1 });
db.events.createIndex({ name: 1, timestamp: -1 });
db.events.createIndex({ category: 1, timestamp: -1 });
db.events.createIndex({ 'properties.postId': 1 });

print('MongoDB analytics collections and indexes created');
