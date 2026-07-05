# PetMatch - Design Language Guide

## Hệ Thống Màu (Color System)

### 4 Màu Chính
Ứng dụng sử dụng **đúng 4 màu** để tạo sự nhất quán:

1. **Primary Color** - Cam ấm (Orange-Brown)
   - Light: `oklch(0.65 0.18 45)` - Nút, headings, highlights
   - Dark: `oklch(0.7 0.16 45)` - Version dark mode
   - Dùng cho: CTA buttons, active states, brand elements

2. **Accent Color** - Xanh lam nhạt (Teal-Blue)
   - Light: `oklch(0.75 0.12 160)` - Secondary actions
   - Dark: `oklch(0.65 0.1 160)` - Version dark mode
   - Dùng cho: Secondary buttons, hover states, icons

3. **Neutral - Background**
   - Light: `oklch(0.98 0.005 80)` - Nền chính (gần trắng)
   - Dark: `oklch(0.18 0.01 50)` - Nền dark mode
   - Dùng cho: Page background, body

4. **Neutral - Cards/Surface**
   - Light: `oklch(1 0 0)` - Pure white cho cards
   - Dark: `oklch(0.22 0.01 50)` - Dark surface
   - Dùng cho: Cards, dialogs, modals

### Màu Phụ
- **Muted**: Xám nhạt cho text thứ cấp - `oklch(0.94 0.01 80)` (light)
- **Destructive**: Đỏ cho delete/danger actions - `oklch(0.55 0.22 25)`
- **Border**: Đường viền mỏng - `oklch(0.9 0.01 80)` (light)

## Typography

### Font Family
- **Heading & Body**: Geist (Single font family)
- **Monospace**: Geist Mono (cho code/technical)
- Tất cả text sử dụng class `font-sans`

### Text Hierarchy
```
h1: text-3xl/text-4xl font-bold
h2: text-2xl font-bold
h3: text-xl font-bold
h4: text-lg font-semibold
body: text-base leading-relaxed (leading-6)
small: text-sm
xsmall: text-xs
```

**Line Height**: Luôn dùng `leading-relaxed` (1.6) cho body text để dễ đọc

## Layout & Spacing

### Tailwind Spacing Scale (Bắt buộc)
```
p-4 (16px), mx-6 (24px), gap-4, etc.
KHÔNG dùng: p-[16px], mx-[23px] - dùng spacing scale thay vào
```

### Layout Methods (Priority Order)
1. **Flexbox** (90% cases) - `flex items-center justify-between`
   - Dùng cho: navigation, buttons, form rows, stacks

2. **CSS Grid** (10% cases) - `grid grid-cols-3 gap-4`
   - Dùng cho: card grids, complex 2D layouts

3. **KHÔNG dùng**: Floats, position absolute (trừ khi không có lựa chọn)

### Responsive Design
- **Mobile-first**: Code cho mobile trước, sau đó thêm `md:`, `lg:` prefixes
- **Breakpoints**: 
  - Mobile: < 640px (sm)
  - Tablet: 640px - 1024px (md - lg)
  - Desktop: > 1024px (xl)

## Component Styling Patterns

### Buttons
```tsx
// Primary (CTA)
<Button className="gap-2">
  <Heart className="w-4 h-4" />
  Yêu thích
</Button>

// Secondary
<Button variant="ghost" className="gap-2">
  <X className="w-4 h-4" />
  Bỏ qua
</Button>

// Sizing
<Button size="lg"> - Cho CTA chính
<Button size="default"> - Default
<Button size="sm"> - Cho secondary actions
```

### Cards
```tsx
<div className="bg-card rounded-xl border overflow-hidden hover:shadow-lg transition-shadow">
  {/* content */}
</div>
```
- `bg-card` - Background
- `border` - Subtle border
- `rounded-xl` - Corner radius (0.75rem)
- `hover:shadow-lg` - Elevation on hover
- `transition-shadow` - Smooth animation

