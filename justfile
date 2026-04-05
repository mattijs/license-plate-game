# Pull and crop license plate images for one or more states.
# Usage:
#   just pull-plates        # all known states (default: co)
#   just pull-plates co
#   just pull-plates co tx  # when more states are added
pull-plates *states:
    #!/usr/bin/env bash
    set -euo pipefail
    STATES="{{ if states == '' { 'co' } else { states } }}"
    for state in $STATES; do
        case $state in
            co)
                echo "==> [co] Scraping Colorado plates..."
                cd scrapers && uv run co.py --output-dir ../public
                echo "==> [co] Cropping Colorado plates..."
                claude -p "/crop-co-plates"
                ;;
            *)
                echo "Unknown state shorthand: $state"
                echo "Supported: co"
                exit 1
                ;;
        esac
    done
