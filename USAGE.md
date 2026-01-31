# ChronoTick - Market Replay and Algorithmic Trading Simulator - User Guide

## Table of Contents
- [Overview](#overview)
- [Getting Started](#getting-started)
- [Interface Layout](#interface-layout)
- [Core Features](#core-features)
- [Trading Modes](#trading-modes)
- [Advanced Features](#advanced-features)
- [Tips & Best Practices](#tips--best-practices)

---

## Overview

The Market Replay Trading Simulator is a sophisticated paper trading platform that allows you to replay historical market data and test trading strategies in a realistic environment. It supports both manual trading and algorithmic trading with full position management, stop-loss functionality, and comprehensive analytics.

---

## Getting Started

### Prerequisites
- Backend server running on `http://127.0.0.1:8000`
- WebSocket connection for real-time data streaming
- Historical market data loaded in the backend

### First Launch
1. The application loads with a list of available symbols in the left sidebar
2. Select a symbol to begin
3. Configure your replay parameters in the top control bar
4. Click "PLAY" to start the market replay

---

## Interface Layout

### 1. **Left Sidebar - Symbol Browser**
- **Search Bar**: Filter symbols by name
- **Symbol List**: Click any symbol to load its data
- **Refresh Button**: Update available symbols
- **Symbol Counter**: Shows total and filtered symbols

### 2. **Top Control Bar**
- **Market Replay**: Branding identifier
- **Start Date**: Select replay start time
- **End Date**: Select replay end time
- **Speed (MS)**: Control tick interval (lower = faster)
- **Gap Scale**: How time gaps between candles are handled
  - SLOW: 1000ms
  - MEDIUM: 10000ms
  - FAST: 100000ms
  - INSTANT: 1000000ms
- **Connection Status**: Shows REPLAY MODE (red) or OFFLINE
- **Playback Controls**: PLAY, PAUSE, or REPLAY buttons

### 3. **Main Header**
- **Symbol & Price Display**: Current symbol with live price
- **Price Change**: Shows absolute and percentage change
- **Quick Stats**: OPEN, HIGH, LOW values
- **Mode Selector**: Switch between trading modes
  - MANUAL
  - ALGO EDITOR
  - EXECUTOR
  - CAPITAL
- **P&L Display**: Shows current unrealized profit/loss (manual mode only)

### 4. **Chart Area**
- **Candlestick Chart**: Real-time price visualization
- **Technical Indicators**: Overlays for SMA, EMA, Bollinger Bands
- **Trade Markers**: Visual indicators showing executed trades
- **Zoom & Pan**: Mouse wheel to zoom, click-drag to pan
- **Crosshair**: Hover to see detailed price/time data

### 5. **Right Panel (Manual Mode)**
- **New Order Button**: Opens trading interface
- **Technical Indicators**: RSI, Stoch RSI, ADX, ATR, Volatility, VWAP, OBV
- **Market Sentiment**: Bullish vs. Bearish candle distribution
- **Chart Overlays**: Toggle technical indicators on/off
- **Positions/Orders Tabs**: Manage active trades

---

## Core Features

### Chart & Technical Analysis

#### **Available Indicators**
1. **SMA 20** (Blue) - 20-period Simple Moving Average
2. **SMA 50** (Orange) - 50-period Simple Moving Average
3. **EMA 12** (Green) - 12-period Exponential Moving Average
4. **EMA 26** (Pink) - 26-period Exponential Moving Average
5. **Bollinger Bands** (Purple) - 20-period with 2 standard deviations

#### **Technical Metrics**
- **RSI**: Relative Strength Index (overbought >70, oversold <30)
- **Stoch RSI**: Stochastic RSI oscillator
- **ADX**: Average Directional Index (trend strength)
- **ATR**: Average True Range (volatility)
- **Volatility**: Price volatility percentage
- **VWAP**: Volume Weighted Average Price
- **OBV**: On-Balance Volume

#### **Market Sentiment**
- Visual bar showing bullish vs. bearish candle ratio
- Real-time count of bullish and bearish candles

### Playback Controls

#### **Speed Control**
- Adjust `SPEED (MS)` to control how fast candles appear
- Lower values = faster replay
- Recommended: 1000-6000ms for realistic experience

#### **Gap Scale**
Controls how time gaps between trading sessions are handled:
- **SLOW**: Preserves real-time gaps (1:1)
- **MEDIUM**: Speeds up gaps moderately
- **FAST**: Significantly accelerates gaps
- **INSTANT**: Removes all gaps

#### **Play/Pause/Replay**
- **PLAY**: Start market data streaming
- **PAUSE**: Temporarily stop (maintains position)
- **REPLAY**: Reset and start from beginning

---

## Trading Modes

### Manual Trading Mode

Manual mode allows you to place trades yourself and manage positions like a traditional trading platform.

#### **Placing Orders**

1. Click **"NEW ORDER"** button (only available when market is connected)
2. Configure your order:
   - **Order Type**: MARKET or LIMIT
   - **Quantity**: Number of shares/contracts
   - **Limit Price** (if LIMIT order): Execution price
   - **Stop Loss** (optional): Automatic exit price

3. Click **BUY** or **SELL**

#### **Order Types Explained**

**MARKET Orders**
- Execute immediately at current price
- Guaranteed fill
- Price may vary slightly

**LIMIT Orders**
- Execute only at specified price or better
- May not fill if price doesn't reach limit
- Automatically fills when conditions are met
- Shows as "PENDING" in Orders tab until filled

#### **Stop Loss Functionality**
- Set a stop loss when placing an order
- For BUY orders: Stop loss must be BELOW entry price
- For SELL orders: Stop loss must be ABOVE entry price
- Automatically closes position when price hits stop loss
- Prevents excessive losses

#### **Managing Positions**

**Positions Tab**
- View all open positions
- Each position shows:
  - Side (BUY/SELL)
  - Quantity
  - Entry Price
  - Current Price (LTP - Last Traded Price)
  - P&L (Profit & Loss)
  - Return %
  - Stop Loss (if set)
- **CLOSE button**: Exit position at current market price

**Orders Tab**
- View pending limit orders
- Shows:
  - Order side and type
  - Quantity
  - Limit price
  - Current market price
- **CANCEL button**: Cancel pending order

#### **P&L Tracking**
- **Unrealized P&L**: Profit/loss on open positions
- **Realized P&L**: Profit/loss on closed positions
- Color-coded (Green = profit, Red = loss)
- Displayed in header and positions panel

### Algo Editor Mode

Create, test, and save custom trading strategies using Python.

#### **Strategy Structure**

All strategies must follow this function signature:

```python
def strategy(candles, current_price, available_capital, total_capital, positions):
    """
    Parameters:
    - candles: List of recent candles (each with open, high, low, close, volume)
    - current_price: Current market price
    - available_capital: Available capital for trading
    - total_capital: Total capital allocated
    - positions: List of current open positions
    
    Returns:
    - Dictionary with keys: 'action' (BUY/SELL/HOLD), 'quantity', 'reason'
    """
    return {
        'action': 'HOLD',  # or 'BUY' or 'SELL'
        'quantity': 0,      # number of shares
        'reason': 'Your reason here'
    }
```

#### **Editor Features**

1. **Strategy Name Input**: Give your strategy a descriptive name
2. **Code Editor**: Write your Python strategy
3. **Test Button**: Test strategy with current market data
4. **Auto Test Toggle**: Continuously test as market updates
5. **Examples Dropdown**: Load pre-built strategies
6. **Save Button**: Save strategy for later use

#### **Testing Your Strategy**

**Manual Test**
- Click "TEST" to run once with current data
- Results appear in "CURRENT SIGNAL" panel
- Shows: Action, Quantity, Reason

**Auto Test Mode**
- Click "START AUTO TEST" (requires market connection)
- Strategy evaluates every 3 seconds
- Shows "LIVE TESTING" indicator
- Updates signal panel automatically
- Test history logged in "TEST LOG"

#### **Pre-built Strategies**

**1. SMA Crossover**
- Uses 20-period and 50-period Simple Moving Averages
- **Golden Cross** (BUY): SMA20 crosses above SMA50
- **Death Cross** (SELL): SMA20 crosses below SMA50
- Position sizing: 20% of available capital

**2. RSI Strategy**
- Uses 14-period RSI with long/short support
- **BUY**: RSI < 30 (oversold)
- **SELL**: RSI > 70 (overbought)
- Closes opposite positions before opening new ones
- Position sizing: 25% of available capital

#### **Strategy Development Tips**

1. **Check Data Availability**: Always verify `len(candles)` before calculations
2. **Handle Edge Cases**: Return HOLD if insufficient data
3. **Position Sizing**: Use percentages of available capital
4. **Clear Reasons**: Provide descriptive reasons for debugging
5. **Test Incrementally**: Start simple, add complexity gradually

#### **Saved Strategies Panel**
- Lists all saved strategies
- Click strategy to load into editor
- Delete button to remove strategies
- Strategies persist across sessions

### Executor Mode

Run saved strategies in live simulation with full position tracking.

#### **Getting Started**

1. Load a saved strategy from Algo Editor
2. Switch to EXECUTOR mode
3. Ensure market is connected and playing
4. Click **START** to activate strategy

#### **Strategy Execution**

**Automatic Trading**
- Strategy evaluates every 2 seconds
- Automatically places BUY/SELL orders
- Manages position sizing
- Tracks all trades and P&L
- Supports both LONG and SHORT positions

**Position Management**
- **LONG Positions**: Created by BUY orders
- **SHORT Positions**: Created by SELL orders
- Capital updated when positions are opened/closed
- Supports multiple simultaneous positions

#### **Risk Management**

**Margin System (for SHORT positions)**
- **Maintenance Margin**: 25% equity required
- **Margin Call**: Triggered when equity < required margin
- **Auto-Liquidation**: All positions closed on margin call
- **30-Second Cooldown**: Strategy paused after liquidation, then resumes

**Safety Features**
- Auto-stop if WebSocket disconnects
- Safety check for orphaned positions
- Prevents trades when market is paused
- Capital validation before opening positions

#### **Performance Dashboard**

**Account Metrics**
- **Account Value**: Total capital + unrealized P&L
- **Return %**: Performance vs. initial capital
- **Unrealized P&L**: Open position profit/loss
- **Realized P&L**: Closed position profit/loss
- **Available Capital**: Cash available for trading
- **Win Rate**: Percentage of profitable closed trades
- **Total Trades**: Number of completed trades
- **Net Position**: Long quantity - Short quantity

**Margin Metrics** (when SHORT positions exist)
- **Short Exposure**: Total value of short positions
- **Margin Status**: OK or MARGIN CALL

#### **Open Positions Panel**
- Real-time position tracking
- Shows entry price, current price, P&L
- Color-coded by profitability
- Displays position value
- Long/Short indication

#### **Trade History**
- Chronological list of all trades
- Shows action, quantity, price, timestamp
- Reason for each trade
- Scrollable history

#### **Execution Log**
- Detailed activity log
- Shows all strategy decisions
- Capital updates
- Error messages
- Trade executions
- **COPY ALL button**: Copy entire log to clipboard

#### **Controls**

- **START**: Activate strategy execution (requires strategy, connection, and playing market)
- **STOP**: Deactivate strategy and close all positions
- **DOWNLOAD**: Export trade report as CSV
- **RESET**: Clear all positions and trades, restore initial capital

#### **Trade Report (CSV)**

Downloaded report includes:
- Strategy metadata (name, symbol, dates)
- Performance summary (return %, P&L, win rate)
- **Closed Positions**: All completed trades with P&L
- **Open Positions**: Current positions with unrealized P&L
- **Trade History**: Chronological trade log

### Capital Manager Mode

Configure trading capital and risk parameters.

#### **Capital Overview**
- **Initial Capital**: Starting balance
- **Available Capital**: Current cash balance
- **Capital Invested**: Value tied up in positions
- **Utilization %**: Percentage of capital in use
- Visual utilization bar (color-coded by risk level)

#### **Update Capital**
1. Enter new capital amount
2. Click "UPDATE CAPITAL"
3. ⚠️ **Warning**: This resets all positions and trades

#### **Risk Management Settings**

**Max Position Size (%)**
- Limit position size as percentage of total capital
- Prevents over-concentration
- Shows maximum dollar value per position

**Max Concurrent Positions**
- Limit number of simultaneous open positions
- Range: 1-20 positions
- Prevents over-trading

**Default Stop Loss (%)**
- Automatic stop loss for new positions
- Percentage below entry (for longs) or above entry (for shorts)
- Range: 0.1% - 20%

**Default Take Profit (%)**
- Automatic profit target
- Percentage above entry (for longs) or below entry (for shorts)
- Range: 0.1% - 50%

Note: *Stop loss and take profit settings are for reference in Capital Manager. Actual stop loss must be set when placing orders in Manual mode.*

#### **Trading Statistics**
- **Open Positions**: Current active trades
- **Total Trades**: All-time trade count
- **Winning Trades**: Profitable trade count
- **Win Rate**: Success percentage

---

## Advanced Features

### Trade Markers on Chart

Visual indicators appear on the chart for all executed trades:

- **Badge Display**: Small colored badge (B for BUY, S for SELL)
- **Hover Tooltip**: Shows trade details
  - Trade type (BUY/SELL)
  - Quantity
  - Price
  - Timestamp
  - Reason (if available)
- **Color Coding**:
  - Green: BUY trades
  - Red: SELL trades
- **Smart Positioning**: Markers stay aligned with price as you zoom/pan

### Position Management

#### **Long Positions (BUY)**
- Capital deducted when opened: `price × quantity`
- Capital returned when closed: `current_price × quantity`
- P&L = `(exit_price - entry_price) × quantity`

#### **Short Positions (SELL)**
- Capital unchanged when opened (proceeds locked as margin)
- Only P&L affects capital when closed
- P&L = `(entry_price - exit_price) × quantity`

#### **Closing Priority**
When a strategy signals BUY:
1. First covers any open SHORT positions
2. Then opens new LONG positions with remaining quantity

When a strategy signals SELL:
1. First closes any open LONG positions
2. Then opens new SHORT positions with remaining quantity

### Stop Loss Features

**Automatic Monitoring**
- Stop loss checked every price update
- Immediate execution when triggered
- Position closed at current market price
- Stop loss price stored with position

**Validation**
- BUY positions: Stop loss must be < entry price
- SELL positions: Stop loss must be > entry price
- Error shown if invalid stop loss entered

### WebSocket Connection

**Connection States**
- **CONNECTED** (red badge): Market replay active
- **DISCONNECTED** (gray badge): No connection

**Auto-Safety Features**
- Strategy auto-stops on disconnect
- All positions closed on disconnect (in Executor mode)
- Prevents trading when disconnected
- Reconnection detected automatically

### Chart Synchronization

**Smart Re-sync**
- Trade markers automatically reposition on zoom/pan
- Chart fits all data when new candles arrive
- Smooth updates without flickering
- Maintains scroll position

---

## Tips & Best Practices

### Trading Strategy

1. **Start with Paper Trading**: Use the simulator to test before live trading
2. **Set Stop Losses**: Always protect against large losses
3. **Position Sizing**: Don't risk more than 2-5% per trade
4. **Diversify**: Don't put all capital in one position
5. **Test Different Timeframes**: Vary Speed and Gap Scale settings

### Algorithm Development

1. **Start Simple**: Begin with basic indicators (SMA, RSI)
2. **Add Complexity Gradually**: Test each addition
3. **Use Auto Test**: Validate strategy in real-time
4. **Check Edge Cases**: Ensure strategy handles all scenarios
5. **Monitor Execution Log**: Watch for errors or unexpected behavior
6. **Backtest Multiple Periods**: Test on different market conditions

### Performance Optimization

1. **Adjust Speed**: Find comfortable replay speed (2000-6000ms recommended)
2. **Use Gap Scale**: FAST or INSTANT for backtesting, SLOW for learning
3. **Limit Indicators**: Too many overlays can clutter the chart
4. **Monitor Win Rate**: Aim for >50% win rate with good risk/reward
5. **Track Drawdowns**: Note maximum loss periods

### ⚠️ Common Pitfalls

1. **Over-trading**: Don't trade every signal
2. **Ignoring Risk Management**: Always use stop losses
3. **Curve Fitting**: Don't over-optimize for one specific period
4. **Emotional Trading**: Stick to your strategy rules
5. **Insufficient Testing**: Test strategies thoroughly before live execution

### 🔧 Troubleshooting

**Chart Not Loading**
- Check WebSocket connection (should show "REPLAY MODE")
- Verify backend is running
- Try clicking REPLAY button

**Trades Not Executing**
- Ensure market is PLAYING (not paused)
- Check WebSocket is CONNECTED
- Verify sufficient capital for trade

**Strategy Not Running**
- Click START in Executor mode
- Ensure strategy is loaded
- Check market is connected and playing
- Review Execution Log for errors

**Margin Call Issues**
- Close some short positions
- Add more capital in Capital Manager mode
- Wait for 30-second cooldown to pass

---

## Keyboard Shortcuts

*Currently, all interactions are mouse-based. Keyboard shortcuts may be added in future updates.*

---

## Data & Privacy

- All trading is simulated (paper trading)
- No real money is involved
- Positions and strategies stored in browser session
- Data resets when you refresh the page
- No external data transmission except to local backend

---

## Support & Updates

For questions, issues, or feature requests, please refer to the project repository or contact the development team.

**Version**: 1.0  
**Last Updated**: January 2026

---

## Quick Reference Card

| Feature | Shortcut/Location |
|---------|------------------|
| Switch Symbols | Left Sidebar → Click symbol |
| Start Replay | Top Bar → PLAY button |
| Place Trade | NEW ORDER button (Manual mode) |
| Close Position | Positions tab → CLOSE button |
| Test Strategy | Algo Editor → TEST button |
| Run Strategy | Executor → START button |
| View Indicators | Right Panel → Technical Indicators |
| Toggle Chart Overlays | Right Panel → Chart Overlays |
| Export Trades | Executor → DOWNLOAD button |
| Reset Capital | Capital Manager → UPDATE CAPITAL |

---

*Happy Trading! *
