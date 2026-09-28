<?php

declare(strict_types=1);

namespace SAMS\Http;

use InvalidArgumentException;
use JsonException;
use SAMS\Exceptions\RequestPayloadTooLargeException;

final class Request
{
    public const MAX_JSON_BODY_SIZE = 1_000_000;

    public function __construct(
        private readonly string $method,
        private readonly string $path,
        private readonly array $query = [],
        private readonly array $headers = [],
        private readonly string $rawBody = '',
        private readonly array $postData = [],
        private readonly array $files = []
    ) {}

    public static function fromGlobals(): self
    {
        $uri = (string)($_SERVER['REQUEST_URI'] ?? '/');
        $path = (string)(parse_url($uri, PHP_URL_PATH) ?? '/');

        $headers = [];

        if (function_exists('getallheaders')) {
            foreach ((array)getallheaders() as $name => $value) {
                $headers[strtolower((string)$name)] = (string)$value;
            }
        }

        foreach ($_SERVER as $name => $value) {
            if (!is_string($value) || !str_starts_with($name, 'HTTP_')) {
                continue;
            }

            $headerName = strtolower(str_replace('_', '-', substr($name, 5)));

            if (!isset($headers[$headerName])) {
                $headers[$headerName] = $value;
            }
        }

        foreach (['CONTENT_TYPE' => 'content-type', 'CONTENT_LENGTH' => 'content-length'] as $serverName => $headerName) {
            $value = $_SERVER[$serverName] ?? null;
            if (is_string($value) && $value !== '' && !isset($headers[$headerName])) {
                $headers[$headerName] = $value;
            }
        }

        $contentLength = (string)($_SERVER['CONTENT_LENGTH'] ?? '');
        $contentType = strtolower((string)(
            $headers['content-type']
            ?? $_SERVER['CONTENT_TYPE']
            ?? ''
        ));
        if (
            ctype_digit($contentLength)
            && (int)$contentLength > self::MAX_JSON_BODY_SIZE
            && !str_starts_with($contentType, 'multipart/form-data')
        ) {
            throw new RequestPayloadTooLargeException('Request payload is too large.');
        }

        $rawBody = file_get_contents('php://input');
        if ($rawBody === false) {
            throw new InvalidArgumentException('Unable to read request payload.');
        }

        return new self(
            strtoupper((string)($_SERVER['REQUEST_METHOD'] ?? 'GET')),
            $path === '' ? '/' : $path,
            $_GET,
            $headers,
            $rawBody,
            is_array($_POST) ? $_POST : [],
            is_array($_FILES) ? $_FILES : []
        );
    }

    public function method(): string
    {
        return $this->method;
    }

    public function path(): string
    {
        return $this->path;
    }

    public function query(): array
    {
        return $this->query;
    }

    public function queryValue(string $key, mixed $default = null): mixed
    {
        return $this->query[$key] ?? $default;
    }

    public function header(string $name, ?string $default = null): ?string
    {
        return $this->headers[strtolower($name)] ?? $default;
    }

    public function rawBody(): string
    {
        return $this->rawBody;
    }

    public function post(): array
    {
        return $this->postData;
    }

    public function postValue(string $key, mixed $default = null): mixed
    {
        return $this->postData[$key] ?? $default;
    }

    public function file(string $key): ?array
    {
        $file = $this->files[$key] ?? null;
        return is_array($file) ? $file : null;
    }

    public function jsonBody(): array
    {
        if (trim($this->rawBody) === '') {
            return [];
        }

        if (strlen($this->rawBody) > self::MAX_JSON_BODY_SIZE) {
            throw new RequestPayloadTooLargeException('JSON payload is too large.');
        }

        try {
            $data = json_decode($this->rawBody, true, 512, JSON_THROW_ON_ERROR);
        } catch (JsonException $e) {
            throw new InvalidArgumentException('Invalid JSON payload.', 0, $e);
        }

        if (!is_array($data) || array_is_list($data)) {
            throw new InvalidArgumentException('Invalid JSON payload.');
        }

        return $data;
    }

    public function withPath(string $path): self
    {
        if ($path === '' || $path[0] !== '/') {
            throw new InvalidArgumentException('Request path must start with "/".');
        }

        return new self(
            $this->method,
            $path,
            $this->query,
            $this->headers,
            $this->rawBody,
            $this->postData,
            $this->files
        );
    }
}
