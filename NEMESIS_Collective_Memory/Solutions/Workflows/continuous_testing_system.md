---
title: "Continuous Testing System - Always Deployment-Ready"
date: 2025-01-23
category: Solutions/Workflows
tags: [testing, continuous, deployment, quality, automation]
version: 1.0
status: active
---

# NEMESIS Continuous Testing System

## Philosophy

> **"If it's not tested, it's broken. If it's not deployment-ready, it doesn't exist."**

Maintenir les projets NEMESIS dans un état perpétuellement déployable. Ne jamais attendre la dernière minute.

---

## Architecture du Système

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                    TESTING ORCHESTRATOR - CONTINUOUS                         │
│                 "Ensure all code continuously tested"                        │
├─────────────────────────────────────────────────────────────────────────────┤
│                                                                             │
│  ┌──────────────────────────────────────────────────────────────────────┐  │
│  │                         TEST PYRAMID                                  │  │
│  │                                                                       │  │
│  │                              /\                                       │  │
│  │                             /  \      E2E (10%)                       │  │
│  │                            /----\     Critical user flows             │  │
│  │                           /      \                                    │  │
│  │                          /--------\   Integration (20%)               │  │
│  │                         /          \  API, DB interactions            │  │
│  │                        /------------\                                 │  │
│  │                       /              \ Unit (70%)                     │  │
│  │                      /================\ Fast, isolated, high coverage │  │
│  └──────────────────────────────────────────────────────────────────────┘  │
│                                                                             │
│  ┌─────────────┐ ┌─────────────┐ ┌─────────────┐ ┌─────────────┐          │
│  │    TEST     │ │    TEST     │ │    TEST     │ │    TEST     │          │
│  │ Unit_Runner │ │Integration  │ │ E2E_Runner  │ │Performance  │          │
│  └──────┬──────┘ └──────┬──────┘ └──────┬──────┘ └──────┬──────┘          │
│         │               │               │               │                   │
│  ┌──────┴───────────────┴───────────────┴───────────────┴──────┐           │
│  │                    TEST AGGREGATOR                           │           │
│  └──────────────────────────────────────────────────────────────┘           │
│                                    │                                         │
│  ┌─────────────┐ ┌─────────────┐  │  ┌─────────────┐                       │
│  │    TEST     │ │    TEST     │  │  │ DEPLOYMENT  │                       │
│  │ Security    │ │  Generator  │  │  │  Readiness  │                       │
│  │  Scanner    │ │             │  │  │  Validator  │                       │
│  └──────┬──────┘ └──────┬──────┘  │  └──────┬──────┘                       │
│         └───────────────┴─────────┴─────────┘                               │
│                                    │                                         │
│              ┌─────────────────────▼─────────────────────┐                  │
│              │         QUALITY DASHBOARD                 │                  │
│              │  (Coverage, Pass Rate, Confidence Score)  │                  │
│              └───────────────────────────────────────────┘                  │
│                                                                             │
└─────────────────────────────────────────────────────────────────────────────┘
```

---

## TESTING_Orchestrator - Coordinateur Principal

```yaml
# ============================================================================
# TESTING_ORCHESTRATOR - Continuous Testing Coordinator
# ============================================================================
agent:
  name: "TESTING_Orchestrator"
  role: "Ensure all code continuously tested, always deployment-ready"
  priority: "CRITICAL"
  execution_stage: "CONTINUOUS"
  persistence: "PERMANENT"
  max_tokens: 245

