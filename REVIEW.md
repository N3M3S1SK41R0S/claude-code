# NEMESIS Ultimate Setup Script - Security & Code Review

## Executive Summary

**Script Name:** nemesis_ultimate_setup.sh
**Version:** 3.0
**Review Date:** 2025-10-21
**Overall Assessment:** ⚠️ **NEEDS IMPROVEMENT**

The script has **NO syntax errors** but has several **security concerns** and **best practice violations** that should be addressed before production use.

---

## Security Issues

### 🔴 Critical Issues

#### 1. **Hardcoded Sensitive Paths in Edge Configuration**
- **Location:** `configure_edge()` function (lines ~260-290)
- **Issue:** Edge Preferences file uses single quotes in heredoc which prevents variable expansion
- **Risk:** Configuration will contain literal `$WORKSPACE_DIR` and `$HOME` strings instead of expanded paths
- **Fix:** Use double quotes or proper variable substitution

#### 2. **Unsafe Variable Substitution in Scripts**
- **Location:** Multiple heredocs throughout
- **Issue:** Scripts generated with single-quoted heredocs won't expand variables
- **Risk:** Scripts will fail at runtime with undefined variable references
- **Fix:** Use double-quoted heredocs or escape appropriately

#### 3. **Sudo Keep-Alive Background Process**
- **Location:** `check_sudo()` function (line ~115)
- **Issue:** Background process continuously refreshes sudo without timeout
- **Risk:** If script hangs, sudo remains active indefinitely
- **Fix:** Add proper cleanup trap and timeout mechanism

#### 4. **Plaintext API Keys in .env File**
- **Location:** `create_env_file()` function
- **Issue:** While .env pattern is acceptable, no encryption or secure storage guidance
- **Risk:** Keys stored in plaintext on disk
- **Mitigation:** Add guidance for using secret managers (e.g., pass, vault)

### 🟡 Medium Issues

#### 5. **Missing Input Validation**
- **Issue:** User input not validated (e.g., y/n prompts accept any input)
- **Risk:** Unexpected behavior if user provides invalid input
- **Fix:** Add proper input validation loops

#### 6. **Network Operations Without Retry Logic**
- **Issue:** Only exit code 100 triggers retry, but many network operations don't set this
- **Risk:** Transient network failures cause installation to abort
- **Fix:** Implement comprehensive retry logic with exponential backoff

#### 7. **Missing Integrity Checks**
- **Issue:** No SHA verification for downloaded packages (Edge, Node.js)
- **Risk:** Potential man-in-the-middle attacks
- **Fix:** Verify GPG signatures and checksums

#### 8. **Directory Creation Without Permission Checks**
- **Issue:** `mkdir -p` doesn't verify write permissions
- **Risk:** Silent failures or permission errors later
- **Fix:** Check directory creation success and permissions

---

## Best Practice Violations

### Code Quality

#### 1. **Inconsistent Error Handling**
- `set -e` is used but many commands use `|| log` which prevents propagation
- `trap` only catches ERR but not EXIT, INT, or TERM
- **Recommendation:** Use consistent error handling pattern

#### 2. **Magic Numbers**
- Port `10000` hardcoded in multiple places
- Sleep durations (`3`, `5`, `60`) without explanation
- **Recommendation:** Define constants at script top

#### 3. **Mixed Language in Output**
- French messages mixed with English
- **Recommendation:** Choose one language or implement i18n

#### 4. **Long Functions**
- Several functions exceed 50 lines
- **Recommendation:** Break into smaller, testable units

#### 5. **No Dry-Run Mode**
- Script performs destructive operations immediately
- **Recommendation:** Add `--dry-run` flag

#### 6. **No Rollback Mechanism**
- If installation fails mid-way, no cleanup
- **Recommendation:** Implement transaction-like rollback

### Logging & Monitoring

#### 7. **Unbounded Log Files**
- No log rotation or size limits
- **Recommendation:** Implement log rotation

#### 8. **Missing Timestamps in Some Outputs**
- Console output doesn't always include timestamps
- **Recommendation:** Consistent timestamp usage

### Dependencies

#### 9. **No Version Pinning**
- npm packages use `latest` which is unstable
- **Recommendation:** Pin specific versions

#### 10. **No Dependency Verification**
- MCP packages from npm not verified
- **Recommendation:** Check package signatures

---

## Functional Issues

### 1. **Edge Configuration Won't Work**
```bash
# Current (BROKEN):
cat > "$EDGE_CONFIG_DIR/Preferences" << 'EOF'
{
   "homepage": "file://'$WORKSPACE_DIR'/html/nemesis_workspace.html",
}
EOF

# This creates: file://'$WORKSPACE_DIR'/html/...
# Should create: file:///home/user/.nemesis/workspace/html/...
```

**Fix:** Use double quotes or `envsubst`

### 2. **Launch Scripts Have Same Issue**
```bash
# launch_edge_nemesis.sh won't work because variables aren't expanded
cat > "$SCRIPTS_DIR/launch_edge_nemesis.sh" << 'EOF'
microsoft-edge \
    "file://'$WORKSPACE_DIR'/html/nemesis_workspace.html"
EOF
```

### 3. **MCP Server.js Has Incorrect Process Variable**
```javascript
// Naming conflict: 'process' variable shadows Node.js global
const process = spawn(config.command, config.args, {
    env: { ...process.env, ...config.env },  // This will fail!
});
```

### 4. **Desktop Launcher References Non-Existent Icon**
```ini
Icon=$NEMESIS_HOME/workspace/assets/nemesis_icon.png
```
This file is never created by the script.

---

## Performance Issues

### 1. **Sequential Package Installation**
- All apt packages installed one transaction
- **Impact:** Slower than necessary
- **Fix:** Already batched, but could parallelize other operations

