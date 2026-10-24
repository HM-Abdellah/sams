FROM php:8.3-cli-trixie

# Keep the development runtime aligned with backend/composer.json. PhpSpreadsheet
# needs ZIP support to read XLSX archives; GD is also a declared backend platform
# requirement and may be used when workbooks contain drawing/image resources.
RUN apt-get update \
    && apt-get install -y --no-install-recommends \
        libzip-dev \
        libpng-dev \
        libjpeg62-turbo-dev \
        libfreetype6-dev \
    && docker-php-ext-configure gd --with-freetype --with-jpeg \
    && docker-php-ext-install pdo_mysql zip gd \
    && rm -rf /var/lib/apt/lists/*

WORKDIR /workspace
