# Руководство по развертыванию Treeline Tracker на Railway 🚂

В данном руководстве подробно описан пошаговый процесс развертывания полного стека **Treeline Tracker** на облачной платформе **[Railway](https://railway.com/)** с использованием GitHub-интеграции.

---

## 🏗️ Архитектура сервисов на Railway

Проект на Railway будет состоять из 4 взаимодействующих компонентов внутри единого проекта:

1. **`PostgreSQL + PostGIS`** — база данных с геопространственным расширением.
2. **`treeline-mosquitto`** — брокер сообщений MQTT (образ `eclipse-mosquitto:2.0`).
3. **`treeline-backend`** — REST API & WebSocket сервис (сборка из `backend/Dockerfile`).
4. **`treeline-frontend`** — веб-приложение Next.js 15 (сборка из корневого `Dockerfile`).

```
                    [ Пользователи / Браузер ]
                                |
                   HTTPS        v
        +-----------------------------------------------+
        |    treeline-frontend (Next.js Standalone)     |
        +-----------------------------------------------+
                                |
               REST / WSS       v
        +-----------------------------------------------+
        |        treeline-backend (Node.js/Express)     |
        +-----------------------------------------------+
                 |                              |
         SQL     v                      MQTT    v
  +--------------------------+    +--------------------------+
  |   PostgreSQL + PostGIS   |    |    treeline-mosquitto    |
  +--------------------------+    +--------------------------+
```

---

## 📋 Пошаговая инструкция развертывания

### Шаг 1. Создание проекта на Railway
1. Авторизуйтесь на сайте [Railway.com](https://railway.com/) через ваш GitHub-аккаунт.
2. Нажмите кнопку **«New Project»** (или «+ New»).

---

### Шаг 2. Добавление базы данных PostgreSQL с PostGIS
> **Важно:** Стандартный плагин PostgreSQL в Railway не содержит бинарных файлов расширения PostGIS. Поэтому базу данных создаем через официальный шаблон **PostGIS** или Docker-образ:

1. В меню добавления нажмите **«+ New»** ➔ выберите **«Template»** (или найдите в поиске «PostGIS»).
2. Выберите проверенный шаблон **PostGIS** (образ `postgis/postgis:16-master` / `postgis/postgis:16-3.4-alpine`).
3. Шаблон автоматически подключит постоянный том (`/var/lib/postgresql/data`) и инициализирует переменные окружения (`DATABASE_PRIVATE_URL`, `POSTGRES_USER`, `POSTGRES_PASSWORD`, `POSTGRES_DB`).
4. Расширение PostGIS уже предустановлено и готово к работе! Таблицы и начальные данные инициализируются автоматически при первом запуске бэкенда.

---

### Шаг 3. Добавление MQTT-брокера (Mosquitto)
1. В том же проекте нажмите **«+ New» ➔ «Docker Image»**.
2. Введите название официального образа:
   ```text
   eclipse-mosquitto:2.0
   ```
3. Переименуйте созданный сервис в `mosquitto`.
4. В настройках сервиса (**Settings**) создайте приватный сетевой домен (**Networking ➔ Private Networking**). Брокер будет доступен бэкенду по внутренней сети на порту `1883`.

---

### Шаг 4. Добавление сервиса бэкенда (`treeline-backend`)
1. Нажмите **«+ New» ➔ «GitHub Repo»** и выберите репозиторий `Treeline-Tracker`.
2. Переименуйте сервис в `treeline-backend`.
3. Откройте **Settings** сервиса:
   - В блоке **Build**:
     - **Dockerfile Path:** укажите `backend/Dockerfile`
     - **Root Directory:** оставьте `/` (так как Dockerfile использует контекст всего монорепозитория).
4. Перейдите во вкладку **Variables** и добавьте переменные:
   ```env
   PORT=4000
   DATABASE_URL=${{Postgres.DATABASE_URL}}
   JWT_SECRET=super_secret_secure_key_treeline_prod_2026_jwt_token_auth
   JWT_REFRESH_SECRET=super_secret_secure_key_treeline_prod_2026_refresh_token
   MQTT_BROKER_URL=mqtt://${{mosquitto.RAILWAY_PRIVATE_DOMAIN}}:1883
   CORS_ORIGIN=*
   ```
5. Во вкладке **Settings ➔ Networking** нажмите **«Generate Domain»** для получения публичного URL (например, `treeline-backend-production.up.railway.app`).

---

### Шаг 5. Добавление сервиса фронтенда (`treeline-frontend`)
1. Нажмите **«+ New» ➔ «GitHub Repo»** и снова выберите `Treeline-Tracker`.
2. Переименуйте сервис в `treeline-frontend`.
3. В **Settings**:
   - **Dockerfile Path:** оставьте по умолчанию `Dockerfile` (корневой Dockerfile проекта).
   - **Root Directory:** оставьте `/`.
4. Во вкладке **Variables** укажите адрес бэкенда:
   ```env
   PORT=3000
   NEXT_PUBLIC_API_URL=https://${{treeline-backend.RAILWAY_PUBLIC_DOMAIN}}/api/v1
   NEXT_PUBLIC_WS_URL=wss://${{treeline-backend.RAILWAY_PUBLIC_DOMAIN}}/ws
   NEXT_PUBLIC_STORAGE_MODE=rest
   ```
   *(Если требуется ИИ для поиска пропавших, добавьте переменную `GEMINI_API_KEY=ваш_ключ`).*
5. Во вкладке **Settings ➔ Networking** нажмите **«Generate Domain»** для получения публичного веб-адреса (например, `treeline-tracker.up.railway.app`).

---

### Шаг 6. Проверка работы
1. Перейдите по полученному публичному адресу фронтенда.
2. В строке состояния экспедиции убедитесь, что индикатор связи показывает **«Интернет»** или **«REST API»**.
3. Зарегистрируйте аккаунт и проверьте создание команды и отображение тактической карты.

