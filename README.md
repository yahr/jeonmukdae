# 전국먹자대회 (전먹대)

매달 한 종목씩 전국 가게를 도장깨기하는 레트로 오락실 게임. 순대국부터.

- `index.html` 하나가 게임 전체. 기록은 브라우저 localStorage에 저장.
- `server.py` 는 정적 파일 + 카카오 중계 API (`/api/places` 근처 가게 검색, `/api/place` 사진·메뉴·평점).

## 돌리기

```bash
python3 server.py 8791
# http://localhost:8791
```

## 폰에서 쓰기 (GPS·카메라는 https 필요)

맥에서 서버를 켜 두고 터널로 https 주소를 냅니다.

```bash
brew install cloudflared
cloudflared tunnel --url http://localhost:8791
```

출력되는 `https://xxxx.trycloudflare.com` 주소를 폰에서 열면 끝. 주소는 켤 때마다 바뀝니다.

## GitHub Pages (서버 없이)

정적 페이지만 올라가므로 가게 검색·카카오 사진은 꺼집니다. 터널 주소를 한 번만 알려주면 그쪽 API를 씁니다.

```
https://yahr.github.io/jeonmukdae/?api=https://xxxx.trycloudflare.com
```

## 시즌 바꾸기

`index.html` 의 `SEASONS` 배열만 고치면 됩니다. 메뉴 프리셋은 `PRESETS`.
