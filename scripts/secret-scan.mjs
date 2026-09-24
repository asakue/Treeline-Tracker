#!/usr/bin/env node

/**
 * Treeline Tracker - Automated Secret & Credential Scanner
 * Pre-commit hook & CI verification script for preventing credential leaks.
 */

import { execSync } from 'node:child_process';
import { readFileSync, existsSync } from 'node:fs';
import { join } from 'node:path';

const isPreCommit = process.argv.includes('--pre-commit');

console.log('🔍 [Treeline Security] Initializing secret scanner...');

// 1. If trufflehog CLI is available on the machine, run it first
try {
  const hasTrufflehog = execSync('which trufflehog 2>/dev/null || true').toString().trim();
  if (hasTrufflehog) {
    console.log('🛡️  TruffleHog CLI found. Executing TruffleHog git scan...');
    execSync('trufflehog filesystem . --fail --exclude-paths=.gitignore', { stdio: 'inherit' });
    console.log('✅ TruffleHog filesystem scan passed.');
  } else {
    console.log('ℹ️  TruffleHog binary not detected locally; running strict built-in credential analysis.');
  }
} catch (err) {
  console.error('❌ TruffleHog detected potential secrets in repository!');
  process.exit(1);
}

// 2. Strict file path restrictions
const FORBIDDEN_FILE_PATTERNS = [
  /^\.env$/,
  /^\.env\.local$/,
  /^\.env\.production$/,
  /^\.env\.development$/,
  /\.pem$/,
  /\.key$/,
  /\.p8$/,
  /id_rsa/,
  /id_ed25519/,
  /firebase.*\.json$/,
  /service-account.*\.json$/
];

// 3. High-risk secret signatures
const SECRET_REGEX_RULES = [
  {
    name: 'Google / Gemini API Key',
    regex: /AIzaSy[A-Za-z0-9-_]{33}/
  },
  {
    name: 'Private Key Block',
    regex: /-----BEGIN\s+(RSA|EC|OPENSSH|DSA|PGP)?\s*PRIVATE KEY-----/
  },
  {
    name: 'Generic AWS Secret Access Key',
    regex: /(?:aws_secret_access_key|AWS_SECRET_ACCESS_KEY)\s*[:=]\s*["']?[A-Za-z0-9/+=]{40}["']?/
  },
  {
    name: 'Hardcoded Bearer Token',
    regex: /Bearer\s+ey[A-Za-z0-9_-]{10,}\.[A-Za-z0-9_-]{10,}\.[A-Za-z0-9_-]{10,}/
  }
];

// Determine list of files to check
let filesToCheck = [];

try {
  if (isPreCommit) {
    // Check staged files in git
    const staged = execSync('git diff --cached --name-only --diff-filter=ACM 2>/dev/null || true')
      .toString()
      .split('\n')
      .map((f) => f.trim())
      .filter(Boolean);
    filesToCheck = staged;
  }
} catch {
  // If not inside git or command failed, fallback
}

// Fallback to tracked git files or common source files
if (filesToCheck.length === 0) {
  try {
    filesToCheck = execSync('git ls-files 2>/dev/null || true')
      .toString()
      .split('\n')
      .map((f) => f.trim())
      .filter(Boolean);
  } catch {
    // Fallback if git is not initialized
    filesToCheck = ['.env.example', 'apphosting.yaml', 'package.json', 'next.config.ts'];
  }
}

let violations = [];

for (const file of filesToCheck) {
  // Check forbidden filenames
  for (const pattern of FORBIDDEN_FILE_PATTERNS) {
    if (pattern.test(file)) {
      violations.push({
        file,
        issue: `Forbidden sensitive file tracked or staged: "${file}". Add to .gitignore!`
      });
    }
  }

  // Check file content for secrets (skip images/binaries/locks)
  if (
    file.endsWith('.png') ||
    file.endsWith('.jpg') ||
    file.endsWith('.ico') ||
    file.endsWith('.lock') ||
    file.endsWith('.woff2') ||
    !existsSync(file)
  ) {
    continue;
  }

  try {
    const content = readFileSync(file, 'utf-8');

    for (const rule of SECRET_REGEX_RULES) {
      if (rule.regex.test(content)) {
        // Exclude template placeholders like 'your_gemini_api_key_here'
        const match = content.match(rule.regex);
        violations.push({
          file,
          issue: `Found potential secret matching pattern "${rule.name}" (${match?.[0]?.slice(0, 8)}...)`
        });
      }
    }
  } catch {
    // Ignore read errors for inaccessible files
  }
}

if (violations.length > 0) {
  console.error('\n🚨 [SECURITY BREACH PREVENTED] Potential secrets detected:');
  for (const v of violations) {
    console.error(`  - ${v.file}: ${v.issue}`);
  }
  console.error('\n🛑 Commit aborted. Remove secret keys or use environment variables via Secret Manager.');
  process.exit(1);
}

console.log(`✅ [Treeline Security] Scanned ${filesToCheck.length} files. Zero secrets or sensitive files detected.`);
process.exit(0);