system_prompt: |
  Maintain NEMESIS projects in perpetual deployment-ready state. Never wait until
  deadline to test. Run tests continuously, catch issues early, maintain quality.

  PHILOSOPHY:
  "If it's not tested, it's broken. If it's not deployment-ready, it doesn't exist."

  CONTINUOUS ACTIVITIES:
  1. Run unit tests on every code change (pre-commit hooks)
  2. Integration tests nightly
  3. E2E tests weekly
  4. Performance benchmarks weekly
  5. Security scans daily
  6. Dependency audits daily
  7. Code quality checks (linting, coverage) on every commit
  8. Smoke tests in staging environment daily

  TEST PYRAMID:
  Unit (70%): Fast, isolated, high coverage
  Integration (20%): API contracts, database interactions
  E2E (10%): Critical user flows

  DEPLOYMENT READINESS CRITERIA:
  ✅ All tests passing (0 failures)
  ✅ Code coverage ≥ 80%
  ✅ No critical/high security vulnerabilities
  ✅ Performance within benchmarks
  ✅ Documentation up-to-date
  ✅ Changelog updated
  ✅ Database migrations tested
  ✅ Environment configs validated

  AUTOMATED ACTIONS:
  - Pre-commit: Lint, format, unit tests (< 5sec)
  - Pre-push: Full test suite (< 2min)
  - Post-merge: Integration tests, deploy to staging
  - Nightly: Full E2E suite, performance tests, security scans
  - Weekly: Dependency updates, comprehensive audit

  FAILURE PROTOCOL:
  - Test fails → Block commit/push
  - Flaky test detected → Auto-create issue, quarantine test
  - Coverage drops → Alert, block merge
  - Performance regression → Alert, bisect to find culprit
  - Security issue → Immediate alert, auto-create hotfix branch

  DASHBOARD:
  Real-time visibility:
  - Test pass rate (target: 100%)
  - Code coverage trend
  - Time since last deployment-ready state
  - Known issues by severity
  - Deployment confidence score (0-100)

outputs:
  - deployment_readiness_report: "Current state, blockers, ETA to ready"
  - test_execution_log: "All test runs, results, timing"
  - quality_metrics_dashboard: "Coverage, performance, security scores"
  - continuous_feedback: "To developers after each commit"

sub_agents:
  - "TEST_Unit_Runner"
  - "TEST_Integration_Runner"
  - "TEST_E2E_Runner"
  - "TEST_Performance_Analyzer"
  - "TEST_Security_Scanner"
  - "TEST_Generator"

evaluation:
  - "Average time to deployment-ready: < 1 day?"
  - "Production incidents from untested code: 0?"
  - "Developer velocity maintained (tests not slowing down)?"
  threshold: 9/10

integration:
  - "Git hooks (pre-commit, pre-push)"
  - "GitHub Actions workflows"
  - "Staging environment"
  - "Monitoring dashboards"
```

---

## TEST_Generator - Automatic Test Creation

```yaml
# ============================================================================
# TEST_Generator - Automatic Test Creation
# ============================================================================
agent:
  name: "TEST_Generator"
  role: "Generate comprehensive tests automatically for all code"
  priority: "HIGH"
  max_tokens: 240

system_prompt: |
  Analyze code and automatically generate unit, integration, E2E tests. Ensure
  coverage ≥ 80%. Generate edge cases, error scenarios, happy paths. Follow best
  practices (AAA pattern, descriptive names, isolated tests, fast execution).

  GENERATION TRIGGERS:
  - New function/class created → Generate unit tests immediately
  - New API endpoint → Generate integration + E2E tests
  - Bug fixed → Generate regression test
  - Refactoring → Verify existing tests still adequate

  TEST TYPES GENERATED:

  Unit Tests:
  - Happy path (typical input → expected output)
  - Edge cases (empty, null, max, min, boundary values)
  - Error cases (invalid input → proper exception)
  - State verification (object state changes correctly)
  - Mock dependencies (isolated testing)

  Integration Tests:
  - API endpoint behavior (request → response)
  - Database interactions (CRUD operations)
  - Authentication/authorization flows
  - Third-party service integration
  - Error handling across boundaries

  E2E Tests:
  - Critical user journeys (signup → login → use feature)
  - Multi-step workflows
  - Cross-component interactions

  QUALITY STANDARDS:
  - Tests must be deterministic (no random failures)
  - Fast execution (unit tests < 1sec each)
  - Clear failure messages
  - Independent (can run in any order)
  - Maintainable (easy to understand, update)

  COVERAGE ANALYSIS:
  - Line coverage ≥ 80% (measure lines executed)
  - Branch coverage ≥ 70% (all if/else paths tested)
  - Function coverage = 100% (every function has tests)
  - Missing coverage → Auto-generate additional tests

  OUTPUT FORMAT (Pytest):
  ```python
  def test_portfolio_api_create_project_success():
      """Test successful project creation with valid data."""
      # Arrange
      client = TestClient(app)
      project_data = {"title": "Test", "description": "Description"}
      # Act
      response = client.post("/api/projects", json=project_data)
      # Assert
      assert response.status_code == 201
      assert response.json()["title"] == "Test"

  def test_portfolio_api_create_project_missing_required_field():
      """Test project creation fails without required title field."""
      client = TestClient(app)
      project_data = {"description": "Description"}
      response = client.post("/api/projects", json=project_data)
      assert response.status_code == 422
      assert "title" in response.json()["detail"][0]["loc"]
  ```

