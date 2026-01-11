# 🎊 PlanTable

[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](LICENSE)
[![React](https://img.shields.io/badge/React-18-blue.svg)](https://reactjs.org/)
[![TypeScript](https://img.shields.io/badge/TypeScript-5.6-blue.svg)](https://www.typescriptlang.org/)

> [!NOTE]
> This application was originally "vibe coded" and enhanced with my limited front-end engineering knowledge.
> A more thorough review is in progress

> Wedding seating chart generator with constraint management and PDF/CSV export

## 🚀 Quick Start

### Prerequisites

- Node.js 18+ 
- pnpm (recommended) or npm

### Installation

```bash
# Clone or access the project
cd plantable

# Install dependencies
cd apps/web
npm install
# or with pnpm
pnpm install

# Start development server
npm run dev
# or
pnpm dev
```

The application will be available at `http://localhost:5173`

## 📋 Features

### Configuration
- ⚙️ Number of seats per table (standard and honor table)
- 🎯 Sorting criteria: Family, Age, Role, Random
- 🌓 Dark mode (Light/Dark/System)
- 🌐 Internationalization (FR/EN)

### Guest Management
- ➕ Add individual guests with dynamic fields
- 💑 Create couples (always placed together)
- ❌ Define exclusions ("X cannot sit with Y")

### Smart Algorithm
- ✅ Constraint validation before generation
- 👑 Automatic honor table (bride/groom, witnesses + spouses)
- ⚠️ "Best effort" mode with warnings if perfect solution impossible

### Display
- 📋 Card view (columns)
- 🎯 Visual view (positionable round/square tables)
- 🖱️ Drag & Drop for manual adjustment

### Export
- 📄 CSV (Table, Name, Role, Family)
- 📑 PDF (printable layout)

### Persistence
- 💾 Automatic localStorage save

## 🏗️ Project Structure

```
plantable/
├── apps/web/           # React application
│   ├── src/
│   │   ├── components/ # React components + shadcn/ui
│   │   ├── lib/        # Algorithm and utilities
│   │   ├── store/      # Zustand state
│   │   └── types/      # TypeScript types
│   └── ...
├── claude.md           # Technical documentation
└── README.md
```

## 🛠️ Tech Stack

| Technology | Usage |
|------------|-------|
| React 18 | UI Framework |
| Vite 5 | Build tool |
| TypeScript | Language (strict mode) |
| Tailwind CSS | Styling |
| shadcn/ui + Radix | Accessible components |
| Zustand | State management |
| @dnd-kit | Drag & Drop |
| jsPDF | PDF export |

## 📝 Commands

```bash
npm run dev      # Development server
npm run build    # Production build
npm run preview  # Build preview
```

## 👤 Author

- Email: garry.factory@gmail.com
- GitHub: [jsthibault/PlanTable](https://github.com/jsthibault/PlanTable)
- Support: [PayPal](https://paypal.me/jeanstephanethibault)

## 📄 License

MIT
