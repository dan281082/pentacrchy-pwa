#====================================================================================================
# START - Testing Protocol - DO NOT EDIT OR REMOVE THIS SECTION
#====================================================================================================

# THIS SECTION CONTAINS CRITICAL TESTING INSTRUCTIONS FOR BOTH AGENTS
# BOTH MAIN_AGENT AND TESTING_AGENT MUST PRESERVE THIS ENTIRE BLOCK

# Communication Protocol:
# If the `testing_agent` is available, main agent should delegate all testing tasks to it.
#
# You have access to a file called `test_result.md`. This file contains the complete testing state
# and history, and is the primary means of communication between main and the testing agent.
#
# Main and testing agents must follow this exact format to maintain testing data. 
# The testing data must be entered in yaml format Below is the data structure:
# 
## user_problem_statement: {problem_statement}
## backend:
##   - task: "Task name"
##     implemented: true
##     working: true  # or false or "NA"
##     file: "file_path.py"
##     stuck_count: 0
##     priority: "high"  # or "medium" or "low"
##     needs_retesting: false
##     status_history:
##         -working: true  # or false or "NA"
##         -agent: "main"  # or "testing" or "user"
##         -comment: "Detailed comment about status"
##
## frontend:
##   - task: "Task name"
##     implemented: true
##     working: true  # or false or "NA"
##     file: "file_path.js"
##     stuck_count: 0
##     priority: "high"  # or "medium" or "low"
##     needs_retesting: false
##     status_history:
##         -working: true  # or false or "NA"
##         -agent: "main"  # or "testing" or "user"
##         -comment: "Detailed comment about status"
##
## metadata:
##   created_by: "main_agent"
##   version: "1.0"
##   test_sequence: 0
##   run_ui: false
##
## test_plan:
##   current_focus:
##     - "Task name 1"
##     - "Task name 2"
##   stuck_tasks:
##     - "Task name with persistent issues"
##   test_all: false
##   test_priority: "high_first"  # or "sequential" or "stuck_first"
##
## agent_communication:
##     -agent: "main"  # or "testing" or "user"
##     -message: "Communication message between agents"

# Protocol Guidelines for Main agent
#
# 1. Update Test Result File Before Testing:
#    - Main agent must always update the `test_result.md` file before calling the testing agent
#    - Add implementation details to the status_history
#    - Set `needs_retesting` to true for tasks that need testing
#    - Update the `test_plan` section to guide testing priorities
#    - Add a message to `agent_communication` explaining what you've done
#
# 2. Incorporate User Feedback:
#    - When a user provides feedback that something is or isn't working, add this information to the relevant task's status_history
#    - Update the working status based on user feedback
#    - If a user reports an issue with a task that was marked as working, increment the stuck_count
#    - Whenever user reports issue in the app, if we have testing agent and task_result.md file so find the appropriate task for that and append in status_history of that task to contain the user concern and problem as well 
#
# 3. Track Stuck Tasks:
#    - Monitor which tasks have high stuck_count values or where you are fixing same issue again and again, analyze that when you read task_result.md
#    - For persistent issues, use websearch tool to find solutions
#    - Pay special attention to tasks in the stuck_tasks list
#    - When you fix an issue with a stuck task, don't reset the stuck_count until the testing agent confirms it's working
#
# 4. Provide Context to Testing Agent:
#    - When calling the testing agent, provide clear instructions about:
#      - Which tasks need testing (reference the test_plan)
#      - Any authentication details or configuration needed
#      - Specific test scenarios to focus on
#      - Any known issues or edge cases to verify
#
# 5. Call the testing agent with specific instructions referring to test_result.md
#
# IMPORTANT: Main agent must ALWAYS update test_result.md BEFORE calling the testing agent, as it relies on this file to understand what to test next.

#====================================================================================================
# END - Testing Protocol - DO NOT EDIT OR REMOVE THIS SECTION
#====================================================================================================



#====================================================================================================
# Testing Data - Main Agent and testing sub agent both should log testing data below this section
#====================================================================================================

user_problem_statement: >
  Private leftover-vial storefront for members of an existing Telegram group-buy community.
  Not a group-buy platform. Surplus stock from group buys is sold here as individual units while
  stock lasts, with WooCommerce as the source of truth. Customer flow: Register → Telegram username
  captured → account approval → Available Vials → Basket → Checkout → Payment → My Orders → Tracking.
  Keep proven auth/basket/checkout/orders/tracking/security architecture. Do NOT add group-buy mgmt,
  pledges, deadlines, min-buy, loyalty, affiliates, coupons or trade accounts. Build against mock data
  (staging API is blocked by SiteGround WAF).

