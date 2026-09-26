<?php

declare(strict_types=1);

namespace SAMS\Routing;

use SAMS\Http\Request;
use SAMS\Http\Response;

final class Router
{
    /** @var list<array{method:string,pattern:string,regex:string,handler:callable}> */
    private array $routes = [];

    public function get(string $pattern, callable $handler): void
    {
        $this->add('GET', $pattern, $handler);
    }

    public function post(string $pattern, callable $handler): void
    {
        $this->add('POST', $pattern, $handler);
    }

    public function add(string $method, string $pattern, callable $handler): void
    {
        $method = strtoupper(trim($method));
        $pattern = '/' . trim($pattern, '/');

        if ($pattern !== '/' && str_ends_with($pattern, '/')) {
            $pattern = rtrim($pattern, '/');
        }

        $quoted = preg_quote($pattern, '~');
        $regex = preg_replace_callback(
            '/\\\{([A-Za-z_][A-Za-z0-9_]*)\\\}/',
            static fn(array $matches): string => '(?P<' . $matches[1] . '>[^/]+)',
            $quoted
        );

        if (!is_string($regex)) {
            throw new \RuntimeException('Unable to compile route pattern.');
        }

        $this->routes[] = [
            'method' => $method,
            'pattern' => $pattern,
            'regex' => '~^' . $regex . '/?$~D',
            'handler' => $handler,
        ];
    }

    public function dispatch(Request $request): Response
    {
        $path = $request->path();
        $allowedMethods = [];

        foreach ($this->routes as $route) {
            if (preg_match($route['regex'], $path, $matches) !== 1) {
                continue;
            }

            $allowedMethods[] = $route['method'];

            if ($route['method'] !== $request->method()) {
                continue;
            }

            $params = [];

            foreach ($matches as $key => $value) {
                if (is_string($key)) {
                    $params[$key] = rawurldecode($value);
                }
            }

            $response = ($route['handler'])($request, $params);

            if (!$response instanceof Response) {
                throw new \RuntimeException('Route handlers must return SAMS\\Http\\Response.');
            }

            return $response;
        }

        if ($allowedMethods !== []) {
            $allow = array_values(array_unique($allowedMethods));

            return Response::json(
                [
                    'success' => false,
                    'error' => 'Method not allowed.',
                ],
                405,
                ['Allow' => implode(', ', $allow)]
            );
        }

        return Response::json(
            [
                'success' => false,
                'error' => 'Route not found.',
            ],
                404
        );
    }
}
