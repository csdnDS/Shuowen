db.characters.createIndex({ char: 1 }, { unique: true });
db.characters.createIndex({ radical: 1 });
db.characters.createIndex({ title: 1 });
db.characters.createIndex({ pinyin: 1 });
db.characters.createIndex({ strokes: 1 });

db.works.createIndex({ title: 1 });
db.works.createIndex({ dynasty: 1 });

db.radicals.createIndex({ radical: 1 }, { unique: true });
db.radicals.createIndex({ pinyin: 1 });
db.radicals.createIndex({ strokes: 1 });
