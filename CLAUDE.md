# 전국먹자대회(전먹대) 하네스

매달 한 부문씩 전국 가게를 도장깨기하는 레트로 게임형 맛집 사이트다. 이 폴더에서 세션을 열면 이 문서를 먼저 따른다. 전역 `~/.claude/CLAUDE.md` 규칙(한국어, 10분 보고, 진행 막대, AS-IS·TO-BE 캡처, 커밋 서명 금지)은 그대로 적용된다.

## 미션 받는 방법 (2026-11-24 사용자 지시)

1. **새 미션이면 착수 전에 묻는다.** 이 세션에서 하던 일의 후속·수정·질문이 아니라 새 일이면, 먼저 하위 세션으로 할지 이 세션에서 할지 묻는다.
   - `start_session`을 `initiation: "offer"`로 불러 "새 세션 / 여기서 하기" 카드를 띄운다. 카드를 못 쓰면 한 줄로 묻는다.
2. **하위 세션이면 모델도 같이 묻는다.** 브리프를 보내기 전에 `AskUserQuestion` 한 번으로 모델을 고르게 한다. 일의 성격에 맞는 것을 맨 앞에 두고 "(추천)"을 붙인다.
   - 지금 세션과 같은 모델: 게임 연출 설계, 까다로운 버그, 데이터 구조 변경처럼 판단이 많은 일
   - Sonnet `claude-sonnet-5-5`: 범위가 분명한 페이지·기능 추가, 도장 데이터 입력, 큐레이션 글 빌드
   - Haiku `claude-haiku-5-5`: 읽기만 하는 확인, 장소 정보 수집, 기계적인 변환
   - 지금보다 높은 모델(예: Fable `claude-fable-5-2`)도 선택지에 남겨 둔다
   - 사용자가 이미 모델을 골랐으면 다시 묻지 않는다. 같은 하위 세션에 후속 일을 보낼 때도 다시 묻지 않는다.
   - 같거나 싼 모델은 `start_session`의 `model`로, 더 비싼 모델이거나 카드로 시작했으면 연 직후 `set_session_model`로 바꾼다.
3. **하위 세션을 열면 그 답에서 10분 알림(`CronCreate` `*/10 * * * *`)을 건다.** 알림마다 `list_events`와 이 저장소의 git 상태를 직접 보고 세션마다 한 줄씩(모델 포함) 보고한다. 끝나면 결과를 검증하고 알림을 지운다.
4. **하위 세션 브리프에 적을 것:** 이 `CLAUDE.md`를 먼저 읽을 것, 10분 진행 보고와 스스로 10분 알림 걸기, 화면을 바꾸면 AS-IS·TO-BE 캡처, 커밋은 서명 없이, 하위 세션이 또 하위 세션을 열 때도 이 규칙을 따를 것.

## 구조

