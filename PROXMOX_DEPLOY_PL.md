# Deploy na Proxmox po IP

Ten tutorial zaklada, ze:

- masz serwer z Proxmox VE
- chcesz uruchomic panel na publicznym IP serwera lub VM
- na razie nie uzywasz domeny
- chcesz, zeby panel dzialal po `http://TWOJE_IP`
- chcesz uruchamiac boty i serwery gier jako prawdziwe kontenery Dockera

## Najwazniejsza decyzja

Nie instaluj tego projektu bezposrednio na hoscie Proxmox.

Najlepszy wariant:

1. tworzysz osobna VM w Proxmox
2. instalujesz w niej Ubuntu Server
3. w tej VM uruchamiasz aplikacje

Dlaczego tak:

- Docker i workloady beda odseparowane od hypervisora
- latwiej robic backupy i snapshoty
- mniejsze ryzyko rozwalenia hosta Proxmox
- mniej problemow niz w LXC z nested Docker

## Architektura docelowa

```text
Internet
  |
  v
Publiczne IP VM
  |
  v
Nginx (port 80)
  |
  +--> Frontend React
  |
  `--> Backend Express /api + WebSocket logs
          |
          v
      Docker Engine
          |
          +--> kontener bota 1
          +--> kontener bota 2
          +--> kontener Minecraft
          `--> kolejne workloady
```

## Krok 1: Stworz VM w Proxmox

W panelu Proxmox:

1. `Create VM`
2. Nazwa np. `hostpanel`
3. ISO: Ubuntu Server 22.04 LTS albo 24.04 LTS
4. Dysk:
   - minimum 80 GB
   - lepiej 120 GB+, jesli planujesz serwery gier
5. CPU:
   - minimum 4 vCPU
   - sensownie: 6-8 vCPU
6. RAM:
   - minimum 8 GB
   - sensownie: 12-16 GB
7. Network:
   - bridge: zwykle `vmbr0`
   - model: `VirtIO`

Potem zainstaluj Ubuntu Server.

## Krok 2: Ustaw siec VM

Po instalacji zaloguj sie do VM i sprawdz IP:

```bash
ip a
```

Sprawdz, czy masz internet:

```bash
ping -c 4 1.1.1.1
ping -c 4 google.com
```

Jesli chcesz stale IP wewnatrz VM, ustaw je w netplan.

Przyklad:

```bash
sudo nano /etc/netplan/00-installer-config.yaml
```

Przykladowa konfiguracja:

```yaml
network:
  version: 2
  ethernets:
    ens18:
      dhcp4: no
      addresses:
        - 192.168.1.50/24
      routes:
        - to: default
          via: 192.168.1.1
      nameservers:
        addresses:
          - 1.1.1.1
          - 8.8.8.8
```

Zastosuj:

```bash
sudo netplan apply
```

Jesli Twoja VM ma publiczne IP od dostawcy, wpisz dane zgodne z ich konfiguracja.

## Krok 3: Otworz porty

Musisz otworzyc:

- `80/tcp` dla panelu
- `25565-29999/tcp`
- `25565-29999/udp`

Ten projekt przydziela publiczne porty workloadom z zakresu:

- `PORT_RANGE_START=25565`
- `PORT_RANGE_END=29999`

Jesli uzywasz UFW:

```bash
sudo apt update
sudo apt install -y ufw
sudo ufw allow 22/tcp
sudo ufw allow 80/tcp
sudo ufw allow 25565:29999/tcp
sudo ufw allow 25565:29999/udp
sudo ufw enable
sudo ufw status
```

Jesli masz firewall po stronie Proxmox albo dostawcy VPS, tam tez otworz te porty.

## Krok 4: Zainstaluj Docker i Docker Compose

```bash
sudo apt update
sudo apt install -y ca-certificates curl gnupg lsb-release
sudo install -m 0755 -d /etc/apt/keyrings
curl -fsSL https://download.docker.com/linux/ubuntu/gpg | sudo gpg --dearmor -o /etc/apt/keyrings/docker.gpg
sudo chmod a+r /etc/apt/keyrings/docker.gpg
echo \
  "deb [arch=$(dpkg --print-architecture) signed-by=/etc/apt/keyrings/docker.gpg] https://download.docker.com/linux/ubuntu \
  $(. /etc/os-release && echo "$VERSION_CODENAME") stable" | \
  sudo tee /etc/apt/sources.list.d/docker.list > /dev/null
sudo apt update
sudo apt install -y docker-ce docker-ce-cli containerd.io docker-buildx-plugin docker-compose-plugin
```

