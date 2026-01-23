---
title: "Stratégies de Test"
date: 2025-01-23
category: Knowledge/Methodologies
tags: [testing, quality, strategies, development]
version: 1.0
status: active
---

# Stratégies de Test

## 📋 Vue d'ensemble

Guide des stratégies de test pour assurer la qualité du code et des workflows dans le projet NEMESIS.

## 🎯 Pyramide de tests

```
        /\
       /  \     E2E Tests (10%)
      /----\    - Parcours utilisateur complets
     /      \   - Lents mais réalistes
    /--------\
   /          \  Integration Tests (20%)
  /            \ - Interactions entre composants
 /--------------\ - APIs, bases de données
/                \
/==================\ Unit Tests (70%)
                    - Fonctions isolées
                    - Rapides, nombreux
```

## 🛠️ Tests unitaires

### Principes

#### AAA Pattern (Arrange, Act, Assert)
```typescript
describe('calculateTax', () => {
  it('should calculate tax correctly for standard income', () => {
    // Arrange
    const income = 50000;
    const taxRate = 0.3;

    // Act
    const result = calculateTax(income, taxRate);

    // Assert
    expect(result).toBe(15000);
  });
});
```

#### FIRST Principles
- **F**ast: Exécution rapide
- **I**ndependent: Pas de dépendances entre tests
- **R**epeatable: Même résultat à chaque exécution
- **S**elf-validating: Pass/Fail clair
- **T**imely: Écrits avec le code

### Coverage minimale
| Type de code | Coverage cible |
|--------------|----------------|
| Logique métier | 90%+ |
| Utilitaires | 80%+ |
| API handlers | 70%+ |
| UI components | 60%+ |

### Frameworks recommandés
```
JavaScript/TypeScript:
- Jest (default)
- Vitest (Vite projects)

Python:
- pytest (default)
- unittest (standard library)

React:
- React Testing Library
- Jest
```

### Template de test TypeScript
```typescript
import { describe, it, expect, beforeEach, jest } from '@jest/globals';
import { functionToTest } from './module';

describe('functionToTest', () => {
  // Setup
  beforeEach(() => {
    jest.clearAllMocks();
  });

  // Happy path
  describe('when given valid input', () => {
    it('should return expected result', () => {
      const input = { /* valid data */ };
      const result = functionToTest(input);
      expect(result).toEqual(/* expected */);
    });
  });

  // Edge cases
  describe('edge cases', () => {
    it('should handle empty input', () => {
      expect(functionToTest([])).toEqual([]);
    });

    it('should handle null', () => {
      expect(() => functionToTest(null)).toThrow('Input required');
    });
  });

  // Error cases
  describe('error handling', () => {
    it('should throw on invalid input', () => {
      const invalidInput = { /* invalid */ };
      expect(() => functionToTest(invalidInput)).toThrow(ValidationError);
    });
  });
});
```

## 🔗 Tests d'intégration

### API Testing
```typescript
import request from 'supertest';
import { app } from './app';
import { db } from './database';

describe('POST /api/users', () => {
  beforeAll(async () => {
    await db.connect();
  });

  afterAll(async () => {
    await db.disconnect();
  });

  beforeEach(async () => {
    await db.clear('users');
  });

  it('should create a new user', async () => {
    const userData = {
      email: 'test@example.com',
      name: 'Test User'
    };

    const response = await request(app)
      .post('/api/users')
      .send(userData)
      .expect(201);

    expect(response.body).toMatchObject({
      id: expect.any(String),
      email: userData.email,
      name: userData.name
    });

    // Verify in database
    const dbUser = await db.users.findByEmail(userData.email);
    expect(dbUser).toBeTruthy();
  });

  it('should return 400 for invalid email', async () => {
    const response = await request(app)
      .post('/api/users')
      .send({ email: 'invalid', name: 'Test' })
      .expect(400);

    expect(response.body.error).toContain('email');
  });
});
```

### Database Testing
```typescript
describe('UserRepository', () => {
  let repo: UserRepository;

  beforeEach(async () => {
    repo = new UserRepository(testDb);
    await testDb.clear();
  });

  it('should save and retrieve user', async () => {
    const user = new User({ email: 'test@test.com' });

    await repo.save(user);
    const retrieved = await repo.findById(user.id);

    expect(retrieved).toEqual(user);
  });
});
```

## 🌐 Tests E2E

### Playwright (recommandé)
```typescript
import { test, expect } from '@playwright/test';

test.describe('User Registration Flow', () => {
  test('should complete registration successfully', async ({ page }) => {
    // Navigate
    await page.goto('/register');

    // Fill form
    await page.fill('[data-testid="email"]', 'new@user.com');
    await page.fill('[data-testid="password"]', 'SecurePass123!');
    await page.fill('[data-testid="confirm-password"]', 'SecurePass123!');

    // Submit
    await page.click('[data-testid="submit"]');

    // Verify
    await expect(page).toHaveURL('/dashboard');
    await expect(page.locator('[data-testid="welcome-message"]'))
      .toContainText('Welcome');
  });

  test('should show error for weak password', async ({ page }) => {
    await page.goto('/register');
    await page.fill('[data-testid="password"]', '123');
    await page.click('[data-testid="submit"]');

    await expect(page.locator('[data-testid="error-message"]'))
      .toContainText('Password too weak');
  });
});
```

