<?php

declare(strict_types=1);

$root = dirname(__DIR__);
$uri = parse_url((string)($_SERVER['REQUEST_URI'] ?? '/'), PHP_URL_PATH) ?: '/';

if ($uri === '/public' || $uri === '/public/') {
    require $root . '/public/index.php';
    return;
}

if (str_starts_with($uri, '/public/')) {
    $file = $root . $uri;

    if (is_file($file)) {
        return false;
    }
}

if ($uri === '/api/v1' || str_starts_with($uri, '/api/v1/')) {
    require $root . '/backend/public/index.php';
    return;
}

if ($uri === '/api' || str_starts_with($uri, '/api/')) {
    $file = $root . $uri;

    if (is_file($file)) {
        return false;
    }
}

http_response_code(404);
header('Content-Type: text/plain; charset=UTF-8');
echo 'Not Found';
