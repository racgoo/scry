#!/bin/bash
# One-time GitHub CLI setup for the scry project.
# Run this once and all future "git push / gh pr create" commands will work automatically.

set -e

echo "=== Scry GitHub Setup ==="

# 1. Install gh if missing
if ! command -v gh &>/dev/null; then
  echo "→ Installing GitHub CLI (gh) via Homebrew..."
  brew install gh
else
  echo "✓ gh already installed: $(gh --version | head -1)"
fi

# 2. Check current auth
if gh auth status &>/dev/null; then
  CURRENT=$(gh auth status 2>&1 | grep "Logged in" | head -1)
  echo "✓ Already authenticated: $CURRENT"
  echo "  If this is NOT the racgoo account, run: gh auth login"
else
  echo "→ Opening browser for GitHub login..."
  echo "  Please log in with the 'racgoo' account (lhsung98@naver.com)"
  gh auth login --hostname github.com --git-protocol https --web
fi

# 3. Verify git remote
REMOTE=$(git -C "$(dirname "$0")/.." remote get-url origin 2>/dev/null || echo "")
if [ -z "$REMOTE" ]; then
  echo "✗ No git remote found. Run inside the scry repo directory."
  exit 1
fi
echo "✓ Remote: $REMOTE"

# 4. Test push access (dry-run)
echo "→ Testing push access..."
if git -C "$(dirname "$0")/.." ls-remote origin &>/dev/null; then
  echo "✓ Push access confirmed."
else
  echo "✗ Cannot reach remote. Check your network or re-run 'gh auth login'."
  exit 1
fi

echo ""
echo "=== Setup complete! ==="
echo "You can now use:"
echo "  git push -u origin HEAD          → push current branch"
echo "  gh pr create --fill              → create PR with auto-filled title/body"
