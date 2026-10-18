# 전국먹자대회 (전먹대)

매달 한 종목씩 전국 가게를 도장깨기하는 레트로 오락실 게임. 순대국부터.

- `index.html` 하나가 게임 전체. 기록은 브라우저 localStorage에 저장.
- `server.py` 는 정적 파일 + 카카오 중계 API (`/api/places` 근처 가게 검색, `/api/place` 사진·메뉴·평점).

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
