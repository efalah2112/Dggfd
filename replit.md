# Discord Bot - Multi-Guild System

## Overview
This project is a multi-purpose Discord bot designed to facilitate various community and administrative functions across multiple Discord servers. Its core purpose is to provide a comprehensive solution for managing shops, tickets, auctions, and other interactive features, with each guild maintaining its independent configuration and data. The bot aims to streamline server management and enhance user engagement through automated systems and customizable tools.

Key capabilities include:
- **Multi-Guild Support**: Each server operates with entirely separate settings and data.
- **Shop Management**: Tools for creating, managing, and automating in-server shops.
- **Auction System**: Functionality for hosting and managing auctions.
- **Ticketing System**: Support for creating and managing support tickets.
- **Automation Features**: Custom embed creation, auto-reply systems, and automatic line separators.
- **Web Dashboard**: A comprehensive web-based interface for easy configuration and management.
- **Premium Bot Marketplace**: A system for selling premium bot instances with custom tokens.

The business vision is to offer a robust, flexible, and customizable bot solution for Discord server owners, catering to various community needs from e-commerce within Discord to advanced server administration.

## User Preferences
I want iterative development. Ask before making major changes. I prefer detailed explanations for complex features. I prefer to interact with a web-based dashboard for configuration whenever possible.

## System Architecture

### UI/UX Decisions
The project incorporates both Discord command-based interactions and a full web-based dashboard for management.
- **Discord Interactions**: Utilizes interactive buttons, select menus, and slash commands for a more user-friendly experience within Discord. Help commands leverage interactive select menus for categorized assistance.
- **Web Dashboard**: A comprehensive, web-based dashboard provides an intuitive interface for managing bot settings. It uses Discord OAuth2 for authentication and features server selection, categorized settings management (shops, auctions, tickets, roles, general settings), and a dedicated premium system control panel for developers. The dashboard employs a clean design with dedicated CSS files for login and dashboard views.
- **Branding**: The bot includes a consistent footer branding: `dev by : bh.x7 & _wx10`.

### Technical Implementations
- **Multi-Guild Configuration**: All settings and data are stored on a per-guild basis using a guild-specific configuration system (`guildConfig_${guildId}`, `guildShopTypes_${guildId}`, `guildRoleTypes_${guildId}`). This ensures complete isolation and customization for each server. Helper functions like `getGuildConfig()`, `setGuildConfig()`, and `getGuildValue()` facilitate easy access and modification.
- **Dynamic Content Loading**: Features like shop types and custom roles are dynamically loaded and managed per guild, allowing for extensive customization.
- **Automated Systems**:
    - **Custom Embeds**: A system for creating, editing, deleting, and sending custom embeds with color pickers, multiple fields, and live previews.
    - **Auto-Reply**: Configurable auto-reply system based on keywords, supporting multiple random responses, role/channel restrictions, and dynamic variables.
    - **Auto-Line Separator**: Automatically sends a separator after each message in specified channels.
- **Premium Bot Marketplace System**: A complete system for selling premium bot instances, including:
    - User commands for purchasing and viewing premium bots (`-ميكر-شوب`, `-ميكر-بريم`).
    - Developer commands for managing subscriptions, blacklists, and viewing statistics.
    - Fix-bot command (`-fix-bot`, `-اصلاح-بوت`) for managing premium bots by invoice number.
    - Free premium command for developers (`-free-premium`, `-بريميوم-مجاني`).
    - Invoice code generation, 1-year subscription tracking, and automatic notifications.
    - Token encryption for secure storage using AES-256-CBC.
    - Data stored in `developers.json`.
- **Database Structure**:
    - `guildConfig_${guildId}`: Stores all general settings for a specific guild.
    - `guildShopTypes_${guildId}`: Stores shop types defined for a specific guild.
    - `guildRoleTypes_${guildId}`: Stores custom roles defined for a specific guild.
    - `ticketEmbeds_${guildId}`: Stores customizable ticket embeds for each ticket type (buy, auction, order, support, role).
    - `autoReplies_${guildId}`: Stores auto-reply configurations.
    - `autoLine_${guildId}`: Stores auto-line separator settings.
    - `taxRoom_${guildId}`: Stores tax room and notification settings.
    - `reminderSettings_${guildId}`: Stores reminder system configuration.
    - `shop_${channelId}`: Stores data related to individual shops.
    - `shops_${guildId}`: Lists shop channel IDs for a specific guild.
- **Error Logging**: Per-guild `consoleRoom` configuration allows errors to be sent to a designated channel.

### Feature Specifications
- **Shop Management**: CRUD operations for shop types, per-guild shop configurations (category, admin role, log channels, transfer bank). Shop opening command (`-متجر`).
- **Custom Roles**: Per-guild custom roles system with commands to add, list, and remove roles. Roles appear in pricing menus.
- **Ticket System**: Configurable ticket categories, admin roles, and custom welcome messages.
- **Auction System**: Customizable auction rules, prices, and room settings.
- **Order System**: Customizable order rules, prices, and room settings.
- **Financial Tracking**: Tax system with configurable rates, financial reports, and a tax calculator.
- **Bulk Messaging**: Ability to send messages to all shops.
- **Suggestions System**: Configurable suggestion channel and messages.
- **System Logs**: Detailed logs for logins, settings changes, shop activities, and errors with filtering capabilities.
- **Interactive Setup**: A button-based `-setup` command provides an interactive menu for configuring various bot aspects.
- **Per-Guild Transfer Bank**: All financial transactions (auctions, orders, roles, mentions, etc.) are routed to a unique, per-guild transfer bank to prevent inter-server transaction conflicts.

## External Dependencies
- **Discord.js v14**: The primary library for interacting with the Discord API.
- **Quick.db**: A simple JSON-based database used for storing bot configurations and data.
- **Express**: Used for building the web dashboard and handling API routes.
- **@discordjs/voice**: For voice-related functionalities within Discord.
- **Discord OAuth2**: Used for user authentication and authorization on the web dashboard.