| 경로 | 내용 |
|---|---|
| `index.html` | 게임 전체(한 파일). `<!--SEO-->`, `<!--DOJO-LINKS-->` 자리는 빌드가 채운다 |
| `data/site.json` | 사이트 이름·주소(`baseUrl`)·검색 등록 인증값 |
| `data/divisions.json` | 부문(찐만두 등): 시즌 기간, 소개, 6각 능력치 이름·산정 기준, 축별 느낌 버튼 `feel`·결과 말 `word`·필살기 `move`, 패배 문구 `koLine`, 데미지 계수 `damage` |
| `data/dojos.json` | 운영자가 여는 공식 도장. 모르는 값은 `null` → 화면에 "확인 중" |
| `content/dojo/<slug>.md` | 도장 후기(운영자가 직접 사 먹고 씀). `draft: true`면 안 나감 |
| `content/guide/<slug>.md` | 큐레이션 글. 머리말 `title`, `description`, `date`, `dojos: slug1, slug2` |
| `assets/battle-core.js` | 행복한 빌런 숫자 로직: 기술 1/n + 같은 기술 k번째 ×(1+0.5(k−1)) 상한 3배, 정신줄=100−행복, 오버킬, 필살 무기·손님 집계, 평가 초안, 최강 빌런. 테스트 `scripts/battle.test.mjs` |
| `assets/battle.js` | 대결 화면 연출. 버튼 누를 때 `import()`로 불러온다(첫 로딩에 안 들어감) |
| `assets/battle/` | Gemini로 만든 대결 그림(WebP)과 `manifest.json`: 부문별 빌런 표정 4컷(idle·taunt·special·win)·소품 |
| `assets/sprite.js` | 2x2 표정 시트 → 프레임 자르기(마젠타·후광 지우기, 픽셀 축소), 플레이어 프롬프트. 브라우저·Worker·`gen_art.py`가 같이 씀. 테스트 `scripts/sprite.test.mjs` |
| `scripts/prompts/` | 빌런 시트 프롬프트(글로만, 외부 사진·원작 그림 입력 금지) |
| `scripts/gen_art.py` | `npm run art [-- 이름]`: Gemini 이미지 모델로 대결 그림 생성. 모델은 목록에서 고름, 키는 `.env` |
| `scripts/build.mjs` | 정적 빌드 → `_site/` (부문·도장·큐레이션 페이지, JSON-LD, sitemap, robots, llms.txt) |
| `scripts/validate.mjs` | 데이터 검증. 오류가 있으면 빌드가 멈춘다 |
| `scripts/og.py` | 공유 이미지 1200×630. 맥에서 돌리고 PNG를 커밋한다(Actions엔 한글 서체 없음) |
| `scripts/add-dojo.mjs` | 카카오 로컬 검색으로 도장 하나 추가 |
| `worker/` | Cloudflare Worker API: 카카오 중계, 닉네임+PIN 입장, D1 문서 저장, R2 사진, `POST /avatar/gen` 전신 캐릭터 생성(Gemini, 사람당 하루 4번·전체 150번, D1 `gens`) |
| `server.py` | 로컬 개발 서버(게임 원본 + 카카오 중계) |
| `.github/workflows/pages.yml` | main에 푸시하면 테스트 → 빌드 → GitHub Pages 배포 |

## 자주 쓰는 명령

```bash
npm test                      # 데이터 검증 테스트
npm run build                 # _site/ 만들기
npm run add-dojo -- "검색어" --division jjinmandu --slug mandu-xxx
npm run og                    # 공유 이미지 다시 만들기(도장을 추가했으면 필수)
npm run art -- villain        # 대결 그림 다시 만들기(.env의 GEMINI_API_KEY). 표정이 행복한지 눈으로 검수
npm run art -- villain-sheet  # 빌런 표정 4컷 시트. --from=시트.png 면 자르기만
# Worker 캐릭터 생성 키(값이 화면에 안 나오게): cd worker && grep '^GEMINI_API_KEY=' ../.env | cut -d= -f2- | tr -d "\"' \r\n" | npx wrangler secret put GEMINI_API_KEY
cd worker && wrangler deploy  # API 고칠 때
```

미리보기: 상위 폴더 `.claude/launch.json`의 `jeonmukdae`(게임 원본, 8791), `jeonmukdae-site`(빌드 결과, 8792).

## 지킬 것

