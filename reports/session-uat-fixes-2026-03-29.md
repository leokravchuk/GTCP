# GTCP Session Report — UAT Fixes & Repo Maintenance — 2026-03-29

**Дата:** 29.03.2026
**Провёл:** Claude Opus 4.6 + Leo
**Тема:** Пользовательское тестирование, исправление Dashboard, восстановление артефактов, GitHub sync

---

## Что сделано

### 1. Dashboard — Topbar fix
- Убрано хардкод-направление `ХОРГОШ ▸ ГОСПОДЖИНЦЫ` из topbar
- Заменено на динамическую сводку Entry/Exit volumes из активных номинаций
- ✅ Записано: `Soft/GTCP_MVP.html:277` (topbar-flow span)
- ✅ Записано: `Soft/GTCP_MVP.html:1749` (renderDashboard — entryVol/exitVol calc)

### 2. GTCP_Artifacts.md — восстановление
- Файл был пуст после compaction предыдущей сессии
- Восстановлена оригинальная версия v1.0 с ASCII-диаграммами (15 секций, ~450 строк)
- Пользователь отредактировал в IDE → структурированная v1.1 (таблицы)
- По запросу пользователя откачена обратно к v1.0 (ASCII-диаграммы)
- ✅ Записано: `reports/GTCP_Artifacts.md`

### 3. Правило read-only для Artifacts
- Создано правило: `GTCP_Artifacts.md` = уровень NC + CLAUDE.md, только чтение
- ✅ Записано: `~/.claude/projects/.../memory/feedback_artifacts_readonly.md`
- ✅ Обновлён: `MEMORY.md` — добавлена секция "GTCP — Protected Files"

### 4. GitHub — UserGuide v3.0
- Запушен `reports/GTCP_UserGuide_v3.0.docx` + `.md` на GitHub
- Разрешён конфликт: remote был реорганизован пользователем (force push), локальные файлы сохранены
- Удалён дубликат `GTCP_UserGuide_v3.0.md` из корня репозитория
- ✅ Push: коммиты 534c2ff, 4558699

### 5. Backend + Frontend запуск
- Backend: `npm run dev` на порту 3000 (убит занимавший порт процесс PID 52368)
- Frontend: `npx http-server` на порту 5501
- Оба сервера работают

---

## Что не завершено

- [~] Пользовательский опросник: получен 1 баг из 12 разделов (Dashboard topbar). Остальные разделы не протестированы пользователем
- [~] CLAUDE.md обновлён пользователем (nomination deadline 13:00 → 14:00 CET per Art.12.6.1.1) — нужно проверить код nominations.js на соответствие

---

## Решения и обоснования

1. **Dashboard topbar: Entry/Exit volumes вместо направления** — пользователь выбрал вариант C (общая сводка), т.к. одно направление ХОРГОШ→ГОСПОДЖИНЦЫ не отражает реальную картину (7 маршрутов, двусторонний поток)

2. **GTCP_Artifacts.md = protected read-only** — файл получил статус наравне с NC и CLAUDE.md. Причина: содержит выверенные ASCII-диаграммы архитектуры, собранные за Sprint 8–12

3. **GitHub repo = только docx** — пользователь осознанно реорганизовал remote, оставив только UserGuide v3.0. Все рабочие файлы (backend, frontend, migrations) остаются только локально

---

## Следующие шаги

1. **Завершить UAT-опросник** — пользователь тестирует оставшиеся 11 разделов (Contracts, Capacity, Nominations, Billing, Credits, Auctions, Shippers, RBP, Tariffs, UI)
2. **Проверить nomination deadline** — код nominations.js должен использовать 14:00 CET (Art.12.6.1.1), не 13:00
3. **Исправить найденные баги** — по результатам UAT
4. **Sprint 13 планирование** — Analytics + Diploma docs (после завершения UAT)
5. **Git: коммит всех Sprint 8–12 файлов** — migrations, routes, tests, reports — когда пользователь решит добавить их в репозиторий
