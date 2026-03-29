# use a Python 3.12 base image
FROM python:3.12-slim

# Install system dependencies (needed for OpenCV and ONNX)
RUN apt-get update && apt-get install -y \
    libgl1-mesa-glx \
    libglib2.0-0 \
    && rm -rf /var/lib/apt/lists/*

# Set the working directory inside the container
WORKDIR /app

# Copy the requirements file into the container
COPY ai-service/requirements.txt .

# Install dependencies (using --no-cache-dir to save space)
RUN pip install --no-cache-dir -r requirements.txt

# Copy the rest of the application code
COPY ai-service/ .

# Set the environment variable for Python path to find "service" module
ENV PYTHONPATH=/app

# Expose the port Railway will assign (default 8000 if not set)
EXPOSE 8000

# Start the application using uvicorn
# We use $PORT if provided, otherwise default to 8000
CMD uvicorn service.main:app --host 0.0.0.0 --port ${PORT:-8000}
