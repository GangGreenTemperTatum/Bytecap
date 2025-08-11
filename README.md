# Bytecap

<div align="center">

_Caido plugin to cap and split workspace files by size — ideal for proxy and log file uploads with file size limits_

[![GitHub forks](https://img.shields.io/github/forks/GangGreenTemperTatum/Bytecap?style=social)](https://github.com/GangGreenTemperTatum/Bytecap/network/members)
[![GitHub issues](https://img.shields.io/github/issues/GangGreenTemperTatum/Bytecap)](https://github.com/GangGreenTemperTatum/Bytecap/issues)
[![GitHub release (latest by date)](https://img.shields.io/github/v/release/GangGreenTemperTatum/Bytecap)](https://github.com/GangGreenTemperTatum/Bytecap/releases)
[![GitHub stars](https://img.shields.io/github/stars/GangGreenTemperTatum/Bytecap?style=social)](https://github.com/GangGreenTemperTatum/Bytecap/stargazers)
[![License](https://img.shields.io/github/license/GangGreenTemperTatum/Bytecap?branch=main)](https://github.com/GangGreenTemperTatum/Bytecap/blob/main/LICENSE)

[Report Bug](https://github.com/GangGreenTemperTatum/Bytecap/issues) •
[Request Feature](https://github.com/GangGreenTemperTatum/Bytecap/issues)

![Bytecheck Panel](./public/images/bytecheck-panel.png)
*Bytecheck*

<!-- TODO Bytecap is now available via the Caido Plugin Library! 🥳 Bytecap has been [submitted to the Caido Plugin Library](https://github.com/caido/store/pull/24) and is currently under review. Once approved, it will be available for installation directly from the Caido interface. In the meantime, you can still install it manually by following the instructions below. -->

</div>

---

- [Bytecap](#bytecap)
  - [Overview](#overview)
  - [Quick Start](#quick-start)
    - [Prerequisites](#prerequisites)
    - [Installation](#installation)
    - [Method 1 - Install latest release:](#method-1---install-latest-release)
    - [Method 2 - Install from source:](#method-2---install-from-source)
    - [Usage](#usage)
  - [Contributing](#contributing)
  - [License](#license)
  - [Star History](#star-history)

## Overview

Bytecap is a Caido plugin that helps you monitor and manage workspace file sizes. Perfect for scenarios where you need to upload proxy/logs or data files with strict size limits (IE certain pentesting platforms), Bytecap provides real-time file size monitoring with configurable thresholds and warnings.

---

## Quick Start

### Prerequisites

- Caido (latest version)
- Node.js and pnpm (for development)

### Installation

### Method 1 - Install latest release:

1. Download the [latest release](https://github.com/GangGreenTemperTatum/Bytecap/releases) from GitHub.
2. In Caido, go to **Plugins** > **Install Package** and select the downloaded file.

### Method 2 - Install from source:

1. **Clone the repository:**
   ```bash
   git clone https://github.com/GangGreenTemperTatum/Bytecap.git
   cd Bytecap
   ```

2. **Install dependencies:**
   ```bash
   pnpm install
   ```

3. **Build the plugin:**
   ```bash
   pnpm build
   ```

4. **Install in Caido:**
   - Open Caido
   - Go to Settings > Plugins
   - Click "Install from file"
   - Select the built plugin file from the `dist/` directory

### Usage

1. **Access Bytecap:**
   - After installation, find "Bytecap" in your Caido sidebar
   - Click to open the file size monitoring interface

2. **Configure your settings:**
   - Use the slider to set your file size threshold (1-20GB)
   - Enable additional warnings for 75% and 90% thresholds
   - Click "Apply Settings" to activate threshold monitoring
   - Click "Refresh Files" to scan your workspace

3. **Monitor your files:**
   - View all workspace files in the sortable table
   - Check color-coded status indicators
   - Review alerts and warnings for files exceeding threshold

![Bytecheck Notification](./public/images/bytecheck-popup-alert-1.png)
*Bytecheck notification*

![Bytecheck Notification](./public/images/bytecheck-popup-alert-2.png)
*Bytecheck notification*

## Contributing

1. Fork the repository
2. Create your feature branch (`git checkout -b feature/amazing-feature`)
3. Commit your changes (`git commit -m 'Add some amazing feature'`)
4. Push to the branch (`git push origin feature/amazing-feature`)
5. Open a Pull Request

## License

This project is licensed under the MIT License - see the [LICENSE](LICENSE) file for details.

## Star History

[![Star History Chart](https://api.star-history.com/svg?repos=GangGreenTemperTatum/Bytecap&type=Date)](https://star-history.com/#GangGreenTemperTatum/Bytecap&Date)

---

<div align="center">
Made with ❤️ for the Caido community and angry pentesters
</div>