### Configuration Playwright
```typescript
// playwright.config.ts
import { defineConfig } from '@playwright/test';

export default defineConfig({
  testDir: './e2e',
  timeout: 30000,
  retries: 2,
  workers: 4,
  use: {
    baseURL: 'http://localhost:3000',
    screenshot: 'only-on-failure',
    video: 'retain-on-failure',
    trace: 'retain-on-failure',
  },
  projects: [
    { name: 'chromium', use: { browserName: 'chromium' } },
    { name: 'firefox', use: { browserName: 'firefox' } },
    { name: 'webkit', use: { browserName: 'webkit' } },
  ],
});
```

## 🤖 Tests d'IA / Prompts

### Testing de prompts
```python
import pytest
from ai_client import AIClient

class TestPromptQuality:
    @pytest.fixture
    def client(self):
        return AIClient()

    def test_code_generation_prompt(self, client):
        """Test that code generation prompt produces valid TypeScript."""
        prompt = """
        Generate a TypeScript function that validates email addresses.
        Requirements:
        - Return boolean
        - Handle edge cases
        - Include type annotations
        """

        response = client.generate(prompt)

        # Check structure
        assert 'function' in response or '=>' in response
        assert ': boolean' in response or ':boolean' in response

        # Check it compiles (basic check)
        assert 'return' in response

    def test_analysis_prompt_completeness(self, client):
        """Test that analysis prompt returns all required sections."""
        prompt = """
        Analyze this code and provide:
        1. Summary
        2. Issues found
        3. Recommendations

        Code: [simple code example]
        """

        response = client.generate(prompt)

        required_sections = ['Summary', 'Issues', 'Recommendations']
        for section in required_sections:
            assert section.lower() in response.lower(), \
                f"Missing section: {section}"
```

### Evaluation metrics
```python
def evaluate_response_quality(response, criteria):
    """Evaluate AI response against criteria."""
    scores = {}

    # Completeness
    scores['completeness'] = sum(
        1 for req in criteria['required_elements']
        if req.lower() in response.lower()
    ) / len(criteria['required_elements'])

    # Length appropriateness
    word_count = len(response.split())
    if criteria['min_words'] <= word_count <= criteria['max_words']:
        scores['length'] = 1.0
    else:
        scores['length'] = 0.5

    # Structure
    scores['structure'] = 1.0 if all(
        marker in response for marker in criteria['structure_markers']
    ) else 0.5

    return scores
```

## 📊 Stratégie de test NEMESIS

### Tests de workflows N8N
```javascript
// Test workflow execution
const testWorkflow = async (workflowId, testInput) => {
  const result = await n8n.executeWorkflow(workflowId, testInput);

  return {
    success: result.status === 'success',
    output: result.data,
    executionTime: result.duration,
    errors: result.errors
  };
};

// Test cases
const workflowTests = [
  {
    name: 'Multi-IA Router - Code task',
    input: { task_type: 'code', content: 'Write a function' },
    expectedRoute: 'claude'
  },
  {
    name: 'Multi-IA Router - Research task',
    input: { task_type: 'research', content: 'Find information' },
    expectedRoute: 'perplexity'
  }
];
```

### Tests de contexte sync
```python
def test_context_sync():
    """Test that context synchronizes across platforms."""
    # Update master context
    update_master_context({'key': 'new_value'})

    # Trigger sync
    run_sync_workflow()

    # Verify each platform
    assert get_claude_context()['key'] == 'new_value'
    assert get_chatgpt_context()['key'] == 'new_value'
    assert get_mistral_context()['key'] == 'new_value'
```

## ⚙️ CI/CD Integration

### GitHub Actions
```yaml
name: Test Suite

on: [push, pull_request]

jobs:
  test:
    runs-on: ubuntu-latest

    steps:
      - uses: actions/checkout@v3

      - name: Setup Node
        uses: actions/setup-node@v3
        with:
          node-version: '20'
          cache: 'npm'

      - name: Install dependencies
        run: npm ci

      - name: Run unit tests
        run: npm run test:unit

      - name: Run integration tests
        run: npm run test:integration

      - name: Run E2E tests
        run: npm run test:e2e

      - name: Upload coverage
        uses: codecov/codecov-action@v3
```

### Pre-commit hooks
```yaml
# .pre-commit-config.yaml
repos:
  - repo: local
    hooks:
      - id: test
        name: Run tests
        entry: npm test
        language: system
        pass_filenames: false
        stages: [commit]
```

## 📈 Métriques de qualité

### Objectifs
| Métrique | Cible | Critique |
|----------|-------|----------|
| Unit test coverage | >80% | >60% |
| Integration test coverage | >60% | >40% |
| Test pass rate | >99% | >95% |
| Build time | <10min | <20min |
| Flaky test rate | <1% | <5% |

### Monitoring
```
Dashboard:
- Coverage trends
- Test execution time
- Failure patterns
- Flaky tests tracking
```

---

**Dernière mise à jour**: 2025-01-23
**Prochaine révision**: 2025-02-23
