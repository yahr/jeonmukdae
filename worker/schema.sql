-- 문서 저장소: 페이지의 localDB와 같은 모양(경로 → JSON). col = 경로에서 마지막 조각을 뺀 컬렉션 경로
CREATE TABLE IF NOT EXISTS docs (
  path TEXT PRIMARY KEY,
  col TEXT NOT NULL,
  body TEXT NOT NULL,
  t INTEGER NOT NULL,
  deleted INTEGER NOT NULL DEFAULT 0
);
CREATE INDEX IF NOT EXISTS docs_col_t ON docs (col, t);

-- 플레이어 신원: 닉네임 + PIN(해시). 캐릭터·XP 같은 내용은 docs 의 players/{uid} 에
CREATE TABLE IF NOT EXISTS players (
  uid TEXT PRIMARY KEY,
  nick TEXT UNIQUE NOT NULL,
  pinhash TEXT NOT NULL,
  t INTEGER NOT NULL
);