### 2. **No Caching Mechanism**
- Re-downloads everything on every run
- **Fix:** Check for existing downloads, use caching

---

## Missing Features

### 1. **No Uninstall Script**
- No clean way to remove NEMESIS
- **Recommendation:** Create uninstall.sh

### 2. **No Update Mechanism**
- No way to update existing installation
- **Recommendation:** Add update detection and migration

### 3. **No System Requirements Check**
- Doesn't verify Ubuntu version, available disk space, RAM
- **Recommendation:** Add pre-flight checks

### 4. **No Backup Before Modification**
- Overwrites existing configurations
- **Recommendation:** Backup before modifying

### 5. **No Health Check**
- After installation, no verification that services work
- **Recommendation:** Add smoke tests

---

## Compatibility Issues

### 1. **Ubuntu-Only**
- Script assumes Ubuntu/Debian
- Commands like `apt-get` won't work on Fedora, Arch, etc.
- **Recommendation:** Add OS detection or document limitations

### 2. **Architecture Assumptions**
- Hardcodes `amd64` for Edge installation
- Won't work on ARM systems
- **Fix:** Detect architecture dynamically

### 3. **Missing WSL Detection**
- Microsoft Edge installation differs on WSL
- **Fix:** Detect WSL and adjust accordingly

---

## Documentation Issues

### 1. **Incomplete Error Messages**
- Generic errors don't guide user to solution
- **Fix:** Provide actionable error messages

### 2. **No Inline Documentation**
- Functions lack docstrings
- **Fix:** Add function headers explaining purpose, parameters, returns

### 3. **Missing Prerequisites Section**
- Doesn't list what user needs before running
- **Fix:** Add requirements section in header

---

## Recommendations Priority

### 🔴 **High Priority (Fix Before Use)**

1. Fix heredoc variable expansion issues
2. Create missing icon file or remove desktop launcher reference
3. Fix variable naming conflict in server.js
4. Add basic input validation
5. Add system requirements check

### 🟡 **Medium Priority (Improve Reliability)**

1. Implement comprehensive retry logic
2. Add rollback mechanism
3. Pin npm package versions
4. Add integrity checks for downloads
5. Improve error messages

### 🟢 **Low Priority (Nice to Have)**

1. Add dry-run mode
2. Create uninstall script
3. Add update mechanism
4. Implement log rotation
5. Add health checks
6. Support multiple architectures/distributions

---

## Refactoring Suggestions

### Split Into Modules

```bash
nemesis-setup/
├── setup.sh              # Main orchestrator
├── lib/
│   ├── colors.sh         # Color definitions
│   ├── logging.sh        # Logging functions
│   ├── validation.sh     # Input validation
│   ├── network.sh        # Network retry logic
│   └── error-handling.sh # Error handlers
├── installers/
│   ├── system-deps.sh
│   ├── edge.sh
│   ├── nodejs.sh
│   ├── python.sh
│   └── mcp.sh
└── config/
    ├── mcp_config.json
    └── env.template
```

### Add Configuration File

Instead of hardcoding values, use a config file:

```bash
# nemesis.conf
NEMESIS_VERSION="3.0.0"
NODE_VERSION="20"
PYTHON_VERSION="3.11"
MCP_PORT="10000"
LOG_RETENTION_DAYS="30"
```

---

## Security Hardening Checklist

- [ ] Implement SHA256 verification for downloads
- [ ] Add GPG signature verification
- [ ] Use `set -euo pipefail` instead of just `set -e`
- [ ] Sanitize all user inputs
- [ ] Add timeout to sudo keep-alive
- [ ] Don't log sensitive information
- [ ] Add permission checks before operations
- [ ] Implement secure cleanup on failure
- [ ] Add rate limiting for retries
- [ ] Use dedicated service account instead of user's home directory

---

## Testing Recommendations

### Unit Tests
- Test each function in isolation
- Mock external dependencies

### Integration Tests
- Test on clean Ubuntu 20.04, 22.04, 24.04 VMs
- Test with existing NEMESIS installation
- Test with missing dependencies

### Edge Cases
- No internet connection
- Partial installation recovery
- Disk full scenario
- Permission denied scenarios
- Concurrent execution

---

## Compliance & Legal

### License
- Script doesn't include license header
- **Recommendation:** Add license (MIT, GPL, etc.)

### Attribution
- Uses third-party code/patterns without attribution
- **Recommendation:** Add credits section

### Data Privacy
- No mention of data collection or telemetry
- **Recommendation:** Add privacy policy if applicable

---

## Conclusion

The script is **functional for basic use cases** but requires **significant improvements** for production deployment. The most critical issues are:

1. **Broken variable expansion** in heredocs (will cause runtime failures)
2. **Missing error recovery** mechanisms
3. **Lack of validation** and sanity checks

**Recommendation:** Use the improved version (`nemesis_ultimate_setup_v2.sh`) which addresses these issues.

**Risk Level:** 🟡 **MEDIUM** - Usable with caution, not production-ready

---

## Change Log

### Version 3.1 (Recommended Improvements)
- ✅ Fixed heredoc variable expansion
- ✅ Added input validation
- ✅ Implemented retry logic with exponential backoff
- ✅ Added system requirements check
- ✅ Created missing icon file
- ✅ Fixed variable naming conflicts
- ✅ Added rollback mechanism
- ✅ Pinned dependency versions
- ✅ Added dry-run mode
- ✅ Improved error messages
- ✅ Added health checks
- ✅ Created uninstall script

---

**Reviewer:** Claude (Automated Code Review)
**Date:** 2025-10-21
**Next Review:** After implementing high-priority fixes
