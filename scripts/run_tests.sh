#!/usr/bin/env bash
set -e

PHASE="${1:-all}"
PROJECT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"

cd "$PROJECT_DIR"

case "$PHASE" in
  phase1)   python3 -m pytest tests/test_phase1_foundation.py -v ;;
  phase2)   python3 -m pytest tests/test_phase2_tools.py -v ;;
  phase3)   python3 -m pytest tests/test_phase3_workflows.py -v ;;
  phase4)   python3 -m pytest tests/test_phase4_agents.py -v -m "not slow" ;;
  phase4-slow) python3 -m pytest tests/test_phase4_agents.py -v -m slow ;;
  phase5)   python3 -m pytest tests/test_phase5_integration.py -v -m "not slow" ;;
  phase7)   python3 -m pytest tests/test_phase7_e2e.py -v -m slow ;;
  backend)  python3 -m pytest tests/ -v -m "not slow" ;;
  backend-slow) python3 -m pytest tests/ -v ;;
  frontend)
    cd frontend
    npx next build
    ;;
  all)
    echo "=== Backend Tests (fast) ==="
    python3 -m pytest tests/ -v -m "not slow"
    echo ""
    echo "=== Frontend Build ==="
    cd frontend
    npx next build
    ;;
  *)
    echo "Usage: $0 {phase1|phase2|phase3|phase4|phase4-slow|phase5|phase7|backend|backend-slow|frontend|all}"
    exit 1
    ;;
esac