- **지어내지 않는다.** 가게 정보는 카카오 로컬 API와 운영자 방문으로만 채운다. 모르면 `null`(화면엔 "확인 중"). AggregateRating은 실제 평가가 있을 때만.
- **사진 원칙.** 카카오맵 등 외부 매장 사진은 내려받거나 이미지 생성 입력으로 쓰지 않는다. 운영자가 찍은 사진, 사장님이 준 사진만 쓴다.
- **가게를 나쁘게 묘사하지 않는다.** 빌런 콘셉트도 칭찬의 다른 이름이다.
- **공정성.** 한 부문에 같은 동네 가게를 3~5곳 함께 열고 산정 기준을 공개한다.
- **행복 KO 기록 규칙.** KO 문서는 플레이어가 자기 것만 쓴다(Worker `canWrite`의 `by===uid`). 빌런 순위는 쓰러진 사람 수 → 평균 입 수 순. 문서의 `uses`(기술별 누른 횟수 누적)는 "손님들이 뽑은 필살 무기"용이고 운영자 `stats`와 섞지 않는다. 평가 초안은 폼에 채우기만 하고 저장은 사용자가 누른다. 대결 그림의 표정은 늘 행복해야 하고 찡그림·고통은 다시 만든다.
- **화면·공개 파일에 'Gemini' 이름을 쓰지 않는다**(2026-11-24 사용자 지시). 사용자에게는 "AI", 동의 문구는 "외부 AI 이미지 서비스"로. 서버 코드·주석·이 문서 같은 비공개 파일은 괜찮지만 `assets/`처럼 배포되는 파일의 주석도 안 된다.
- **wrangler는 반드시 `worker/` 폴더에서 실행한다.** 저장소 루트에서 `wrangler deploy`를 치면 폴더 전체(`.env` 포함)를 새 정적 사이트로 올리려 한다(2026-11-24 실제로 확인 질문까지 갔음).
- 캐릭터 생성은 무료 사용자 평생 2회(`FREE_TOTAL`), 전체 하루 30장(`PER_DAY`). 유료는 D1 `plans` 표에 uid를 넣는다. Worker는 Gemini 지역 차단 때문에 `[placement] region = "gcp:us-central1"`로 돈다.
- **브라우저 저장 키 `sundae-quest-*`는 바꾸지 않는다.** 바꾸면 사용자 로그인이 풀린다(옛 폴더 이름의 흔적).
- 커밋은 `git -c user.name=yahr -c user.email=light.ez.glona@gmail.com commit …`(전역 git 사용자 미설정), 서명 줄 없이.

## 남은 일(요청서 기준, 2026-11-24)

요청서: Claude Docs "전먹대 사이트 수정 요청서 (Claude Code 전달용)", 기획안: "방이동 찐만두 로컬 큐레이션 기획안".

- [x] 정적 생성, URL 구조, 도장 페이지, JSON-LD, 메타·OG, sitemap·robots·llms.txt, 자동 배포, 찐만두 부문 데이터
- [x] 3-8 행복한 빌런: 행복 게이지, 필살기 6종 연출(히트 스톱·흔들림·플래시·행복 +숫자·진동), 행복 KO·결과 화면, 최강 빌런 순위(`menus/<부문>/kos/<가게>__<uid>`, 가게마다 한 사람 1회), KO XP 15, 정적 도장 페이지 `?vs=<slug>` 진입 (2026-11-24)
- [ ] 3-8-2 부문별 관능 어휘 조사(`npm run lexicon`, 네이버 검색 API 키 필요)
- [x] 3-8-1 조작 개편(2026-11-24): 느낌 버튼 2×3, 정신줄(HP) 표시, 1/n 데미지·반복 배율·오버킬, KO 슬로우모션 날아가기(흑백·잔상·카메라 추적·착지 먼지), 이 집의 필살 무기·손님들이 뽑은 필살 무기(게임·정적 페이지), 오늘 나를 쓰러뜨린 맛 6각·평가 초안
- [~] 3-8-3 플레이어 캐릭터(2026-11-24): "내 캐릭터 만들기"에서 셀카(전면·거울 미리보기, 앨범 첨부 불가)나 랜덤으로만 생성, 무료 평생 2회·확인 단계·자동 재생성 없음. 시트는 3x3 = 동작 9개(대기·한 입·황홀·맞음·넉백·날아감·착지·다운·늘어짐), 저장 `sprite.grid=3`. 예전 2x2(grid 없음)는 `poseFrames`가 가까운 프레임으로 대체. 등급 띠·왕관은 덧그림, 없으면 픽셀 SVG. 남은 것: 유료 플랜 화면, 사진 동의 문구 법무 확인
- [x] Worker 배포(상위 세션이 `worker/`에서): Gemini 키 secret, 미국 리전 배치, 평생 2회·하루 30장. 3x3 프레임 9장 저장(`storePhotos` 9장)은 배포가 필요하다
- [ ] 3-8-4 도트 매장 배경(업종별 타일셋)
- [ ] 3-9 스포크 문구 뽑기(`npm run spoke`), 첫 후기 본문(방문 후)
- [ ] 4 공유 버튼·격파 인증 카드(9:16, 1:1, 4:5)·UTM
- [ ] 5 GA4(측정 ID 필요)
- [ ] 7 자체 도메인(CNAME). 지금은 하위 경로라 robots.txt·llms.txt를 크롤러가 못 읽는다
