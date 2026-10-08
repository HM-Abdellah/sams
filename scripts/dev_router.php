<?php

declare(strict_types=1);

$root = dirname(__DIR__);
$uri = parse_url((string)($_SERVER['REQUEST_URI'] ?? '/'), PHP_URL_PATH) ?: '/';
$sitePrefix = '/sams';
if ($uri === $sitePrefix) {
    $uri = '/';
} elseif (str_starts_with($uri, $sitePrefix . '/')) {
    $uri = substr($uri, strlen($sitePrefix)) ?: '/';
}

if ($uri === '/api/v1' || str_starts_with($uri, '/api/v1/')) {
    require $root . '/backend/public/index.php';
    return;
}

if ($uri === '/api' || str_starts_with($uri, '/api/')) {
    $file = $root . $uri;
    if (is_file($file)) {
        if (str_ends_with(strtolower($file), '.php')) {
            require $file;
            return;
        }

        return false;
    }
}

if ($uri === '/public/login.php' || $uri === '/public/index.php') {
    http_response_code(410);
    header('Content-Type: text/plain; charset=UTF-8');
    echo 'Legacy frontend entry point has been retired.';
    return;
}

$frontendRoot = realpath($root . '/frontend/dist');
if ($frontendRoot === false) {
    http_response_code(503);
    header('Content-Type: text/plain; charset=UTF-8');
    echo 'Frontend build is missing. Run npm --prefix frontend run build first.';
    return;
}
$requestPath = rawurldecode($uri);
$relativePath = ltrim($requestPath, '/');

if ($relativePath !== '' && !str_contains($relativePath, "\0")) {
    $candidate = realpath($frontendRoot . DIRECTORY_SEPARATOR . $relativePath);
    if ($candidate !== false
        && str_starts_with($candidate, $frontendRoot . DIRECTORY_SEPARATOR)
        && is_file($candidate)
    ) {
        $extension = strtolower(pathinfo($candidate, PATHINFO_EXTENSION));
        $contentTypes = [
            'css' => 'text/css; charset=UTF-8',
            'html' => 'text/html; charset=UTF-8',
            'js' => 'text/javascript; charset=UTF-8',
            'json' => 'application/json; charset=UTF-8',
            'svg' => 'image/svg+xml',
            'png' => 'image/png',
            'webp' => 'image/webp',
            'ico' => 'image/x-icon',
            'woff2' => 'font/woff2',
        ];
        header('Content-Type: ' . ($contentTypes[$extension] ?? 'application/octet-stream'));
        if ($extension === 'html') {
            header('Cache-Control: no-store, max-age=0');
        }
        readfile($candidate);
        return;
    }
}

header('Content-Type: text/html; charset=UTF-8');
header('Cache-Control: no-store, max-age=0');
readfile($frontendRoot . '/index.html');

