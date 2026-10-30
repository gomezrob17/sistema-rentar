FROM python:3.12-slim
WORKDIR /repo/services/maintenance_service
COPY services/maintenance_service/requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt
COPY messaging/ /repo/messaging/
ENV PYTHONPATH=/repo
COPY services/maintenance_service/ .
CMD ["python", "-m", "app.worker"]
