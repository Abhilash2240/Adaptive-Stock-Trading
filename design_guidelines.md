# Design Guidelines: AI Trading Platform with Deep Reinforcement Learning

## Design Approach: Carbon Design System

**Rationale**: Carbon Design System (IBM) is purpose-built for data-intensive enterprise applications with complex workflows, real-time metrics, and multi-role interfaces. It excels at information density while maintaining clarity—perfect for a trading platform displaying Q-values, loss curves, portfolio metrics, and real-time market data.

**Key Principles**:
- Data clarity over decoration
- Immediate visual hierarchy for critical information (P/L, positions, alerts)
- Consistent patterns across Dashboard, Backtesting, Training, and Portfolio views
- Clear status indicators for Paper Trading vs Live Trading modes
- Professional, trustworthy aesthetic appropriate for financial applications

---

## Typography System

**Font Stack**: IBM Plex Sans (via Google Fonts CDN) + IBM Plex Mono for code/numerical data

**Hierarchy**:
- **Hero/Page Titles**: 3xl (36px), font-bold, tracking-tight
- **Section Headers**: 2xl (24px), font-semibold
- **Card Titles/Metrics Headers**: xl (20px), font-semibold
- **Body Text**: base (16px), font-normal
- **Small Labels/Captions**: sm (14px), font-medium
- **Numerical Data/Metrics**: Use Plex Mono, lg (18px) for primary metrics, base for secondary
- **Code Blocks/API Keys**: Plex Mono, sm, with subtle background

---

## Layout & Spacing System

**Spacing Primitives**: Tailwind units of **2, 4, 8, 12, 16**
- Component padding: p-4, p-6, p-8
- Section spacing: space-y-8, space-y-12
- Grid gaps: gap-4, gap-6
- Margins: m-2, m-4, m-8

**Grid Structure**:
- Dashboard: 12-column grid (grid-cols-12) for flexible metric cards
- Sidebar: Fixed 64 width (w-64) for navigation, collapsible to w-16 icon-only on mobile
- Main content: max-w-7xl mx-auto with px-6 on desktop, px-4 on mobile
- Cards: Consistent rounded-lg (8px border radius), shadow-sm elevation

---

## Component Library

### Navigation & Shell

**Top Bar (Sticky)**:
- Height: h-16
- Left: Logo + current mode badge (Paper Trading / Live Trading)
- Center: Quick actions (New Backtest, Train Model, View Positions)
- Right: User dropdown, notifications bell with badge, settings cog
- Bottom border with subtle shadow for depth

**Sidebar Navigation**:
- Icons from Heroicons (outline style) via CDN
- Active state: Full-width highlight with left accent border (border-l-4)
- Items: Dashboard, Portfolio, Backtest & Experiments, Training Control, Paper Trading, Settings, Logs
- Role badges for admin-only sections
- Collapse to icon-only on <md breakpoint

### Dashboard Cards

**Metric Cards** (3-4 per row on desktop, stack on mobile):
- Structure: Label (sm, uppercase, tracking-wide) → Large value (3xl, Plex Mono) → Change indicator (% with up/down arrow)
- Padding: p-6
- Min-height: h-32 for consistency
- Hover: subtle scale (hover:scale-[1.02]) with transition

**Chart Cards**:
- Header: Title + timeframe selector (1D, 1W, 1M, 3M, 1Y, All) as pill buttons
- Chart area: p-4, min-h-80 for adequate data display
- Footer: Key metrics summary or legend
- Use Recharts or Chart.js for visualizations

**Alert/Status Cards**:
- Distinct border-l-4 for severity (info, warning, critical)
- Icon + Message + Timestamp + Dismiss action
- Collapsible details for stack traces or additional context

### Portfolio Management

**Position Table**:
- Sticky header with sortable columns
- Columns: Ticker, Quantity, Entry Price, Current Price, P/L ($), P/L (%), Last Action, Confidence (Q-value)
- Row hover: subtle highlight
- Alternate row shading for readability (even:bg-gray-50)
- Actions dropdown per row (View Details, Simulate Sale, Set Alert)
- Expandable rows for position history timeline

**Recommendation Cards**:
- 2-column layout on desktop (grid-cols-2)
- Left: Ticker symbol (2xl, bold) + company name (sm)
- Right: Action badge (BUY 10% / HOLD / SELL 5%) with confidence score
- Body: Key signals (sentiment score, technical indicators, Q-value distribution)
- CTA: Add to Watchlist, Execute Paper Trade

### Training & Experimentation

**Training Control Panel**:
- 3-column layout: Hyperparameters (left), Live Metrics (center), Actions (right)
- Hyperparameter form: Clear labels, inline validation, preset dropdown for common configs
- Live metrics: Real-time loss curve (line chart), epsilon decay (progress bar), episodes counter (large number with +increment animation)
- Actions: Start/Pause/Stop buttons with loading states, Save Checkpoint, Export Config