Sprawdz:

```bash
docker --version
docker compose version
sudo systemctl status docker
```

Dodaj swojego usera do grupy docker:

```bash
sudo usermod -aG docker $USER
newgrp docker
```

## Krok 5: Sprawdz, czy Docker wspiera storage limits

Ten projekt ustawia realny limit storage per workload przez:

- `StorageOpt.size`

To jest bardzo wazne. Nie chcemy symulacji.

Uruchom test:

```bash
docker run --rm --storage-opt size=1G alpine sh -c "df -h /"
```

Jesli dostaniesz blad typu:

- storage-opt unsupported
- invalid option

to znaczy, ze host Dockera nie wspiera tego limitu w obecnej konfiguracji.

Wtedy masz 3 opcje:

1. skonfigurowac host tak, by wspieral storage quotas
2. przerobic projekt tak, by storage byl limitowany inaczej
3. na razie zostawic bez storage limitu, ale to wymaga zmiany kodu

Jesli chcesz, moge Ci potem przygotowac wariant fallback dla storage pod Twój serwer.

## Krok 6: Zainstaluj Git

```bash
sudo apt install -y git
```

## Krok 7: Wgraj projekt na VM

Opcja A: przez Git:

```bash
cd /opt
sudo git clone <TWOJ_REPO_LUB_ZRODLO> hostpanel
sudo chown -R $USER:$USER /opt/hostpanel
cd /opt/hostpanel
```

Opcja B: przez SCP z Windows:

Na Windows PowerShell:

```powershell
scp -r C:\Users\Blazkoj\Desktop\host user@IP_VM:/opt/hostpanel
```

Potem na VM:

```bash
sudo chown -R $USER:$USER /opt/hostpanel
cd /opt/hostpanel
```

## Krok 8: Przygotuj plik .env

Skopiuj template:

```bash
cp .env.example .env
```

Edytuj:

```bash
nano .env
```

Przyklad pod IP:

```env
POSTGRES_DB=hostpanel
POSTGRES_USER=hostpanel
POSTGRES_PASSWORD=MEGA_MOCNE_HASLO_TUTAJ
DATABASE_URL=postgresql://hostpanel:MEGA_MOCNE_HASLO_TUTAJ@postgres:5432/hostpanel
JWT_SECRET=TU_DAJ_BARDZO_DLUGI_LOSOWY_SEKRET
API_PORT=4000
FRONTEND_PORT=4173
CORS_ORIGIN=http://TWOJE_IP
PORT_RANGE_START=25565
PORT_RANGE_END=29999
UPLOAD_LIMIT_MB=200
RUNTIME_ROOT=/srv/runtime
TEMPLATE_IMAGES_ROOT=/srv/templates
ADMIN_EMAIL=froblaz@wp.pl
ADMIN_PASSWORD=Blazej0112
NODE_ENV=production
```

Jesli panel ma dzialac po adresie:

- `http://123.123.123.123`

to ustaw:

- `CORS_ORIGIN=http://123.123.123.123`

## Krok 9: Stworz katalog runtime

```bash
mkdir -p runtime
```

## Krok 10: Uruchom wszystko

```bash
docker compose up -d --build
```

Sprawdz status:

```bash
docker compose ps
```

Sprawdz logi:

```bash
docker compose logs -f backend
docker compose logs -f frontend
docker compose logs -f nginx
docker compose logs -f postgres
```

## Krok 11: Test przez IP

W przegladarce otworz:

```text
http://TWOJE_IP
```

Backend health:

```text
http://TWOJE_IP/api/system/health
```

Powinienes dostac odpowiedz JSON z `ok: true`.

## Krok 12: Logowanie adminem

Domyslny admin:

- email: `froblaz@wp.pl`
- haslo: `Blazej0112`

Po pierwszym uruchomieniu zaloguj sie i najlepiej:

1. utworz sobie nowego admina
2. albo zmien dane seed admina w `.env`

