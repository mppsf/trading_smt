    FROM python:3.11-slim

    WORKDIR /app

    # Устанавливаем системные зависимости
    RUN apt-get update && apt-get install -y \
        curl \
        && rm -rf /var/lib/apt/lists/*

    # Копируем requirements.txt
    COPY requirements.txt .

    # Устанавливаем Python зависимости
    RUN pip install --no-cache-dir -r requirements.txt

    # Копируем исходный код
    COPY . .

    # Создаем директорию для данных
    RUN mkdir -p /app/data

    # Открываем порт
    EXPOSE 8000

    # Команда для запуска FastAPI сервера
    CMD ["python", "-m", "uvicorn", "app.main:app", "--host", "0.0.0.0", "--port", "8000", "--reload"]
