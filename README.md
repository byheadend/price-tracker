# 📊 Price Tracker — Multi-Marketplace Price Monitoring System

Real-time price monitoring and alerting system that tracks product prices across multiple e-commerce marketplaces and sends instant notifications via Telegram.

![Node.js](https://img.shields.io/badge/Node.js-339933?style=for-the-badge&logo=node.js&logoColor=white)
![TypeScript](https://img.shields.io/badge/TypeScript-3178C6?style=for-the-badge&logo=typescript&logoColor=white)
![PostgreSQL](https://img.shields.io/badge/PostgreSQL-4169E1?style=for-the-badge&logo=postgresql&logoColor=white)
![Playwright](https://img.shields.io/badge/Playwright-2EAD33?style=for-the-badge&logo=playwright&logoColor=white)

## ✨ Features

- 🔍 **Multi-Platform Tracking** — Monitor prices across 5+ e-commerce marketplaces simultaneously
- ⚡ **Real-Time Alerts** — Instant Telegram notifications when prices change
- 📈 **Price History** — Historical price charts and trend analysis
- 🛡️ **Anti-Detection** — Built-in stealth measures, proxy rotation, and human-like behavior
- 📊 **Dashboard** — Clean web interface for monitoring and analytics
- ⏰ **Scheduled Monitoring** — Configurable check intervals (hourly, daily, real-time)
- 📋 **Export** — CSV, JSON, Excel export of tracked data

## 🏗️ Architecture

```
┌──────────────────────────────────────────────────┐
│                  PRICE TRACKER                    │
├──────────────┬──────────────┬────────────────────┤
│  🕷️ SCRAPERS │  📊 ANALYZER  │  📱 TELEGRAM BOT   │
│  (Playwright │  (Price diff │  (Notifications    │
│   + Cheerio) │   + trends)  │   + Commands)      │
├──────────────┴──────────────┴────────────────────┤
│  🗄️ DATABASE (PostgreSQL)                        │
├──────────────────────────────────────────────────┤
│  ⏰ SCHEDULER (node-cron)                        │
└──────────────────────────────────────────────────┘
```

## 🚀 Quick Start

### Prerequisites

- Node.js 18+
- PostgreSQL 14+
- Telegram Bot Token (from [@BotFather](https://t.me/BotFather))

### Installation

```bash
# Clone the repository
git clone https://github.com/byheadend/price-tracker.git
cd price-tracker

# Install dependencies
npm install

# Configure environment
cp .env.example .env
# Edit .env with your database credentials and Telegram bot token

# Initialize database
npm run db:init

# Start the tracker
npm run start
```

### Configuration

```env
# Database
DATABASE_URL=postgresql://user:password@localhost:5432/price_tracker

# Telegram Bot
TELEGRAM_BOT_TOKEN=your_bot_token_here
TELEGRAM_CHAT_ID=your_chat_id_here

# Monitoring Settings
CHECK_INTERVAL=3600000  # Check every hour (in ms)
MAX_CONCURRENT=5        # Max concurrent scraping sessions
```

## 📱 Telegram Commands

| Command | Description |
|---------|-------------|
| `/track <url>` | Start tracking a product |
| `/untrack <id>` | Stop tracking a product |
| `/list` | List all tracked products |
| `/status` | System status and stats |
| `/history <id>` | Price history for a product |
| `/alerts` | Configure alert preferences |

## 📊 Sample Alert

```
🔔 PRICE DROP ALERT

📦 Product: Samsung Galaxy S24 Ultra
🏪 Platform: Marketplace A
💰 Old Price: $1,299.99
💚 New Price: $1,149.99
📉 Change: -11.5% (-$150.00)
⏰ Detected: 2024-01-15 14:32:05

📈 30-Day Low: $1,099.99
📉 30-Day High: $1,349.99
```

## 📈 Performance

| Metric | Value |
|--------|-------|
| Products tracked | 50,000+ |
| Platforms supported | 5+ |
| Uptime | 99.5% |
| Alert latency | < 30 seconds |
| Data points/day | 100,000+ |

## 🛠️ Tech Stack

- **Runtime:** Node.js + TypeScript
- **Scraping:** Playwright, Cheerio, stealth plugins
- **Database:** PostgreSQL with TimescaleDB extension
- **Notifications:** Telegram Bot API (grammy)
- **Scheduling:** node-cron
- **Anti-Detection:** Proxy rotation, fingerprint randomization

## 📁 Project Structure

```
price-tracker/
├── src/
│   ├── index.ts              # Entry point
│   ├── config.ts             # Configuration management
│   ├── scrapers/
│   │   ├── base.ts           # Base scraper interface
│   │   ├── marketplace-a.ts  # Marketplace A scraper
│   │   ├── marketplace-b.ts  # Marketplace B scraper
│   │   └── ...
│   ├── database/
│   │   ├── init.ts           # Database initialization
│   │   ├── models.ts         # Data models
│   │   └── queries.ts        # CRUD operations
│   ├── analyzer/
│   │   ├── diff.ts           # Price difference calculator
│   │   └── trends.ts         # Trend analysis
│   ├── telegram/
│   │   ├── bot.ts            # Bot setup
│   │   ├── commands.ts       # Command handlers
│   │   └── notifications.ts  # Alert formatting
│   └── utils/
│       ├── anti-detection.ts # Stealth utilities
│       ├── proxy.ts          # Proxy management
│       └── logger.ts         # Logging
├── package.json
├── tsconfig.json
└── .env.example
```

## 📄 License

MIT License — see [LICENSE](LICENSE) for details.

---

**Built with ❤️ by [Serkan Tastan](https://github.com/byheadend)**
