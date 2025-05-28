# Multi-stage build для React приложения
FROM node:18-alpine as builder

WORKDIR /app

# Копируем package.json и package-lock.json
COPY package*.json ./

# Устанавливаем зависимости
RUN npm ci --only=production

# Копируем исходный код
COPY . .

# Собираем приложение
RUN npm run build

# Production stage
FROM nginx:alpine

# Копируем собранные файлы
COPY --from=builder /app/build /usr/share/nginx/html

# Копируем конфигурацию nginx (опционально)
# COPY nginx.conf /etc/nginx/nginx.conf

# Открываем порт
EXPOSE 80

CMD ["nginx", "-g", "daemon off;"]