CREATE TABLE IF NOT EXISTS scores (
  pid TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  score INTEGER NOT NULL,
  country TEXT NOT NULL,
  updated INTEGER NOT NULL
);
CREATE INDEX IF NOT EXISTS scores_global ON scores (score DESC, updated ASC);
CREATE INDEX IF NOT EXISTS scores_country ON scores (country, score DESC, updated ASC);
