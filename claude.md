# PlanTable - Project Documentation

> 🎊 Wedding seating chart generator with constraint management and PDF/CSV export

## 📋 Project Summary

> [!NOTE]
> This application was originally "vibe coded" and enhanced with my limited front-end engineering knowledge.
> A more thorough review is in progress

**PlanTable** is a SPA (Single Page Application) web app for creating wedding seating charts. It automatically handles guest placement while respecting hard constraints (inseparable couples, exclusions) and soft constraints (family grouping, age).

---

## 🏗️ Architecture

### Monorepo Structure

```
plantable/
├── apps/
│   └── web/                    # Main React application
│       ├── src/
│       │   ├── components/     # React components
│       │   │   ├── ui/         # shadcn/ui components
│       │   │   ├── ConfigurationPanel.tsx
│       │   │   ├── GuestManagement.tsx
│       │   │   ├── SeatingPlanDisplay.tsx
│       │   │   └── ExportActions.tsx
│       │   ├── lib/            # Utilities and algorithm
│       │   │   ├── algorithm.ts
│       │   │   ├── i18n.tsx
│       │   │   ├── theme.tsx
│       │   │   └── utils.ts
│       │   ├── store/          # Global state (Zustand)
│       │   │   └── index.ts
│       │   ├── types/          # TypeScript types
│       │   │   └── index.ts
│       │   ├── App.tsx
│       │   ├── main.tsx
│       │   └── index.css
│       ├── package.json
│       ├── tsconfig.json
│       ├── vite.config.ts
│       ├── tailwind.config.js
│       └── postcss.config.js
├── package.json                # Workspace root
├── pnpm-workspace.yaml
└── claude.md                   # This documentation
```

### Tech Stack

| Technology | Usage |
|------------|-------|
| React 19 | UI Framework |
| Vite 6 | Build tool |
| TypeScript (strict) | Language |
| Tailwind CSS 3 | Styling |
| shadcn/ui + Radix UI | Accessible components |
| Zustand | State management |
| @dnd-kit | Drag & Drop |
| jsPDF + html2canvas | PDF export |

---

## 🎯 Features

### ✅ Implemented

1. **Plan Configuration**
   - Total number of guests
   - **Number of tables** (excluding honor table)
   - Seats per standard table
   - Honor table seats (configurable)
   - Sorting criteria: Family, Age, Role, Random
   - **Capacity validation** (alert if insufficient/excess seats)

2. **Guest Management**
   - Add/Edit/Delete
   - Dynamic fields based on active criteria
   - Limit ~50 individual guests, ~100 as couples
   - **Auto-completion** of missing guests ("Guest 1", "Guest 2"...)

3. **Couple Management**
   - Associate two guests
   - HARD constraint: always at the same table

4. **Exclusions**
   - "X cannot sit with Y"
   - "Best effort" mode if impossible

5. **Honor Table**
   - Bride/groom and witnesses always at Table 1
   - Witnesses' spouses automatically included

6. **Placement Algorithm**
   - Solvability validation before generation
   - Priority: Role > Family > Age
   - Large families: fill one table, then overflow
   - **Respects configured number of tables**

7. **Results Display**
   - Card view (columns)
   - Visual view (positionable round/square tables)
   - **Drag & Drop between tables** for manual adjustment
   - **Table renaming** (click on name)

8. **Export**
   - CSV: "Table, Name, Role, Family"
   - PDF: Printable layout

9. **Persistence**
   - Automatic localStorage save
   - Data preserved after refresh

10. **Internationalization**
    - French/English support
    - Language toggle in header

11. **Dark Mode**
    - Light/Dark/System theme options
    - Follows OS preference when set to System

---

## 🧠 Algorithm Logic

### Constraints

| Type | Description | Behavior |
|------|-------------|----------|
| **HARD** | Inseparable couples | Fails if impossible |
| **HARD** | Bride/Groom/Witnesses → Table 1 | Fails if insufficient capacity |
| **SOFT** | Exclusions | Warning if violated |
| **SOFT** | Family grouping | Best effort |
| **SOFT** | Age grouping | Best effort |

### Generation Flow

```
1. Hard constraint validation
   └── If conflict detected → ERROR with specific message

2. Honor table placement
   └── Bride/groom + Witnesses + their spouses

3. Sort remaining guests
   └── Priority: Role > Family > Age

4. Family grouping (if enabled)

5. Iterative placement
   └── For each group/guest:
       ├── Find table without exclusion
       ├── If none → "best effort" with warning
       └── If table full → new table

6. Random shuffle (if enabled)
```

---

## 🔧 Commands

```bash
# Install dependencies
pnpm install

# Development
pnpm dev

# Production build
pnpm build

# Preview build
pnpm preview
```

---

## 📝 Architecture Decisions

### Why Zustand?
- Simple, lightweight, no boilerplate
- `persist` middleware for localStorage
- No need for Redux at this project size

### Why @dnd-kit?
- Modern and accessible API
- React 18+ support
- Better than react-dnd for our use case

### "Best Effort" Mode
- Algorithm doesn't block on soft exclusions
- Shows clear visual warnings
- Allows user to manually correct via Drag & Drop

---

## 🚀 Possible Future Improvements

- [ ] CSV import of existing guests
- [ ] Predefined configuration templates
- [ ] Collaborative mode (link sharing)
- [ ] Customizable PDF themes
- [ ] Modification history
- [ ] PNG image export of visual plan

---

## 📅 Changelog

### v0.1.0 (30/12/2024)
- Initial release
- Configuration, guest management, placement algorithm
- Card view and visual view
- Drag & Drop
- CSV/PDF export
- localStorage persistence

### v0.2.0 (31/12/2024)
- Dark mode (Light/Dark/System)
- Internationalization (FR/EN)
- Custom logo and favicon
- PayPal donation link
- GitHub repository link