### Text Colors
```tsx
// Primary text
<h2 className="text-foreground font-bold">Heading</h2>

// Secondary text
<p className="text-muted-foreground text-sm">Mô tả</p>

// Accent text
<span className="text-primary">Highlighted</span>
```

## Icons
- Sử dụng **lucide-react** cho tất cả icons
- Icon sizes: `w-4 h-4` (small), `w-5 h-5` (medium), `w-6 h-6` (large)
- Luôn thêm alt text hoặc aria-labels khi cần

## Forms & Inputs

### Input Styling
```tsx
<input className="w-full px-3 py-2 border rounded-lg bg-input text-foreground focus:outline-none focus:ring-2 focus:ring-primary" />
```

### Form Layout
```tsx
<div className="space-y-4">  {/* gap-4 cho child elements */}
  <div>
    <label className="text-sm font-medium">Label</label>
    <input />
  </div>
</div>
```

## Navigation Styling

### Top Navigation Bar
```tsx
<nav className="sticky top-0 z-50 bg-background/95 backdrop-blur border-b">
  <div className="flex items-center justify-between h-16">
    {/* Logo + Links */}
  </div>
</nav>
```
- `sticky top-0 z-50` - Cố định ở trên cùng
- `bg-background/95 backdrop-blur` - Semi-transparent với blur
- `h-16` - Height 64px (standard)

### Mobile Tabs
```tsx
<button className={cn(
  "flex-1 py-3 text-sm font-medium transition-colors",
  activeTab === "id" 
    ? "text-primary border-b-2 border-primary" 
    : "text-muted-foreground"
)}>
```

## Animation & Transitions

### Framer Motion (Cho Swipe/Complex)
```tsx
import { motion } from "framer-motion"

<motion.div
  initial={{ opacity: 0, x: 20 }}
  animate={{ opacity: 1, x: 0 }}
  exit={{ opacity: 0, x: -20 }}
  transition={{ duration: 0.3 }}
>
```

### Tailwind Transitions (Cho Simple)
```tsx
className="transition-all duration-300 hover:shadow-lg"
className="transition-colors duration-200"
className="transition-transform duration-300"
```

## Common Pattern Examples

### Card Grid
```tsx
<div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
  {items.map(item => (
    <div className="bg-card rounded-xl border p-4">...</div>
  ))}
</div>
```

### Hero Section
```tsx
<section className="bg-background py-12 md:py-24">
  <div className="container mx-auto px-4 max-w-2xl text-center">
    <h1 className="text-3xl md:text-4xl font-bold mb-4">Tiêu đề</h1>
    <p className="text-muted-foreground mb-8">Mô tả</p>
    <Button className="gap-2">...</Button>
  </div>
</section>
```

### Empty State
```tsx
<div className="text-center py-16">
  <div className="w-20 h-20 mx-auto mb-6 bg-muted rounded-full flex items-center justify-center">
    <Icon className="w-10 h-10 text-muted-foreground" />
  </div>
  <h2 className="text-2xl font-bold mb-2">Tiêu đề</h2>
  <p className="text-muted-foreground mb-6">Mô tả</p>
  <Button>Hành động</Button>
</div>
```

## Things to Remember

✓ **Luôn dùng**:
- Design tokens (bg-primary, text-foreground, etc.)
- Spacing scale (p-4, gap-6, mx-2)
- Flexbox cho layouts
- Semantic HTML (main, nav, section, h1-h6)
- Alt text cho images
- Responsive prefixes (md:, lg:)

✗ **KHÔNG dùng**:
- Arbitrary values: p-[16px], text-[18px]
- Direct colors: bg-white, text-black (dùng tokens)
- Hardcoded px values trong spacing
- Floats hay position absolute (trừ special cases)
- Multiple font families (chỉ Geist)
- Emojis làm icons

## Dark Mode
- Tự động switch dựa vào `prefers-color-scheme`
- Design tokens tự động adjust via `.dark` selector
- Không cần custom dark: variant cho từng element
- Test both light & dark trước khi push
