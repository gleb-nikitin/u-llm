# Claude Agent SDK — Памятка

Справочник по функциям SDK v0.1.77 для ежедневного использования.

---

## Главное: query()

Единственная точка входа. Каждый вызов = один цикл "запрос → работа агента → ответ".

```typescript
const result = await query({
  prompt: "текст сообщения",
  options: { /* см. ниже */ }
});
```

Процесс запускается, работает (может делать tool use внутри), возвращает результат и завершается.
Между вызовами процесс не живёт. Состояние — только файлы на диске.

---

## Options — что можно передать

### Сессия

| Option | Что делает | Твой кейс |
|--------|-----------|-----------|
| `resume: sessionId` | Продолжить существующую сессию (загрузить историю) | CTO, Secretary |
| `forkSession: true` | При resume создать копию, оригинал не трогать | CTO: fork от golden checkpoint |
| `persistSession: true/false` | Сохранять сессию на диск (default: true) | `false` для exec/audit/git |
| `continue: true` | Продолжить последнюю сессию по времени | Не используем (явный resume по ID надёжнее) |
| `resumeSessionAt: messageUUID` | Продолжить до конкретного сообщения, обрезать остальное | Потенциально для отката CTO |

### Модель

| Option | Что делает | Твой кейс |
|--------|-----------|-----------|
| `model: string` | Какую модель использовать | Из participant ID: `o`→opus, `s`→sonnet |
| `fallbackModel: string` | Запасная модель если основная упала | Можно sonnet как fallback для opus |

### Промпт

| Option | Что делает | Твой кейс |
|--------|-----------|-----------|
| `systemPrompt: string` | Полная замена system prompt (без дефолтов SDK) | Не используем |
| `systemPrompt: { type: 'preset', preset: 'claude_code', append: '...' }` | Дефолты SDK + tools + твой текст | Основной вариант. Append = роль + контекст |

Append — это где живёт роль агента, контекст проекта, курированная история. SDK-дефолты дают агенту умение работать с файлами, bash, tool use.

### Разрешения

| Option | Что делает | Твой кейс |
|--------|-----------|-----------|
| `permissionMode: 'bypassPermissions'` | Агент делает всё без подтверждений | Используем везде |
| `permissionMode: 'acceptEdits'` | Авто-принимает правки файлов, спрашивает остальное | Не используем |
| `permissionMode: 'plan'` | Только планирует, не выполняет | Потенциально для CTO (только думать, не кодить) |
| `permissionMode: 'default'` | Спрашивает подтверждение на всё | Не используем (ломает автоматику) |

### Лимиты

| Option | Что делает | Твой кейс |
|--------|-----------|-----------|
| `maxTurns: number` | Макс шагов за один query() | 200 (высокий, для длинных задач 8-10 мин) |
| `maxBudgetUsd: number` | Макс бюджет в долларах | Не ставим, только логируем |

maxTurns = safety net. Один turn = одно обращение к модели. Агент который пишет файл, запускает тест, видит ошибку, фиксит = 4+ turns. 200 turns хватит на длинные спеки.

### Инструменты

| Option | Что делает | Твой кейс |
|--------|-----------|-----------|
| `mcpServers: Record<string, McpServerConfig>` | Подключить MCP серверы | Локальный поиск, shell, chain protocol |
| `allowedTools: string[]` | Разрешить только эти tools | Не используем (bypassPermissions) |
| `disallowedTools: string[]` | Заблокировать эти tools | Потенциально: запретить CTO запускать код |

### Конфиг

| Option | Что делает | Твой кейс |
|--------|-----------|-----------|
| `settingSources: ['project']` | Загрузить CLAUDE.md из рабочей директории | Не используем (контекст через append) |
| `cwd: string` | Рабочая директория агента | Per-project путь |
| `env: Record<string, string>` | Переменные окружения | При необходимости |

### Прерывание

| Option | Что делает |
|--------|-----------|
| `abortController: AbortController` | Отменить работающий query() извне |

```typescript
const ac = new AbortController();
const result = query({ prompt: "...", options: { abortController: ac } });
// Позже: ac.abort();
```

---

## Что приходит в ответ

### Init message (начало сессии)

```typescript
if (msg.type === 'system' && msg.subtype === 'init') {
  sessionId = msg.session_id;  // сохранить!
}
```

