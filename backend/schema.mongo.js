db.characters.createIndex({ char: 1 }, { unique: true });
db.characters.createIndex({ radical: 1 });
db.characters.createIndex({ title: 1 });

db.works.createIndex({ title: 1 });
db.works.createIndex({ dynasty: 1 });
