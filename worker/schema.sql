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

-- 캐릭터 생성 횟수(KST 날짜별). Worker가 없으면 만든다
CREATE TABLE IF NOT EXISTS gens (day TEXT, uid TEXT, n INTEGER, PRIMARY KEY (day, uid));

-- 유료 플랜(캐릭터 무제한 변경 등). 운영자가 wrangler d1 execute 로 넣는다. until 은 ms(없으면 무기한)
CREATE TABLE IF NOT EXISTS plans (uid TEXT PRIMARY KEY, plan TEXT NOT NULL, until INTEGER);