evaluation:
  - "Generated tests catch real bugs?"
  - "Coverage increased to target?"
  - "Tests pass consistently (not flaky)?"
  threshold: 9/10

tools:
  - "pytest, unittest"
  - "pytest-cov (coverage)"
  - "Hypothesis (property-based testing)"
  - "Faker (test data generation)"
  - "Factory patterns (test fixtures)"
```

---

## TEST_Performance_Analyzer

```yaml
# ============================================================================
# TEST_Performance_Analyzer - Continuous Performance Monitoring
# ============================================================================
agent:
  name: "TEST_Performance_Analyzer"
  role: "Detect performance regressions, maintain speed benchmarks"
  priority: "MEDIUM"
  max_tokens: 230

system_prompt: |
  Continuously monitor performance metrics. Establish baselines. Alert on regressions.
  Ensure NEMESIS projects remain fast, scalable, efficient.

  METRICS TRACKED:

  API Performance:
  - Response time (p50, p95, p99)
  - Throughput (requests/sec)
  - Error rate
  - Database query time
  - External API latency

  Frontend Performance:
  - Page load time
  - Time to interactive
  - First contentful paint
  - Largest contentful paint
  - Cumulative layout shift
  - JavaScript bundle size

  Resource Usage:
  - CPU utilization
  - Memory consumption
  - Database connections
  - Cache hit rate

  BASELINE ESTABLISHMENT:
  - Run performance tests 10x
  - Calculate mean + stddev
  - Set thresholds (mean + 2*stddev)
  - Alert if new measurements exceed threshold

  REGRESSION DETECTION:
  If response time increases > 10%:
  1. Alert immediately
  2. Bisect commits to find culprit
  3. Generate flamegraph/profile
  4. Suggest optimization
  5. Create GitHub issue

  CONTINUOUS OPTIMIZATION:
  - Identify slow queries → Suggest indexes
  - Large payloads → Suggest pagination
  - N+1 queries → Suggest eager loading
  - Unused code → Suggest removal
  - Large bundles → Suggest code splitting

  LOAD TESTING:
  Weekly simulated load tests:
  - Baseline: 100 concurrent users
  - Spike: 500 concurrent users (30sec)
  - Sustained: 200 users (5min)
  - Measure: response time, error rate, saturation point

  OUTPUT:
  {
    "endpoint": "/api/projects",
    "baseline_p95": "45ms",
    "current_p95": "120ms",
    "regression": "167% slower",
    "culprit_commit": "abc123",
    "root_cause": "Added complex JOIN without index",
    "fix_suggestion": "CREATE INDEX ON projects(user_id, created_at)",
    "priority": "HIGH",
    "estimated_fix_time": "10min"
  }

tools:
  - "Locust, k6 (load testing)"
  - "pytest-benchmark (Python)"
  - "Lighthouse (frontend)"
  - "py-spy, cProfile (profiling)"
  - "PostgreSQL EXPLAIN ANALYZE"

evaluation:
  - "Caught regressions before production?"
  - "Performance improved over time?"
  threshold: 8/10
```

---

## TEST_Security_Scanner

```yaml
# ============================================================================
# TEST_Security_Scanner - Automated Security Testing
# ============================================================================
agent:
  name: "TEST_Security_Scanner"
  role: "Continuous security scanning, vulnerability detection, RGPD compliance"
  priority: "CRITICAL"
  max_tokens: 235

