# Testing Keystatic Custom Actions

This template has been set up to test the custom actions feature.

## Setup

1. Install dependencies:
   ```bash
   cd ~/Code/piktur/keystatic/templates/astro
   npm install
   ```

2. Start dev server:
   ```bash
   npm run dev
   ```

3. Open Keystatic UI:
   ```
   http://localhost:4321/keystatic
   ```

## Test Action

A simple test action has been created at:
- **File**: `src/keystatic/actions/posts/test-action.ts`
- **Collection**: `posts`
- **Action**: "Test Action" (sparkles icon)

### What it does:
1. Prompts you with a confirmation dialog
2. Prepends "TEST: " to the current post title
3. Shows a success toast

### How to test:

1. Navigate to **Collections → Posts**
2. Click "Create" or edit an existing post
3. Enter a title (e.g., "My First Post")
4. Look for the **"Test Action"** button in the toolbar (sparkles icon ✨)
5. Click it
6. Confirm the dialog
7. The title should update to "TEST: My First Post"
8. You should see a success toast

### Expected behavior:
- ✅ Action appears in toolbar
- ✅ Only visible when title field has a value
- ✅ Updates state without page reload
- ✅ Shows toast notification
- ✅ Action persists when you save the entry

## Architecture

```
User clicks "Test Action"
  ↓
src/keystatic/actions/posts/test-action.ts (client)
  ↓ handler() called with ActionContext
  ↓ setState() updates form state
Success toast shown
```

## Action Discovery

Actions are auto-discovered via convention:
- **Pattern**: `/src/keystatic/actions/{collection-name}/*.ts`
- **Loader**: Set in `src/pages/keystatic/[...params].astro`
- **Runtime**: `window.__KS_ACTION_LOADER__` populated by `import.meta.glob()`

## Files Created

```
templates/astro/
├── src/
│   ├── pages/
│   │   └── keystatic/
│   │       └── [...params].astro          # Keystatic mount + action loader
│   └── keystatic/
│       └── actions/
│           └── posts/
│               └── test-action.ts          # Test action
└── TEST_ACTIONS.md                         # This file
```

## Troubleshooting

**Action doesn't appear:**
- Check browser console for errors
- Verify `window.__KS_ACTION_LOADER__` is set
- Check file path matches pattern: `/src/keystatic/actions/posts/*.ts`

**Action fails:**
- Check browser console for error details
- Verify action exports: `key`, `label`, `icon`, `handler`
- Check `condition()` returns true

**State doesn't update:**
- Verify `setState()` is called with full state object
- Check that you're spreading `currentState` first
EOF < /dev/null