**Experiment Comparison View**:
- Table view with expandable rows for detailed metrics
- Columns: Experiment ID, Created, Hyperparams summary, CAGR, Sharpe, Max DD, Status
- Inline sparklines for quick performance visualization
- Compare checkbox for multi-select → Generate comparison chart modal

### Backtest Results

**Timeline View**:
- Horizontal scrollable timeline with equity curve as primary visual
- Benchmark overlay (SPY) for comparison
- Highlight trade markers (buy/sell) on timeline
- Zoom controls and date range selector

**Metrics Grid**:
- 4-column grid on desktop: CAGR, Sharpe, Sortino, Max DD, Win Rate, Avg P/L, Total Trades, Turnover
- Each metric: Icon + label + large value + comparison to benchmark
- Tooltips for metric definitions

**Trade History Table**:
- Filterable by ticker, action type, date range
- Columns: Date, Ticker, Action, Quantity, Price, Fees, P/L, Cumulative P/L
- Export to CSV button

### Settings & Configuration

**API Key Management**:
- Input fields with show/hide toggle (eye icon)
- Test connection button with loading state
- Last verified timestamp
- Revoke/Regenerate actions

**Trading Mode Toggle**:
- Large, prominent toggle between Paper and Live
- Live mode: Multi-step confirmation modal with checkboxes ("I understand this is real money", "I accept full responsibility")
- Persistent warning banner when Live mode enabled
- Audit log table showing all mode changes with timestamp and user

**Educational Disclaimer Banner** (Fixed bottom on all pages):
- Non-dismissible (or re-appears on session start)
- Message: "Educational & Research Platform. Not Investment Advice. Past Performance ≠ Future Results."
- Link to full disclaimer modal

---

## Real-Time Features

**WebSocket Status Indicator** (Top bar):
- Dot icon: Connected (animated pulse), Disconnected (static), Reconnecting (slow pulse)
- Hover tooltip: Last message timestamp, latency

**Live Updates**:
- Smooth number counting animations for metrics changes (use CountUp.js or similar)
- Toast notifications for trade executions, training milestones, alerts (top-right corner)
- Flashing highlight (brief bg color pulse) on updated table rows

---

## Responsive Behavior

**Desktop (≥1024px)**:
- Full sidebar + 12-column grid for metrics
- Multi-column charts side-by-side
- Tables with all columns visible

**Tablet (768-1023px)**:
- Collapsible sidebar to icons-only
- 6-column or 2-column grid
- Some chart cards stack vertically

**Mobile (<768px)**:
- Hidden sidebar, hamburger menu
- Single column layout
- Horizontal scrollable tables with sticky first column
- Simplified chart controls (dropdown instead of pills)

---

## Accessibility

- All interactive elements: min-height h-10, min-width w-10 (44px touch target)
- ARIA labels for icon-only buttons
- Keyboard navigation: Focus visible with ring-2 ring-offset-2
- Form inputs: Clear labels, error states with red border + error text below
- Color-blind safe palettes for charts (avoid red/green alone; use shapes/patterns)

---

## Animations & Motion

**Minimal, Purposeful**:
- Page transitions: None or very subtle fade (150ms)
- Card hover: scale-[1.02] with transition-transform duration-200
- Loading states: Spinner or skeleton screens (avoid spinners in tables, use row shimmers)
- Number updates: CountUp animation (1s duration)
- Toasts: Slide in from top-right (300ms), auto-dismiss after 5s

**Avoid**: Parallax, scroll-triggered animations, decorative motion

---

## Images

**No hero images**. This is a data-first application. Use data visualizations and metrics as the visual hero elements on the Dashboard.

**Supporting Images**:
- Empty states: Illustrative SVG (e.g., "No positions yet" with simple chart icon illustration)
- Error states: Friendly illustration for 404, connection errors
- Onboarding/Tutorials: Optional screenshot annotations for guiding new users

---

## Key UI Patterns

**Tabs**: Use for switching between Portfolio → Watchlist → History within same page context
**Dropdowns**: User menu, action menus, filter controls
**Modals**: Confirmations (especially live trading), detailed views, multi-step wizards (training config)
**Badges**: Status indicators (Running, Completed, Failed), mode labels (Paper, Live), role tags (Admin)
**Progress Bars**: Training progress, epsilon decay, data loading
**Tooltips**: Metric definitions, icon explanations (appear on hover, position intelligently)

This design creates a professional, data-focused trading platform that prioritizes clarity, usability, and trust while supporting complex workflows across multiple user roles.