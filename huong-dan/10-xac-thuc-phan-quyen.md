# Hướng Dẫn: Xác Thực & Phân Quyền

## Mục Lục
1. [Tổng quan](#1-tổng-quan)
2. [Các file liên quan](#2-các-file-liên-quan)
3. [Luồng xác thực](#3-luồng-xác-thực)
4. [Middleware bảo vệ route](#4-middleware-bảo-vệ-route)
5. [Hệ thống phân quyền](#5-hệ-thống-phân-quyền)
6. [Sử dụng trong code](#6-sử-dụng-trong-code)
7. [API liên quan](#7-api-liên-quan)

---

## 1. Tổng quan

Hệ thống sử dụng:
- **Supabase Auth:** Xác thực email/password
- **Middleware:** Bảo vệ route, chuyển hướng
- **Permission System:** Phân quyền theo vị trí (position)

---

## 2. Các file liên quan

### 2.1. Trang xác thực

```
src/app/
├── login/
│   └── page.tsx                ← Trang đăng nhập
├── auth/
│   └── confirm/
│       └── route.ts            ← Xác nhận email
└── reset-password/
    └── page.tsx                ← Đặt lại mật khẩu
```

### 2.2. Components

```
src/components/auth/
├── login-form.tsx              ← Form đăng nhập
├── reset-password-form.tsx     ← Form reset password
└── RequireAuth.tsx             ← Guard component
```

### 2.3. Middleware & Permissions

```
src/
├── middleware.ts               ← Entry middleware
└── lib/
    ├── supabase/
    │   ├── middleware.ts       ← Session update logic
    │   ├── client.ts           ← Browser client
    │   ├── server.ts           ← Server client
    │   └── admin.ts            ← Admin client
    └── permissions.ts          ← Hệ thống phân quyền
```

---

## 3. Luồng xác thực

### 3.1. Đăng nhập

```
[Người dùng vào /login]
         ↓
[Hiển thị form đăng nhập]
         ↓
[Nhập email + password]
         ↓
[Gọi supabase.auth.signInWithPassword()]
         ↓
[Supabase kiểm tra:]
- Email tồn tại?
- Password đúng?
         ↓
[Nếu đúng] → Tạo session → Chuyển đến /dashboard
[Nếu sai] → Hiện lỗi "Email hoặc mật khẩu không đúng"
```

### 3.2. Form đăng nhập

**File:** `src/components/auth/login-form.tsx`

```typescript
// Validation với Zod
const formSchema = z.object({
  email: z.string().email('Email không hợp lệ'),
  password: z.string().min(8, 'Mật khẩu tối thiểu 8 ký tự')
})

// Xử lý submit
async function onSubmit(values) {
  const { error } = await supabase.auth.signInWithPassword({
    email: values.email,
    password: values.password
  })

  if (error) {
    toast.error('Email hoặc mật khẩu không đúng')
  } else {
    router.push('/dashboard')
  }
}
```

### 3.3. Đăng xuất

**File:** `src/components/header.tsx`

```typescript
async function handleLogout() {
  await supabase.auth.signOut()
  router.push('/login')
}
```

### 3.4. Đặt lại mật khẩu

**File:** `src/components/auth/reset-password-form.tsx`

```
[Nhập email]
         ↓
[Gọi supabase.auth.resetPasswordForEmail()]
         ↓
[Supabase gửi email với link reset]
         ↓
[User click link → Vào /update-password]
         ↓
[Nhập mật khẩu mới]
         ↓
[Cập nhật thành công]
```

---

## 4. Middleware bảo vệ route

### 4.1. Cấu trúc

**File:** `src/middleware.ts`

```typescript
export async function middleware(request: NextRequest) {
  return await updateSession(request)
}

// Áp dụng cho tất cả route trừ static files
export const config = {
  matcher: [
    '/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)',
  ],
}
```

### 4.2. Logic xử lý session

**File:** `src/lib/supabase/middleware.ts`

```typescript
export async function updateSession(request: NextRequest) {
  // 1. Lấy user từ session
  const { data: { user } } = await supabase.auth.getUser()

  // 2. Định nghĩa route công khai
  const publicRoutes = ['/login', '/auth', '/api/auth', '/auth/confirm']

  // 3. Kiểm tra route hiện tại
  const isPublicRoute = publicRoutes.some(route =>
    request.nextUrl.pathname.startsWith(route)
  )

  // 4. Nếu chưa đăng nhập và không phải route công khai
  if (!user && !isPublicRoute) {
    // Chuyển đến /login với redirectTo
    const redirectUrl = new URL('/login', request.url)
    redirectUrl.searchParams.set('redirectTo', request.nextUrl.pathname)
    return NextResponse.redirect(redirectUrl)
  }

  // 5. Nếu đã đăng nhập và đang ở /login
  if (user && request.nextUrl.pathname === '/login') {
    // Chuyển đến /dashboard
    return NextResponse.redirect(new URL('/dashboard', request.url))
  }

  return response
}
```

### 4.3. Route công khai vs bảo vệ

| Loại | Routes | Yêu cầu đăng nhập |
|------|--------|-------------------|
| **Công khai** | `/login`, `/auth/*`, `/api/auth/*` | Không |
| **Bảo vệ** | `/dashboard/*`, `/api/*` (khác auth) | Có |

### 4.4. Client-side Guard

**File:** `src/components/RequireAuth.tsx`

```typescript
export function RequireAuth({ children }) {
  const session = useSession()
  const router = useRouter()

  useEffect(() => {
    if (session === null) {
      router.push('/login')
    }
  }, [session])

  if (!session) return null  // Không hiển thị gì khi đang check

  return children
}
```

---

## 5. Hệ thống phân quyền

### 5.1. Các vị trí (Position)

| Vị trí | Tiếng Anh | Quyền hạn |
|--------|-----------|-----------|
| **Quản lý** | Manager | Toàn quyền admin |
| **Trưởng phòng** | Team Lead | Quản lý dự án, team |
| **Chỉ huy** | Commander | Xem, phân công |
| **Cán bộ** | Officer | Xem, làm task |

### 5.2. Các quyền (Permissions)

**File:** `src/lib/permissions.ts`

```typescript
interface UserPermissions {
  canViewGantt: boolean        // Xem biểu đồ Gantt
  canViewTasks: boolean        // Xem công việc
  canViewTeam: boolean         // Xem team
  canEditProject: boolean      // Sửa dự án
  canDeleteProject: boolean    // Xóa dự án
  canManagePhases: boolean     // Quản lý giai đoạn
  canAssignTasks: boolean      // Phân công
  viewMode: "admin" | "board"  // Chế độ xem
}
```

### 5.3. Mapping quyền theo vị trí

```typescript
export function getUserPermissions(position: string): UserPermissions {
  const pos = position.toLowerCase()

  // Quản lý: Toàn quyền
  if (pos === "quản lý") {
    return {
      canViewGantt: true,
      canViewTasks: true,
      canViewTeam: true,
      canEditProject: true,
      canDeleteProject: true,
      canManagePhases: true,
      canAssignTasks: true,
      viewMode: "admin"
    }
  }

  // Trưởng phòng, Team Lead, Project Manager
  if (["trưởng phòng", "team lead", "project manager"].includes(pos)) {
    return {
      canViewGantt: true,
      canViewTasks: true,
      canViewTeam: true,
      canEditProject: true,
      canDeleteProject: false,  // Không được xóa
      canManagePhases: true,
      canAssignTasks: true,
      viewMode: "admin"
    }
  }

  // Chỉ huy, Cán bộ
  if (["chỉ huy", "cán bộ"].includes(pos)) {
    return {
      canViewGantt: false,
      canViewTasks: true,
      canViewTeam: true,
      canEditProject: false,
      canDeleteProject: false,
      canManagePhases: false,
      canAssignTasks: true,
      viewMode: "board"
    }
  }

  // Mặc định: Quyền tối thiểu
  return {
    canViewGantt: false,
    canViewTasks: true,
    canViewTeam: false,
    canEditProject: false,
    canDeleteProject: false,
    canManagePhases: false,
    canAssignTasks: false,
    viewMode: "board"
  }
}
```

### 5.4. Bảng tóm tắt quyền

| Quyền | Quản lý | Trưởng phòng | Chỉ huy | Cán bộ |
|-------|---------|--------------|---------|--------|
| canViewGantt | ✓ | ✓ | ✗ | ✗ |
| canViewTasks | ✓ | ✓ | ✓ | ✓ |
| canViewTeam | ✓ | ✓ | ✓ | ✗ |
| canEditProject | ✓ | ✓ | ✗ | ✗ |
| canDeleteProject | ✓ | ✗ | ✗ | ✗ |
| canManagePhases | ✓ | ✓ | ✗ | ✗ |
| canAssignTasks | ✓ | ✓ | ✓ | ✗ |
| viewMode | admin | admin | board | board |

---

## 6. Sử dụng trong code

### 6.1. Kiểm tra quyền trong component

```typescript
// Lấy thông tin user
const currentUser = await getCurrentUser()

// Lấy quyền theo position
const permissions = getUserPermissions(currentUser?.position || "")

// Ẩn/hiện theo quyền
return (
  <div>
    {permissions.canEditProject && (
      <Button>Sửa dự án</Button>
    )}

    {permissions.canDeleteProject && (
      <Button variant="destructive">Xóa dự án</Button>
    )}

    {permissions.viewMode === "admin" ? (
      <ProjectDetails project={project} />
    ) : (
      <ProjectBoard project={project} />
    )}
  </div>
)
```

### 6.2. Kiểm tra quyền trong API

```typescript
export async function POST(request: Request) {
  // Lấy user
  const { data: { user } } = await supabase.auth.getUser()

  if (!user) {
    return NextResponse.json({ error: 'Chưa đăng nhập' }, { status: 401 })
  }

  // Lấy profile với position
  const { data: profile } = await supabase
    .from('users')
    .select('position')
    .eq('id', user.id)
    .single()

  // Kiểm tra quyền
  const permissions = getUserPermissions(profile?.position || "")

  if (!permissions.canEditProject) {
    return NextResponse.json(
      { error: 'Không có quyền thực hiện' },
      { status: 403 }
    )
  }

  // Tiếp tục xử lý...
}
```

### 6.3. Điều hướng menu theo quyền

**File:** `src/components/sidebar.tsx`

```typescript
const menuItems = [
  {
    name: "Dashboard",
    href: "/dashboard",
    icon: HomeIcon,
    // Không yêu cầu quyền đặc biệt
  },
  {
    name: "Gantt Chart",
    href: "/dashboard/gantt",
    icon: ChartIcon,
    requiresPermission: "canViewGantt"  // Chỉ hiện nếu có quyền
  },
  {
    name: "Quản lý Team",
    href: "/dashboard/team",
    icon: UsersIcon,
    requiresPermission: "canViewTeam"
  }
]

// Lọc menu theo quyền
const visibleItems = menuItems.filter(item => {
  if (!item.requiresPermission) return true
  return permissions[item.requiresPermission]
})
```

---

## 7. API liên quan

### 7.1. Endpoints

| Method | Endpoint | Mô tả |
|--------|----------|-------|
| POST | `/api/auth/confirm` | Xác nhận email |
| GET | `/api/user/me` | Lấy thông tin user hiện tại |

### 7.2. Lấy thông tin user

```http
GET /api/user/me

Response:
{
  "user": {
    "id": "uuid-123",
    "email": "user@example.com"
  },
  "profile": {
    "id": "uuid-123",
    "full_name": "Nguyễn Văn A",
    "position": "Quản lý",
    "org_unit": "Phòng IT",
    "email": "user@example.com"
  }
}
```

---

## Workflow xác thực

### Đăng nhập

```
1. Vào /login
2. Nhập email và password
3. Nhấn "Đăng nhập"
4. Nếu đúng → Chuyển đến /dashboard
5. Nếu sai → Hiện thông báo lỗi
```

### Quên mật khẩu

```
1. Vào /login
2. Nhấn "Quên mật khẩu"
3. Nhập email
4. Nhấn "Gửi link reset"
5. Kiểm tra email
6. Click link trong email
7. Nhập mật khẩu mới
8. Đăng nhập với mật khẩu mới
```

### Truy cập route được bảo vệ

```
1. User chưa đăng nhập
2. Truy cập /dashboard/projects
3. Middleware kiểm tra → Không có session
4. Chuyển hướng đến /login?redirectTo=/dashboard/projects
5. User đăng nhập thành công
6. Tự động chuyển về /dashboard/projects
```

---

## Tóm tắt

1. **Supabase Auth:** Xử lý đăng nhập, đăng xuất, reset password
2. **Middleware:** Bảo vệ route, chuyển hướng tự động
3. **Vị trí (Position):** Quản lý > Trưởng phòng > Chỉ huy > Cán bộ
4. **Quyền:** 8 quyền khác nhau + viewMode (admin/board)
5. **Sử dụng:** Kiểm tra permissions trong component và API
6. **Route công khai:** /login, /auth/*, /api/auth/*