Приходит один раз при создании новой сессии. При resume — сессия уже известна.

### Result message (конец работы)

```typescript
if (msg.type === 'result') {
  msg.subtype;        // 'success' | 'error_max_turns' | 'error_max_budget_usd' | ...
  msg.session_id;     // ID сессии
  msg.total_cost_usd; // сколько стоил этот query
  msg.num_turns;      // сколько шагов сделал
  msg.usage;          // детали по токенам
  msg.result;         // текст ответа (только при success)
}
```

### Compact boundary (автосжатие)

```typescript
if (msg.type === 'system' && msg.subtype === 'compact_boundary') {
  // SDK автоматически сжал историю
  msg.compact_metadata.pre_tokens;  // сколько токенов было до сжатия
}
```

Происходит автоматически когда контекст подходит к лимиту. У нас не должно случаться — CTO на fork, остальные ephemeral.

---

## Где живут сессии на диске

```
~/.claude/projects/<encoded-cwd>/<session-id>.jsonl
```

`encoded-cwd` генерируется из рабочей директории (`cwd`). Каждый проект — свой namespace.

Файлы маленькие, копятся, чистить не надо.

---

## Prompt caching (автоматический)

SDK кэширует неизменную часть запроса. Не нужно настраивать.

| Что | Кэшируется? | Стоимость при повторе |
|-----|------------|----------------------|
| System prompt + append | Да | 0.1x (в 10 раз дешевле) |
| Tool definitions | Да | 0.1x |
| История диалога (неизменная часть) | Да | 0.1x |
| Новые сообщения | Нет | 1.0x (полная цена) |

TTL кэша: 5 минут (стандартный). Если между запросами прошло больше — кэш протух, всё платится заново как cache write (1.25x).

Для твоего workflow (30-60 мин между обращениями к CTO) кэш не помогает. Но это не проблема — fork-сессии CTO растут медленно, а рабочие агенты ephemeral (маленький контекст).

---

## Паттерны использования в u-llm

### Fresh (exec, audit, git, research)
```typescript
query({
  prompt: message,
  options: {
    systemPrompt: { type: 'preset', preset: 'claude_code', append: roleContext },
    model: 'claude-sonnet-4-5',
    permissionMode: 'bypassPermissions',
    maxTurns: 200,
    persistSession: false,
  }
});
```

### Resume (secretary)
```typescript
query({
  prompt: message,
  options: {
    resume: savedSessionId,  // из прошлого вызова
    systemPrompt: { type: 'preset', preset: 'claude_code', append: SECRETARY_PROMPT },
    model: 'claude-sonnet-4-5',
    permissionMode: 'bypassPermissions',
    maxTurns: 200,
    persistSession: true,
  }
});
```

### Fork (CTO — создать бранч от golden checkpoint)
```typescript
query({
  prompt: message,
  options: {
    resume: originalSessionId,
    forkSession: true,        // новый ID, оригинал не трогаем
    systemPrompt: { type: 'preset', preset: 'claude_code', append: CTO_PROMPT },
    model: 'claude-opus-4-5',
    permissionMode: 'bypassPermissions',
    maxTurns: 200,
    persistSession: true,
  }
});
// Сохранить новый session_id как branchSessionId
```

### Resume branch (CTO — продолжить работу в бранче)
```typescript
query({
  prompt: message,
  options: {
    resume: branchSessionId,  // бранч, не оригинал
    forkSession: false,       // дефолт — дописываем в бранч
    systemPrompt: { type: 'preset', preset: 'claude_code', append: CTO_PROMPT },
    model: 'claude-opus-4-5',
    permissionMode: 'bypassPermissions',
    maxTurns: 200,
    persistSession: true,
  }
});
```

### Save (CTO — бранч становится новым оригиналом)
```
originalSessionId = branchSessionId
branchSessionId = null
// Следующее сообщение создаст новый fork
```

---

## Чего НЕ делать

- Не ставить `maxBudgetUsd` — молчаливая смерть агента при превышении
- Не использовать `settingSources` — контекст через append, не через CLAUDE.md файлы
- Не парсить JSONL сессий — не нужно
- Не писать свою компакцию — SDK справляется, но у нас она не должна срабатывать
- Не держать длинные сессии для рабочих агентов — fresh дешевле и чище
- Не полагаться на кэш при интервалах >5 мин между запросами
