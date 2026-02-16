# Yuuka Grow Server (Cloudflare Workers + D1)

## 1) 설치
```bash
npm install
```

## 2) Cloudflare 로그인
```bash
wrangler login
```

## 3) D1 DB 생성
```bash
wrangler d1 create yuuka_grow_db
```

## 4) `wrangler.jsonc`에 DB 바인딩 추가
`d1_databases`에 아래 형태로 넣는다. 바인딩 이름은 반드시 `DB`.

```jsonc
{
  "d1_databases": [
    {
      "binding": "DB",
      "database_name": "yuuka_grow_db",
      "database_id": "YOUR_DATABASE_ID"
    }
  ]
}
```

## 5) 마이그레이션 생성 / 적용
마이그레이션 파일 생성:
```bash
wrangler d1 migrations create yuuka_grow_db init_runs
```

로컬 D1 적용:
```bash
wrangler d1 migrations apply yuuka_grow_db --local
```

원격 D1 적용:
```bash
wrangler d1 migrations apply yuuka_grow_db --remote
```

## 6) 로컬 실행
```bash
wrangler dev
```

## 관리자 인증 시크릿
```bash
wrangler secret put ADMIN_USER
wrangler secret put ADMIN_PASS
```

## 관리자 마이그레이션 적용(추가 3줄)
```bash
wrangler d1 migrations apply yuuka_grow_db --local
wrangler d1 migrations apply yuuka_grow_db --remote
```

## 7) 배포
```bash
wrangler deploy
```

## API 요약
- `POST /api/submit`
- `GET /api/leaderboard?sort=credit|thigh&limit=100`
- `GET /share/:shareId`
- `GET /admin` (Basic Auth)
- `GET /admin/api/search`
- `GET /admin/api/run`
- `POST /admin/api/update`
- `POST /admin/api/hide`
- `POST /admin/api/delete`

## 개발 시 주의
- 프론트(Vite dev 서버)에서 `/api/*`를 직접 호출하면 라우팅이 프론트 서버로 갈 수 있다.
- 이 경우:
  - 프론트 dev 서버에 프록시를 설정하거나
  - Worker dev 주소(`wrangler dev`에서 표시되는 URL)로 직접 호출해야 한다.
