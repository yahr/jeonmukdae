# 전국먹자대회 (전먹대)

매달 한 종목씩 전국 가게를 도장깨기하는 레트로 오락실 게임. 순대국부터.

- `index.html` 하나가 게임 전체. 기록은 Cloudflare Worker 뒤의 D1(문서)·R2(사진)에 저장되고 8초마다 동기화.
- 신원은 닉네임 + PIN. 가입 화면 없이 입장 창에서 정하고, 다른 기기에서 같은 걸 넣으면 이어짐. PIN은 복구 불가.
- `server.py` 는 로컬 개발용 정적 서버 + 카카오 중계 (`/api/places`, `/api/place`). 저장소는 로컬에서도 Worker를 씀.
- `worker/` 가 운영 API: 카카오 중계 + `/auth` + `/db/*`(sync/list/get/set/update/delete) + `/photo/*`. 스키마는 `worker/schema.sql`.

## 돌리기

```bash
python3 server.py 8791
# http://localhost:8791
```

## 배포

- 페이지: GitHub Pages → https://yahr.github.io/jeonmukdae/ (main 브랜치 루트, push 하면 1~2분 뒤 갱신)
- API: Cloudflare Worker → https://jeonmukdae-api.jeonmukdae.workers.dev (`worker/` 폴더, `server.py`와 같은 두 엔드포인트)

```bash
cd worker && wrangler deploy   # API 고칠 때
```

페이지는 localhost에서 열면 `server.py`를, 그 외 주소에서는 Worker를 API로 씁니다. 다른 서버를 쓰려면 `?api=https://주소` 를 한 번 붙여 열면 기억합니다.

## 폰에서 맥 서버를 직접 쓰고 싶을 때 (선택)

```bash
cloudflared tunnel --url http://localhost:8791
```

출력되는 `https://xxxx.trycloudflare.com` 주소를 폰에서 열면 됩니다. 주소는 켤 때마다 바뀌고 몇 시간 뒤 끊길 수 있습니다.

## 시즌 바꾸기

`index.html` 의 `SEASONS` 배열만 고치면 됩니다. 메뉴 프리셋은 `PRESETS`.
