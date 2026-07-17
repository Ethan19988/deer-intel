# Terrain worker image: the 1 m LiDAR pipeline + a Supabase job runner.
#
# Build from the REPO ROOT so the pipeline scripts are in the context:
#   docker build -f pipeline/terrain/worker/Dockerfile -t deer-intel-terrain-worker .
#
# The base carries a full system GDAL (gdalwarp, gdal_contour, ogr2ogr) that the
# pipeline shells out to; the Python geo-wheels are layered on top.
FROM ghcr.io/osgeo/gdal:ubuntu-small-latest

ENV PYTHONUNBUFFERED=1 \
    DEBIAN_FRONTEND=noninteractive

RUN apt-get update \
 && apt-get install -y --no-install-recommends python3-pip \
 && rm -rf /var/lib/apt/lists/*

WORKDIR /app
COPY pipeline/terrain/worker/requirements.txt /app/requirements.txt
RUN pip3 install --no-cache-dir --break-system-packages -r /app/requirements.txt

# WhiteboxTools ships a native binary the `whitebox` package fetches on first
# use — pull it at build time so the first job doesn't pay for it.
RUN python3 -c "import whitebox; whitebox.WhiteboxTools()" || true

COPY pipeline/terrain/ /app/pipeline/terrain/

WORKDIR /app/pipeline/terrain
CMD ["python3", "worker/runner.py"]
