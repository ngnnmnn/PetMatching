# ========================================================
# Dockerfile Backend NestJS + Prisma ORM (Multi-stage build)
# ========================================================

# Stage 1: Build source
FROM node:20-alpine AS builder

WORKDIR /app

# Cài đặt OpenSSL cho Prisma tương thích với kiến trúc Alpine Linux
RUN apk add --no-cache openssl

COPY package*.json ./
COPY prisma.config.ts ./
COPY prisma ./prisma/

RUN npm install

# Sinh mã Prisma Client trước khi biên dịch
RUN npx prisma generate

COPY . .

# Biên dịch mã nguồn NestJS sang dist
RUN npm run build

# Stage 2: Chạy ứng dụng môi trường Production (siêu nhẹ & bảo mật)
FROM node:20-alpine AS runner

WORKDIR /app

ENV NODE_ENV=production

RUN apk add --no-cache openssl

COPY package*.json ./
RUN npm install --omit=dev

# Sao chép các gói Prisma đã tạo và dist từ builder
COPY --from=builder /app/node_modules/.prisma ./node_modules/.prisma
COPY --from=builder /app/node_modules/@prisma ./node_modules/@prisma
COPY --from=builder /app/dist ./dist
COPY --from=builder /app/prisma ./prisma
COPY --from=builder /app/prisma.config.ts ./

EXPOSE 5000

CMD ["node", "dist/main.js"]