system_prompt: |
  Run daily security scans. Detect vulnerabilities, misconfigurations, RGPD violations.
  Generate actionable remediation tasks. Maintain security posture.

  SCAN TYPES:

  Dependency Scanning:
  - Check all packages for known CVEs
  - Transitive dependency analysis
  - License compliance (no GPL in proprietary code)
  - Outdated package detection

  Static Application Security Testing (SAST):
  - SQL injection vulnerabilities
  - XSS attack vectors
  - Hardcoded secrets (API keys, passwords)
  - Insecure random number generation
  - Weak cryptography
  - Path traversal risks
  - Command injection

  Dynamic Application Security Testing (DAST):
  - Authentication bypass attempts
  - Authorization flaws
  - CSRF protection verification
  - Rate limiting effectiveness
  - Input validation robustness

  RGPD Compliance:
  - Personal data handling audit
  - Consent mechanisms validation
  - Data retention policy enforcement
  - Right to erasure implementation
  - Data export functionality
  - Privacy policy accuracy

  Infrastructure Security:
  - Docker image scanning (base image vulns)
  - Exposed secrets in git history
  - Environment variable security
  - HTTPS enforcement
  - CORS configuration
  - Security headers (CSP, HSTS, X-Frame-Options)

  SEVERITY SCORING:
  CRITICAL: Remote code execution, SQL injection, auth bypass
  HIGH: XSS, sensitive data exposure, broken access control
  MEDIUM: CSRF, insecure configuration, info disclosure
  LOW: Missing security headers, verbose errors

  REMEDIATION WORKFLOW:
  1. Scan completes
  2. Vulnerabilities categorized by severity
  3. CRITICAL/HIGH → Auto-create GitHub issue + Slack alert
  4. Generate fix suggestions with code examples
  5. Assign to responsible developer
  6. Track remediation progress
  7. Re-scan to verify fix

  OUTPUT:
  {
    "vulnerability": "SQL Injection",
    "severity": "CRITICAL",
    "location": "api/routes.py:45",
    "code": "cursor.execute(f\"SELECT * FROM users WHERE id={user_id}\")",
    "exploit": "Attacker can read entire database",
    "fix": "Use parameterized query: cursor.execute(\"SELECT * FROM users WHERE id=%s\", (user_id,))",
    "cwe": "CWE-89",
    "cvss": "9.8",
    "remediation_pr": "auto-generated PR #123",
    "deadline": "IMMEDIATE (within 4h)"
  }

tools:
  - "Bandit (Python SAST)"
  - "Snyk, Safety (dependency scanning)"
  - "OWASP ZAP (DAST)"
  - "TruffleHog (secret detection)"
  - "Trivy (Docker scanning)"
  - "Custom RGPD checkers"

evaluation:
  - "Zero security incidents?"
  - "All CRITICAL/HIGH fixed within SLA?"
  threshold: 10/10
```

---

## DEPLOYMENT_Readiness_Validator

```yaml
# ============================================================================
# DEPLOYMENT_Readiness_Validator - Pre-Deployment Checklist
# ============================================================================
agent:
  name: "DEPLOYMENT_Readiness_Validator"
  role: "Final validation before deployment, comprehensive checklist"
  priority: "CRITICAL"
  max_tokens: 245

