# Fleet Fuel Platform

MVP-платформа для водителей и диспетчеров с приоритетом на быстрый ежедневный ввод данных, точный расчет путевых листов и чистую расширяемую архитектуру.

## Архитектура

- `apps/web` - React + TypeScript интерфейс для диспетчера и водителя
- `apps/api` - backend-слой с подготовленной структурой сервисов, маршрутов и авторизации
- `packages/domain` - доменные типы, расчет путевых листов, форматирование и mock-данные

## Что реализовано в MVP

- архитектурный каркас коммерческого продукта
- авторизация и ролевая заготовка
- справочник автомобилей с нормами и историей изменений
- справочник водителей
- создание путевого листа с автоподстановкой норм
- точный перерасчет по каждому изменению поля
- контроль расхождения пробега между спидометром и суммой участков
- журнал путевых листов с поиском и фильтрами
- отчеты и настройки как расширяемые модули

## Доменная логика

Расчеты вынесены в `packages/domain`, чтобы повторно использовать их в frontend, backend, отчетах и будущей мобильной версии.

- округление до 2 знаков
- защита от накопления ошибок с плавающей точкой
- единый объект результата для UI, PDF и экспорта

## Запуск

1. Установить зависимости: `npm install`
2. Запустить интерфейс: `npm run dev:web`
3. При необходимости запустить API: `npm run dev:api`
4. Прогнать тесты доменной логики: `npm test`

## Выкладка По Порядку

### 1. GitHub

- создать репозиторий на GitHub
- выполнить:
  - `git init`
  - `git add .`
  - `git commit -m "Initial fleet MVP"`
  - `git branch -M main`
  - `git remote add origin <your-repo-url>`
  - `git push -u origin main`

### 2. Frontend На Vercel

- импортировать репозиторий из GitHub в Vercel
- root directory: корень репозитория
- Vercel уже может использовать [vercel.json](/Users/pasha/Documents/New%20project/vercel.json)
- env:
  - `VITE_API_URL=https://<your-api-domain>`

### 3. Backend На Render

- создать Web Service из GitHub-репозитория
- Render может использовать [render.yaml](/Users/pasha/Documents/New%20project/render.yaml)
- env:
  - `API_PORT=3010`
  - `CORS_ORIGIN=https://<your-vercel-domain>`
  - `SUPABASE_URL=...`
  - `SUPABASE_SERVICE_ROLE_KEY=...`

### 4. БД На Supabase

- создать проект в Supabase
- получить:
  - `SUPABASE_URL`
  - `SUPABASE_ANON_KEY`
  - `SUPABASE_SERVICE_ROLE_KEY`
- на текущем шаге проект уже подготовлен под env-переменные, а следующим этапом нужно подключить реальные таблицы и API-операции вместо browser storage

## Что Уже Подготовлено Под Онлайн

- [vercel.json](/Users/pasha/Documents/New%20project/vercel.json) для frontend
- [render.yaml](/Users/pasha/Documents/New%20project/render.yaml) для backend
- [.env.example](/Users/pasha/Documents/New%20project/.env.example) и env-шаблоны в `apps/web` и `apps/api`
- backend читает `API_PORT` и `CORS_ORIGIN`

## Следующий Технический Шаг

Чтобы приложение стало реально общим онлайн-продуктом, нам нужно следующим этапом:

- перенести хранение из `localStorage` в backend
- подключить Supabase PostgreSQL
- сделать реальные CRUD-операции для машин, путевок и пользователей

## Следующие этапы

- подключение постоянной БД и миграций
- полноценная авторизация и роли
- генерация PDF/Excel
- ремонтный модуль, шины, ТО, маршруты, вложения, уведомления
