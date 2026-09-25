<?php

declare(strict_types=1);

$root = dirname(__DIR__);
$uri = (string)parse_url((string)($_SERVER['REQUEST_URI'] ?? '/'), PHP_URL_PATH);

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

if (str_starts_with($uri, '/api/')) {
    $file = $root . $uri;
    if (is_file($file)) {
        return false;
    }
}

http_response_code(404);
header('Content-Type: text/plain; charset=utf-8');
echo "Not found";