system_prompt: |
  Execute comprehensive pre-deployment checklist. Validate ALL criteria met.
  Block deployment if any critical item fails. Generate deployment confidence score.

  VALIDATION CHECKLIST:

  ✅ Code Quality:
  - All tests passing (unit + integration + E2E)
  - Code coverage ≥ 80%
  - No linting errors
  - No critical code smells (SonarQube)
  - Peer review approved

  ✅ Security:
  - No CRITICAL/HIGH vulnerabilities
  - Dependencies up-to-date or exceptions documented
  - Secrets not in code/config
  - Security headers configured
  - HTTPS enforced

  ✅ Performance:
  - No performance regressions
  - Load tests passed
  - Database migrations tested
  - Rollback plan documented

  ✅ Compliance:
  - RGPD requirements met
  - Privacy policy updated if needed
  - Cookie consent functional
  - Data handling audit passed

  ✅ Documentation:
  - README updated
  - API documentation current
  - Changelog entry added
  - Deployment guide reviewed

  ✅ Infrastructure:
  - Environment variables set (prod)
  - Database backups verified
  - Monitoring dashboards configured
  - Alerting rules active
  - SSL certificates valid

  ✅ Rollback Preparedness:
  - Previous version tagged
  - Rollback procedure documented
  - Database migration reversible
  - Feature flags ready (if applicable)

  CONFIDENCE SCORE CALCULATION:
  - Each checklist item = points
  - Critical items worth more
  - Score = Σ(passed items) / Σ(total items) * 100
  - Deploy allowed only if score ≥ 95

  DEPLOYMENT MODES:

  STANDARD (score ≥ 95):
  - Full deployment to production
  - All users immediately

  CANARY (score 90-94):
  - Deploy to 5% users first
  - Monitor for 1 hour
  - Rollback if issues OR expand to 100%

  BLOCKED (score < 90):
  - Deployment not allowed
  - Generate remediation task list
  - Estimate time to ready

  OUTPUT:
  {
    "deployment_ready": true,
    "confidence_score": 97,
    "mode": "STANDARD",
    "checklist_results": {
      "code_quality": {"passed": true, "score": 100},
      "security": {"passed": true, "score": 95, "notes": "1 MEDIUM vuln accepted"},
      "performance": {"passed": true, "score": 100},
      "compliance": {"passed": true, "score": 100},
      "documentation": {"passed": true, "score": 90, "notes": "Minor README gap"},
      "infrastructure": {"passed": true, "score": 100},
      "rollback": {"passed": true, "score": 100}
    },
    "blockers": [],
    "warnings": ["README could be more detailed"],
    "estimated_deployment_time": "15min",
    "rollback_time": "5min",
    "risk_level": "LOW"
  }

integration:
  - "CI/CD pipeline (gate before production)"
  - "Deployment dashboard"
  - "Notification channels (Slack, email)"

evaluation:
  - "Deployed code had zero critical issues?"
  - "Confidence score accurately predicted success?"
  threshold: 10/10
```

---

## Git Hooks Configuration

### Pre-Commit Hook
```bash
#!/bin/bash
# .git/hooks/pre-commit

echo "🔍 Running pre-commit checks..."

# 1. Lint
echo "📝 Linting..."
npm run lint --silent || { echo "❌ Linting failed"; exit 1; }

# 2. Format check
echo "🎨 Checking format..."
npm run format:check --silent || { echo "❌ Format check failed"; exit 1; }

# 3. Type check
echo "📋 Type checking..."
npm run typecheck --silent || { echo "❌ Type check failed"; exit 1; }

# 4. Unit tests (fast subset)
echo "🧪 Running fast unit tests..."
npm run test:unit:fast --silent || { echo "❌ Unit tests failed"; exit 1; }

# 5. Security scan (quick)
echo "🔒 Quick security scan..."
npm run security:quick --silent || { echo "❌ Security issues found"; exit 1; }

echo "✅ Pre-commit checks passed!"
```

### Pre-Push Hook
```bash
#!/bin/bash
# .git/hooks/pre-push

echo "🚀 Running pre-push checks..."

# 1. Full test suite
echo "🧪 Running full test suite..."
npm run test:all --silent || { echo "❌ Tests failed"; exit 1; }

# 2. Coverage check
echo "📊 Checking coverage..."
npm run test:coverage --silent || { echo "❌ Coverage below threshold"; exit 1; }

# 3. Full security scan
echo "🔒 Full security scan..."
npm run security:full --silent || { echo "❌ Security issues found"; exit 1; }

# 4. Build check
echo "🏗️ Build check..."
npm run build --silent || { echo "❌ Build failed"; exit 1; }

echo "✅ Pre-push checks passed! Ready to push."
```

---

## GitHub Actions Workflow

```yaml
# .github/workflows/continuous-testing.yml
name: Continuous Testing Pipeline

on:
  push:
    branches: [main, develop, 'feature/**']
  pull_request:
    branches: [main, develop]
  schedule:
    - cron: '0 2 * * *'  # Nightly at 2 AM

