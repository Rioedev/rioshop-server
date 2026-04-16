# Rioshop Server (Backend API)

Backend API cho dự án Rioshop, xây dựng với Express + MongoDB + Redis + Socket.IO.

## 1. Công nghệ chính

- Node.js (khuyến nghị Node 18+)
- Express 5
- MongoDB + Mongoose
- Redis (cache/rate-limit hỗ trợ)
- Socket.IO (realtime)
- Joi (validation)

## 2. Chức năng hiện có

- Xác thực user/admin bằng JWT
- Quản lý sản phẩm, danh mục, bộ sưu tập, tồn kho
- Giỏ hàng, đơn hàng, thanh toán (MoMo)
- Theo dõi vận chuyển GHN
- Flash sale, coupon, blog, review, wishlist
- Notification realtime
- Analytics events
- Tự động hóa vòng đời đơn hàng/vận đơn/notification

## 3. Cấu trúc thư mục

```text
server/
├── src/
│   ├── config/         # Kết nối DB, Redis, Cloudinary
│   ├── constants/      # Hằng số hệ thống
│   ├── controllers/    # Xử lý request/response
│   ├── middlewares/    # Auth, validate, rate limit, error handler
│   ├── models/         # Mongoose models
│   ├── routes/         # API routes
│   ├── services/       # Business logic
│   ├── sockets/        # Socket gateway + handlers
│   ├── utils/          # Helper/response utils
│   └── validations/    # Joi schemas
├── scripts/            # Script seed/test/email/ghn
├── server.js           # Entry point
└── package.json
```

## 4. Cài đặt

```bash
cd server
npm install
```

Tạo file `.env` (có thể copy từ cấu hình hiện tại của team hoặc tự tạo mới theo mẫu bên dưới).

## 5. Biến môi trường

### 5.1 Nhóm bắt buộc tối thiểu

```env
PORT=5000
NODE_ENV=development

MONGO_URI=mongodb://localhost:27017/rioshop
REDIS_URL=redis://localhost:6379

JWT_SECRET=your_jwt_secret
JWT_EXPIRE=7d

CORS_ORIGIN=http://localhost:5173
```

### 5.2 Thanh toán MoMo

```env
MOMO_PARTNER_CODE=your_partner_code
MOMO_ACCESS_KEY=your_access_key
MOMO_SECRET_KEY=your_secret_key
MOMO_REQUEST_TYPE=payWithMethod
MOMO_PARTNER_NAME=Rioshop
MOMO_STORE_ID=RioshopStore

PUBLIC_API_URL=http://localhost:5000
STOREFRONT_URL=http://localhost:5173
```

### 5.3 GHN (vận chuyển)

```env
GHN_API_KEY=your_ghn_token
GHN_SHOP_ID=your_ghn_shop_id
GHN_API_BASE_URL=https://dev-online-gateway.ghn.vn/shiip/public-api
GHN_MASTER_DATA_BASE_URL=https://dev-online-gateway.ghn.vn/shiip/public-api/master-data
GHN_TRACKING_BASE_URL=https://donhang.ghn.vn/?order_code=
GHN_TIMEOUT_MS=15000

GHN_FROM_NAME=RioShop
GHN_FROM_PHONE=0123456789
GHN_FROM_ADDRESS=Your warehouse address
GHN_FROM_DISTRICT_ID=0
GHN_FROM_WARD_CODE=
```

### 5.4 Email

```env
EMAIL_ENABLED=true
SMTP_HOST=smtp.example.com
SMTP_PORT=587
SMTP_SECURE=false
SMTP_USER=your_user
SMTP_PASS=your_pass
SMTP_FROM_NAME=RioShop
SMTP_FROM_EMAIL=no-reply@example.com
SMTP_TEST_TO=you@example.com
EMAIL_LOG_VERBOSE=true
```

### 5.5 Cloudinary (upload media)

```env
CLOUDINARY_CLOUD_NAME=your_cloud_name
CLOUDINARY_API_KEY=your_api_key
CLOUDINARY_API_SECRET=your_api_secret
```

### 5.6 Job tự động (automation)

```env
# Auto xử lý vòng đời order
AUTO_ORDER_JOB_ENABLED=true
AUTO_ORDER_JOB_INTERVAL_MS=300000
AUTO_CANCEL_PENDING_PAYMENT_MINUTES=30
AUTO_COMPLETE_DELIVERED_DAYS=3
RETURN_REQUEST_WINDOW_DAYS=3
AUTO_CANCEL_PAYMENT_METHODS=momo,vnpay,zalopay,card

# Auto đồng bộ GHN
AUTO_GHN_SYNC_JOB_ENABLED=true
AUTO_GHN_SYNC_INTERVAL_MS=60000
AUTO_GHN_SYNC_BATCH_LIMIT=20

# Auto dọn notification
AUTO_NOTIFICATION_CLEANUP_ENABLED=true
AUTO_NOTIFICATION_CLEANUP_INTERVAL_MS=3600000
NOTIFICATION_UNREAD_RETENTION_DAYS=15
```

### 5.7 Tinh chỉnh khác

```env
RATE_LIMIT_WINDOW_MS=900000
RATE_LIMIT_MAX=300
FRONTEND_URL=http://localhost:5173
```

## 6. Chạy project

### Chế độ dev

```bash
npm run dev
```

### Chế độ production local

```bash
npm start
```

Server mặc định chạy tại `http://localhost:5000`.

## 7. Scripts hữu ích

- `npm run dev`: chạy server với nodemon
- `npm start`: chạy server bằng node
- `npm test`: chạy test backend tại `../test/server/*.test.js`
- `npm run seed` hoặc `npm run seed:storefront`: seed dữ liệu storefront
- `npm run seed:fashion-demo`: seed dữ liệu demo thời trang
- `npm run email:test`: gửi email test
- `npm run ghn:resolve`: hỗ trợ resolve địa chỉ GHN

Lưu ý: `package.json` đang có khai báo script `fix:user-indexes`, nhưng hiện tại chưa có file `scripts/fixUserReferralIndex.js`.

## 8. API chính

Các route đang mount tại `server.js`:

- `/api/auth`
- `/api/users`
- `/api/products`
- `/api/categories`
- `/api/collections`
- `/api/carts`
- `/api/orders`
- `/api/payments`
- `/api/shipments`
- `/api/reviews`
- `/api/wishlists`
- `/api/coupons`
- `/api/notifications`
- `/api/analytics`
- `/api/inventories`
- `/api/admins`
- `/api/flash-sales`
- `/api/brand-configs`
- `/api/blogs`

Health check:

- `GET /health`

## 9. Realtime (Socket.IO)

Server phát realtime cho các kênh chính:

- Notification user (`notification`)
- Cập nhật đơn hàng (`order-updated`)
- Cập nhật tồn kho (`inventory-updated`)
- Cập nhật flash sale (`flash-sale-updated`)

## 10. Ghi chú vận hành

- Không commit file `.env` thật chứa secret lên repository công khai.
- Khi bật Redis/GHN/Email ở môi trường production, cần dùng thông tin thật và giới hạn quyền API key.
- Notification cleanup đang chạy tự động với rule hiện tại:
  - đã đọc: xóa ở lần chạy job kế tiếp
  - chưa đọc: quá `NOTIFICATION_UNREAD_RETENTION_DAYS` thì xóa
