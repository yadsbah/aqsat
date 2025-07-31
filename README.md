# Aqsat - نظام الأقساط

نظام إدارة المنتجات والأقساط مع لوحة إدارة آمنة.

## المميزات

- 🌐 واجهة مستخدم عربية جميلة
- 📱 تصميم متجاوب
- 🔐 نظام مصادقة آمن باستخدام JWT
- 📊 لوحة إدارة شاملة
- 🛍️ إدارة المنتجات والفئات
- 👥 إدارة المستخدمين والمشرفين
- 💰 حساب الأقساط تلقائياً
- 🔍 البحث في المنتجات

## التثبيت والتشغيل

### المتطلبات

- [Bun](https://bun.sh/) (أو Node.js)
- MySQL Database

### الخطوات

1. **استنساخ المشروع**

   ```bash
   git clone <repository-url>
   cd aqsat
   ```

2. **تثبيت التبعيات**

   ```bash
   bun install
   ```

3. **إعداد قاعدة البيانات**

   - أنشئ قاعدة بيانات MySQL
   - انسخ ملف `.env.example` إلى `.env`
   - عدّل متغيرات البيئة في ملف `.env`:
     ```env
     DATABASE_URL="mysql://username:password@localhost:3306/aqsat"
     JWT_SECRET="your-secret-key-change-in-production"
     ```

4. **تشغيل الهجرات**

   ```bash
   bunx prisma migrate dev
   ```

5. **إعداد البيانات الأولية**

   ```bash
   bun run seed.ts
   ```

6. **تشغيل الخادم**

   ```bash
   bun run dev
   ```

7. **فتح التطبيق**
   - الموقع الرئيسي: http://localhost:3000
   - لوحة الإدارة: http://localhost:3000/admin
   - إدارة المستخدمين: http://localhost:3000/admin/users

## نظام المصادقة

### المستخدم الافتراضي

تم إنشاء مستخدم افتراضي للوحة الإدارة:

- **اسم المستخدم:** `admin`
- **كلمة المرور:** `admin123`

### إنشاء مستخدمين جدد

يمكنك إنشاء مستخدمين إضافيين باستخدام:

```bash
bun run create-user.ts <username> <password>
```

مثال:

```bash
bun run create-user.ts admin2 mypassword123
```

### ميزات الأمان

- 🔐 تشفير كلمات المرور باستخدام bcrypt
- 🎫 JWT tokens للمصادقة
- ⏰ انتهاء صلاحية الجلسة بعد 24 ساعة
- 🔒 حماية جميع نقاط النهاية الإدارية
- 🚫 إلغاء التوكن عند تسجيل الخروج
- 👤 التحقق من وجود المستخدم في قاعدة البيانات
- 🛡️ منع حذف الحساب الشخصي

## هيكل المشروع

```
aqsat/
├── src/
│   ├── index.ts          # الخادم الرئيسي
│   ├── db.ts            # إعداد قاعدة البيانات
│   └── generated/       # ملفات Prisma المولدة
├── prisma/
│   ├── schema.prisma    # مخطط قاعدة البيانات
│   └── migrations/      # ملفات الهجرة
├── public/
│   ├── admin/           # صفحات لوحة الإدارة
│   ├── components/      # مكونات HTML
│   └── *.html          # صفحات الموقع الرئيسي
├── seed.ts             # إعداد البيانات الأولية
├── create-user.ts      # إنشاء مستخدمين جدد
└── package.json
```

## API Endpoints

### المصادقة

- `POST /api/auth/login` - تسجيل الدخول
- `POST /api/auth/register` - إنشاء حساب جديد
- `GET /api/auth/verify` - التحقق من صحة التوكن
- `POST /api/auth/logout` - تسجيل الخروج وإلغاء التوكن

### المنتجات (عامة)

- `GET /api/products` - قائمة المنتجات
- `GET /api/products/:id` - تفاصيل المنتج
- `GET /api/search` - البحث في المنتجات

### الفئات (عامة)

- `GET /api/categories` - قائمة الفئات
- `GET /api/categories/:id` - تفاصيل الفئة
- `GET /api/categories/:id/products` - منتجات الفئة

### الإدارة (محمية)

- `POST /api/products` - إنشاء منتج جديد
- `PUT /api/products/:id` - تحديث منتج
- `DELETE /api/products/:id` - حذف منتج
- `POST /api/categories` - إنشاء فئة جديدة
- `PUT /api/categories/:id` - تحديث فئة
- `DELETE /api/categories/:id` - حذف فئة
- `GET /api/users` - قائمة المستخدمين
- `POST /api/users` - إنشاء مستخدم جديد
- `PUT /api/users/:id` - تحديث مستخدم
- `DELETE /api/users/:id` - حذف مستخدم

## حساب الأقساط

النظام يحسب الأقساط تلقائياً بناءً على الفترات التالية:

- **10 أشهر:** عمولة 28%
- **14 شهر:** عمولة 30%
- **18 شهر:** عمولة 35%

## التطوير

### تشغيل في وضع التطوير

```bash
bun run dev
```

### إعادة تشغيل قاعدة البيانات

```bash
bunx prisma migrate reset
bun run seed.ts
```

### إنشاء هجرة جديدة

```bash
bunx prisma migrate dev --name <migration-name>
```

## الأمان

### في الإنتاج

1. **تغيير JWT_SECRET**

   ```env
   JWT_SECRET="your-very-secure-secret-key-here"
   ```

2. **تأمين قاعدة البيانات**

   - استخدم كلمة مرور قوية
   - قلل صلاحيات المستخدم
   - فعّل SSL

3. **تأمين الخادم**
   - استخدم HTTPS
   - فعّل CORS بشكل صحيح
   - راجع سجلات الأمان

## المساهمة

نرحب بالمساهمات! يرجى:

1. Fork المشروع
2. إنشاء فرع للميزة الجديدة
3. Commit التغييرات
4. Push إلى الفرع
5. إنشاء Pull Request

## الترخيص

هذا المشروع مرخص تحت رخصة MIT.