## Krok 13: Jak wrzucac boty

Bot musi byc ZIP-em projektu Node.js albo Python.

Przyklad Node:

- `package.json`
- `index.js`

Przyklad Python:

- `requirements.txt`
- `main.py`

W panelu:

1. przejdz do `Bots`
2. wybierz ZIP
3. ustaw RAM, CPU, storage
4. kliknij create

Backend:

- rozpakowuje ZIP
- wykrywa runtime
- generuje Dockerfile
- buduje obraz
- uruchamia kontener z realnymi limitami

## Krok 14: Jak tworzyc serwery gier

W panelu:

1. przejdz do `Game servers`
2. wybierz template
3. ustaw env
4. ustaw limity
5. kliknij create

Przy pierwszym starcie template moze pobierac pliki gry.

To znaczy, ze:

- Minecraft pobierze server jar
- SteamCMD-based images pobiora pliki serwera
- FiveM pobierze artifact z podanego URL

## Krok 15: Jak sprawdzac, czy workload naprawde ma limity

Na VM uruchom:

```bash
docker ps
```

Znajdz kontener workloadu i sprawdz:

```bash
docker inspect NAZWA_LUB_ID | less
```

Szukaj:

- `Memory`
- `NanoCpus`
- `StorageOpt`
- `PortBindings`

Mozesz tez sprawdzic live:

```bash
docker stats
```

## Krok 16: Jak restartowac panel

```bash
cd /opt/hostpanel
docker compose restart
```

Albo konkretna usluge:

```bash
docker compose restart backend
docker compose restart frontend
docker compose restart nginx
```

## Krok 17: Jak aktualizowac projekt

Jesli projekt jest z Git:

```bash
cd /opt/hostpanel
git pull
docker compose up -d --build
```

Jesli kopiujesz pliki recznie:

1. nadpisz pliki na serwerze
2. potem:

```bash
cd /opt/hostpanel
docker compose up -d --build
```

## Krok 18: Najczestsze problemy

### 1. Strona sie nie otwiera po IP

Sprawdz:

```bash
docker compose ps
sudo ss -tulpn | grep :80
sudo ufw status
```

### 2. API zwraca blad CORS

W `.env` ustaw poprawnie:

```env
CORS_ORIGIN=http://TWOJE_IP
```

Potem:

```bash
docker compose up -d --build
```

### 3. Workload nie startuje

Sprawdz log backendu:

```bash
docker compose logs -f backend
```

Potem logi konkretnego workloadu:

```bash
docker logs -f ID_KONTENERA
```

### 4. Port gry nie odpowiada

Sprawdz:

- czy workload ma przypisany host port
- czy port jest otwarty w UFW
- czy port nie jest blokowany przez firewall dostawcy
- czy template poprawnie wystartowal

### 5. Storage limit nie dziala

To zwykle oznacza problem po stronie hosta Dockera, nie aplikacji.

## Krok 19: Co polecam od razu po starcie

1. ustaw mocne haslo do Postgresa
2. ustaw mocny `JWT_SECRET`
3. ogranicz SSH tylko do swojego IP, jesli mozesz
4. zrob snapshot VM w Proxmox po pierwszym dzialajacym deployu
5. przetestuj jednego bota i jeden serwer Minecraft

## Minimalna checklista

Jesli chcesz po prostu odpalic to szybko:

1. stworz Ubuntu VM w Proxmox
2. otworz port 80 i zakres 25565-29999 tcp/udp
3. zainstaluj Docker + Compose
4. wrzuc projekt do `/opt/hostpanel`
5. skopiuj `.env.example` do `.env`
6. ustaw `CORS_ORIGIN=http://TWOJE_IP`
7. uruchom `docker compose up -d --build`
8. wejdz na `http://TWOJE_IP`

## Jesli chcesz, co moge zrobic dalej

Moge Ci przygotowac jeszcze jedna z tych rzeczy:

1. instrukcje dokladnie pod Twoje IP i Twoja siec Proxmox
2. wersje pod Cloudflare Tunnel albo reverse proxy bez domeny
3. twarde zabezpieczenie panelu pod publiczne IP
4. wersje z HTTPS po samym IP
5. wersje pod LXC w Proxmox zamiast VM
