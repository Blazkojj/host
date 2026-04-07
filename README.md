# HostPanel

Kompletna platforma hostingowa do botow i serwerow gier z realnym provisioningiem Docker, limitem RAM/CPU/Storage po stronie Dockera, PostgreSQL, frontendem React i panelem admina.

## Stack

- Backend: Node.js + Express + JWT + bcrypt + dockerode
- Frontend: React + Vite
- Baza danych: PostgreSQL
- Runtime workloads: Docker Engine
- Reverse proxy: Nginx
- Logi live: Docker logs + Socket.IO
- Deployment backendu: PM2 (`pm2-runtime`)

## Co jest realne, a nie symulowane

- Kazdy bot i kazdy serwer gry dziala w osobnym kontenerze Dockera.
- Tworzenie bota buduje osobny obraz na podstawie przeslanego ZIP-a.
- Limity sa wymuszane przez `HostConfig.Memory`, `HostConfig.NanoCpus` i `HostConfig.StorageOpt.size`.
- Logi pochodza bezposrednio z `docker logs`.
- Porty publiczne sa mapowane przez Dockera na hosta.

Jesli daemon Dockera nie wspiera `StorageOpt.size`, tworzenie workloadu nie powinno przejsc. System nie robi fallbacku do "udawanych" limitow.

## Funkcje

- Rejestracja / logowanie / JWT
- Role `user` i `admin`
- Seed admina:
  - email: `froblaz@wp.pl`
  - haslo: `Blazej0112`
- Hosting botow z uploadem ZIP
- Dynamiczne generowanie Dockerfile dla Node.js i Python
- Start / stop / restart / delete
- Live logs przez WebSocket
- Auto restart (`unless-stopped`)
- Environment variables
- Szablony serwerow gier:
  - Minecraft Paper
  - Minecraft Vanilla
  - FiveM
  - CS2
  - Rust
  - Terraria
  - Valheim
- Admin panel:
  - zarzadzanie userami
  - ustawianie limitow
  - blokowanie userow
  - przeglad kontenerow
  - kill container
  - monitoring RAM/CPU z Docker stats

## Struktura

```text
.
|-- backend/
|-- frontend/
|-- game-images/
|-- nginx/
|-- examples/
|-- docker-compose.yml
`-- README.md
```

## Szybki start lokalny

1. Skopiuj `.env.example` do `.env`.
2. Ustaw bezpieczne wartosci dla:
   - `POSTGRES_PASSWORD`
   - `DATABASE_URL`
   - `JWT_SECRET`
3. Upewnij sie, ze Docker Engine jest uruchomiony.
4. Uruchom:

```bash
docker compose up -d --build
```

Panel bedzie dostepny pod `http://localhost`.

## Deployment na Ubuntu Server

### 1. Wymagania

- Ubuntu 22.04 lub nowszy
- Docker Engine + Docker Compose Plugin
- minimum 4 vCPU / 8 GB RAM dla sensownego testu
- publiczne porty dla gier otwarte w firewallu

### 2. Instalacja Dockera

```bash
sudo apt-get update
sudo apt-get install -y ca-certificates curl gnupg
sudo install -m 0755 -d /etc/apt/keyrings
curl -fsSL https://download.docker.com/linux/ubuntu/gpg | sudo gpg --dearmor -o /etc/apt/keyrings/docker.gpg
sudo chmod a+r /etc/apt/keyrings/docker.gpg
echo \
  "deb [arch=$(dpkg --print-architecture) signed-by=/etc/apt/keyrings/docker.gpg] https://download.docker.com/linux/ubuntu \
  $(. /etc/os-release && echo "$VERSION_CODENAME") stable" | \
  sudo tee /etc/apt/sources.list.d/docker.list > /dev/null
sudo apt-get update
sudo apt-get install -y docker-ce docker-ce-cli containerd.io docker-buildx-plugin docker-compose-plugin
```

### 3. Storage quotas Dockera

Ten projekt korzysta z `StorageOpt.size`, wiec host powinien byc skonfigurowany tak, aby Docker wspieral limity rozmiaru warstwy zapisu. W praktyce najbezpieczniej:

- uzyc `overlay2`
- miec wspierane quota po stronie hosta
- przetestowac `docker run --storage-opt size=1G ...`

Jesli ta komenda nie dziala na Twoim hoście, storage limit nie bedzie obslugiwany i provisioning powinien konczyc sie bledem.

### 4. Konfiguracja aplikacji

```bash
cp .env.example .env
```

Ustaw:

- `POSTGRES_PASSWORD`
- `DATABASE_URL`
- `JWT_SECRET`
- `PORT_RANGE_START` / `PORT_RANGE_END`
- opcjonalnie `ADMIN_EMAIL`, `ADMIN_PASSWORD`

### 5. Start produkcyjny

```bash
docker compose up -d --build
docker compose ps
```

### 6. Reverse proxy i TLS

W repo jest podstawowy `nginx.conf` dla HTTP. Dla TLS dodaj certyfikaty i osobny server block na 443 albo postaw certbot/Traefik przed tym Nginxem.

## Wazne uwagi operacyjne

- Backend ma dostep do `/var/run/docker.sock`, wiec traktuj go jak komponent uprzywilejowany.
- FiveM wymaga poprawnego `FIVEM_ARTIFACT_URL` i klucza licencyjnego.
- CS2 moze wymagac tokena GSLT (`STEAM_GAME_TOKEN`).
- Szablony SteamCMD pobieraja pliki gry przy pierwszym starcie kontenera.
- Frontend jest minimalistyczny i operacyjny, ale bez symulowanego monitoringu.

## Przykladowe dynamiczne Dockerfile

Zobacz:

- `examples/generated/NodeBot.Dockerfile`
- `examples/generated/PythonBot.Dockerfile`

## Rozwoj

Backend:

```bash
cd backend
npm install
npm run dev
```

Frontend:

```bash
cd frontend
npm install
npm run dev
```