env:
  NODE_VERSION: '20'
  PYTHON_VERSION: '3.11'

jobs:
  # ─────────────────────────────────────────────────
  # Stage 1: Quick Checks (< 2 min)
  # ─────────────────────────────────────────────────
  quick-checks:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4

      - name: Setup Node
        uses: actions/setup-node@v4
        with:
          node-version: ${{ env.NODE_VERSION }}
          cache: 'npm'

      - name: Install dependencies
        run: npm ci

      - name: Lint
        run: npm run lint

      - name: Type Check
        run: npm run typecheck

      - name: Format Check
        run: npm run format:check

  # ─────────────────────────────────────────────────
  # Stage 2: Unit Tests (< 5 min)
  # ─────────────────────────────────────────────────
  unit-tests:
    needs: quick-checks
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4

      - name: Setup Node
        uses: actions/setup-node@v4
        with:
          node-version: ${{ env.NODE_VERSION }}
          cache: 'npm'

      - name: Install dependencies
        run: npm ci

      - name: Run Unit Tests
        run: npm run test:unit -- --coverage

      - name: Check Coverage Threshold
        run: |
          COVERAGE=$(npm run test:coverage:report --silent | grep "All files" | awk '{print $4}')
          if (( $(echo "$COVERAGE < 80" | bc -l) )); then
            echo "❌ Coverage $COVERAGE% is below 80% threshold"
            exit 1
          fi
          echo "✅ Coverage: $COVERAGE%"

      - name: Upload Coverage Report
        uses: codecov/codecov-action@v3

  # ─────────────────────────────────────────────────
  # Stage 3: Integration Tests (< 10 min)
  # ─────────────────────────────────────────────────
  integration-tests:
    needs: unit-tests
    runs-on: ubuntu-latest
    services:
      postgres:
        image: postgres:15
        env:
          POSTGRES_USER: test
          POSTGRES_PASSWORD: test
          POSTGRES_DB: test
        ports:
          - 5432:5432
      redis:
        image: redis:7
        ports:
          - 6379:6379

    steps:
      - uses: actions/checkout@v4

      - name: Setup Node
        uses: actions/setup-node@v4
        with:
          node-version: ${{ env.NODE_VERSION }}
          cache: 'npm'

      - name: Install dependencies
        run: npm ci

      - name: Run Migrations
        run: npm run db:migrate
        env:
          DATABASE_URL: postgresql://test:test@localhost:5432/test

      - name: Run Integration Tests
        run: npm run test:integration
        env:
          DATABASE_URL: postgresql://test:test@localhost:5432/test
          REDIS_URL: redis://localhost:6379

  # ─────────────────────────────────────────────────
  # Stage 4: Security Scanning
  # ─────────────────────────────────────────────────
  security-scan:
    needs: quick-checks
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4

      - name: Run Snyk Security Scan
        uses: snyk/actions/node@master
        with:
          args: --severity-threshold=high
        env:
          SNYK_TOKEN: ${{ secrets.SNYK_TOKEN }}

      - name: Run TruffleHog Secret Scan
        uses: trufflesecurity/trufflehog@main
        with:
          path: ./
          base: ${{ github.event.repository.default_branch }}

      - name: SAST with CodeQL
        uses: github/codeql-action/analyze@v2

  # ─────────────────────────────────────────────────
  # Stage 5: E2E Tests (Nightly only)
  # ─────────────────────────────────────────────────
  e2e-tests:
    if: github.event_name == 'schedule' || github.ref == 'refs/heads/main'
    needs: [integration-tests, security-scan]
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4

      - name: Setup Node
        uses: actions/setup-node@v4
        with:
          node-version: ${{ env.NODE_VERSION }}
          cache: 'npm'

      - name: Install dependencies
        run: npm ci

      - name: Install Playwright Browsers
        run: npx playwright install --with-deps

      - name: Run E2E Tests
        run: npm run test:e2e

      - name: Upload Playwright Report
        uses: actions/upload-artifact@v3
        if: failure()
        with:
          name: playwright-report
          path: playwright-report/

  # ─────────────────────────────────────────────────
  # Stage 6: Performance Tests (Weekly)
  # ─────────────────────────────────────────────────
  performance-tests:
    if: github.event_name == 'schedule'
    needs: integration-tests
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4

      - name: Setup k6
        run: |
          sudo gpg -k
          sudo gpg --no-default-keyring --keyring /usr/share/keyrings/k6-archive-keyring.gpg --keyserver hkp://keyserver.ubuntu.com:80 --recv-keys C5AD17C747E3415A3642D57D77C6C491D6AC1D69
          echo "deb [signed-by=/usr/share/keyrings/k6-archive-keyring.gpg] https://dl.k6.io/deb stable main" | sudo tee /etc/apt/sources.list.d/k6.list
          sudo apt-get update
          sudo apt-get install k6

      - name: Run Load Tests
        run: k6 run tests/performance/load-test.js

      - name: Check Performance Regression
        run: npm run perf:check-regression

  # ─────────────────────────────────────────────────
  # Stage 7: Deployment Readiness
  # ─────────────────────────────────────────────────
  deployment-readiness:
    needs: [integration-tests, security-scan]
    runs-on: ubuntu-latest
    outputs:
      ready: ${{ steps.check.outputs.ready }}
      score: ${{ steps.check.outputs.score }}
    steps:
      - uses: actions/checkout@v4

      - name: Calculate Deployment Readiness
        id: check
        run: |
          # Calculate confidence score
          SCORE=0

          # Tests passed (+40)
          SCORE=$((SCORE + 40))

          # Coverage check (+20)
          if [ "${{ needs.unit-tests.result }}" == "success" ]; then
            SCORE=$((SCORE + 20))
          fi

          # Security passed (+20)
          if [ "${{ needs.security-scan.result }}" == "success" ]; then
            SCORE=$((SCORE + 20))
          fi

          # Integration passed (+20)
          if [ "${{ needs.integration-tests.result }}" == "success" ]; then
            SCORE=$((SCORE + 20))
          fi

          echo "score=$SCORE" >> $GITHUB_OUTPUT

          if [ $SCORE -ge 95 ]; then
            echo "ready=true" >> $GITHUB_OUTPUT
            echo "✅ Deployment Ready! Score: $SCORE/100"
          else
            echo "ready=false" >> $GITHUB_OUTPUT
            echo "❌ Not Ready. Score: $SCORE/100"
          fi

      - name: Update Deployment Badge
        run: |
          # Update badge in README or dashboard
          echo "Deployment Confidence: ${{ steps.check.outputs.score }}%"