frontend:
  - task: "Member registration with required Telegram username + auto-approval"
    implemented: true
    working: "NA"
    file: "app/(auth)/register.tsx, src/api/auth/mock.ts, src/utils/telegram.ts"
    stuck_count: 0
    priority: "high"
    needs_retesting: true
    status_history:
        -working: "NA"
        -agent: "main"
        -comment: "Register screen validates first name, email, Telegram (required, 5-32 a-z/0-9/_), password>=8. Valid Telegram auto-approves and routes to tabs. Duplicate email/telegram rejected."
  - task: "Login + session restore + approval gating state machine"
    implemented: true
    working: true
    file: "src/context/auth.tsx, app/(auth)/login.tsx, app/index.tsx"
    stuck_count: 0
    priority: "high"
    needs_retesting: true
    status_history:
        -working: true
        -agent: "main"
        -comment: "Smoke-tested via screenshot: login as demo@apeps.co.uk (approved) routes to home. Pending account should route to lock screen. Guards in (tabs)/_layout, (auth)/_layout, pending.tsx."
  - task: "Pending approval lock screen"
    implemented: true
    working: "NA"
    file: "app/pending.tsx"
    stuck_count: 0
    priority: "high"
    needs_retesting: true
    status_history:
        -working: "NA"
        -agent: "main"
        -comment: "Login as pending@apeps.co.uk/Password123 should show lock screen with Telegram handle, Check approval status, and Sign out. Tabs must not be reachable."
  - task: "My Orders list + order detail with tracking timeline"
    implemented: true
    working: "NA"
    file: "app/(tabs)/orders.tsx, app/order/[id].tsx, src/api/orders/mock.ts, src/hooks/use-orders.ts"
    stuck_count: 0
    priority: "high"
    needs_retesting: true
    status_history:
        -working: "NA"
        -agent: "main"
        -comment: "Orders tab lists 3 mock orders with status pills; tapping opens detail with items + tracking timeline (Royal Mail) and Track button."
  - task: "Basket without coupons + secure website checkout"
    implemented: true
    working: "NA"
    file: "app/basket.tsx, src/store/basket-store.ts"
    stuck_count: 0
    priority: "medium"
    needs_retesting: true
    status_history:
        -working: "NA"
        -agent: "main"
        -comment: "Coupon UI/store fully removed. Checkout button opens website /checkout (fallback). Stock limit respected via QuantityStepper max=lowStockRemaining."
  - task: "Shop renamed to Available Vials; Home simplified; modules trimmed to Live tracking"
    implemented: true
    working: true
    file: "app/(tabs)/_layout.tsx, app/(tabs)/shop.tsx, app/(tabs)/index.tsx, src/modules/registry.ts, src/config/feature-flags.ts"
    stuck_count: 0
    priority: "medium"
    needs_retesting: true
    status_history:
        -working: true
        -agent: "main"
        -comment: "Smoke-tested: Vials tab + 'Available now' rail render. Loyalty/referral/refill/reward/qr/etc modules removed; only live-tracking remains (not surfaced as a hub)."
  - task: "Account screen real member profile + sign out"
    implemented: true
    working: "NA"
    file: "app/(tabs)/account.tsx"
    stuck_count: 0
    priority: "medium"
    needs_retesting: true
    status_history:
        -working: "NA"
        -agent: "main"
        -comment: "Shows member name/email/Telegram + Approved badge. Sign out returns to login. Ecosystem module block removed."

metadata:
  created_by: "main_agent"
  version: "1.1"
  test_sequence: 1
  run_ui: true

test_plan:
  current_focus:
    - "Member registration with required Telegram username + auto-approval"
    - "Pending approval lock screen"
    - "My Orders list + order detail with tracking timeline"
    - "Login + session restore + approval gating state machine"
  stuck_tasks: []
  test_all: false
  test_priority: "high_first"

agent_communication:
    -agent: "main"
    -message: >
      Repositioned the app to a private members' leftover-vial storefront and built the full auth +
      approval flow against MOCK data (live staging API is blocked by SiteGround WAF; do not attempt
      live calls). Please test FRONTEND ONLY. Seeded mock accounts (auto-created on first launch):
      approved = demo@apeps.co.uk / Password123 ; pending = pending@apeps.co.uk / Password123.
      Focus: (1) Register with a valid Telegram username -> auto-approved -> lands on tabs; invalid/empty
      Telegram shows field error; duplicate email/telegram rejected. (2) Login as pending account -> shows
      "Pending approval" lock screen, tabs NOT reachable, Sign out works. (3) Login as approved -> tabs;
      My Orders lists orders, order detail shows tracking timeline. (4) Basket has NO coupon field; checkout
      button present. (5) Account shows Telegram + Approved badge; Sign out returns to login. Backend (WP PHP
      plugin) cannot be tested in this environment.
