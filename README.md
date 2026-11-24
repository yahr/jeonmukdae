# 전국먹자대회 (전먹대)

매달 한 부문씩 전국 가게를 도장깨기하는 레트로 게임형 맛집 사이트. 12월은 찐만두 부문.

- 사이트: https://yahr.github.io/jeonmukdae/
- 부문 예: https://yahr.github.io/jeonmukdae/division/jjinmandu/
- 도장 예: https://yahr.github.io/jeonmukdae/dojo/mandu-999-bangi/
- API: https://jeonmukdae-api.jeonmukdae.workers.dev (`worker/`)

## 가게 등록 (운영자)

1. `npm run add-dojo -- "가게 이름" --division jjinmandu --slug mandu-xxx` (카카오 검색으로 상호·주소·좌표를 넣음)
2. `data/dojos.json`에서 메뉴·가격·영업시간·능력치를 방문 후 채움. 모르는 값은 `null`로 둠
3. `npm run og`로 공유 이미지를 만들고 커밋·푸시 → GitHub Actions가 검사·빌드·배포

GitHub 웹 화면에서 `data/dojos.json`을 바로 고쳐도 같은 배포가 돈다. 데이터가 틀리면 빌드가 멈추고 Actions 화면에 이유가 나온다.

## 개발

```bash
npm test && npm run build    # _site/
python3 server.py 8791       # 게임 원본 + 카카오 중계
```

게임은 localhost에서 `server.py`를, 그 외 주소에서는 Worker를 API로 쓴다. 기록은 Worker 뒤 D1·R2에 저장된다. 세부 규칙은 `CLAUDE.md`.