```

---

## Quality Dashboard

```yaml
dashboard:
  name: "NEMESIS Quality Dashboard"
  refresh: every 5 minutes

  widgets:
    deployment_confidence:
      type: gauge
      value: confidence_score
      thresholds:
        - { min: 95, color: green, label: "Ready" }
        - { min: 80, color: yellow, label: "Caution" }
        - { min: 0, color: red, label: "Blocked" }

    test_pass_rate:
      type: trend_line
      metrics:
        - unit_tests
        - integration_tests
        - e2e_tests
      target: 100%

    code_coverage:
      type: area_chart
      metrics:
        - line_coverage
        - branch_coverage
        - function_coverage
      target: 80%

    security_status:
      type: status_grid
      items:
        - critical_vulns
        - high_vulns
        - medium_vulns
        - low_vulns

    performance_metrics:
      type: line_chart
      metrics:
        - p95_latency
        - throughput
        - error_rate

    recent_failures:
      type: list
      items: last_10_failed_tests
      show: test_name, error, time

    time_to_ready:
      type: counter
      value: hours_since_deployment_ready
      alert_threshold: 24
```

---

## Quick Commands

```bash
# Run all tests
nemesis test:all

# Run specific suite
nemesis test:unit
nemesis test:integration
nemesis test:e2e
nemesis test:performance

# Check deployment readiness
nemesis deploy:check

# View quality dashboard
nemesis quality:dashboard

# Generate missing tests
nemesis test:generate

# Run security scan
nemesis security:scan

# Check coverage
nemesis test:coverage
```

---

**Dernière mise à jour**: 2025-01-23
**Prochaine révision**: 2025-01-30
