[Reading 69 lines from start (total: 69 lines, 0 remaining)]

<?php

declare(strict_types=1);

namespace SAMS\Controllers;

use SAMS\Helpers\Auth;
use SAMS\Helpers\Csrf;
use SAMS\Helpers\Security;
use SAMS\Http\Request;
use SAMS\Http\Response;
use SAMS\Repositories\ClassRepository;
use SAMS\Services\SignatureService;

final class SignatureController
{
    public function __construct(private readonly SignatureService $service = new SignatureService()) {}

    public function validate(array $input): string
    {
        return $this->service->validatePngDataUrl((string)($input['signature_data'] ?? ''));
    }

    public function __invoke(Request $request, array $params = []): Response
    {
        $this->startSession();
        try {
            $user = Auth::requireLogin();
            $classId = isset($params['id']) && ctype_digit((string)$params['id'])
                ? (int)$params['id'] : 0;
            if ($classId < 1) return Response::json(['success' => false, 'error' => 'Invalid class.'], 422);
            if (!(new ClassRepository())->hasAccess($user['id'], $user['role'], $classId)) {
                return Response::json(['success' => false, 'error' => 'Forbidden.'], 403);
            }
            if ($request->method() === 'GET') {
                return Response::json(['success' => true, 'data' => ['signature' => $this->service->get((int)$user['id'], $classId)]]);
            }
            if (!in_array($request->method(), ['POST', 'DELETE'], true)) {
                return Response::json(['success' => false, 'error' => 'Method not allowed.'], 405, ['Allow' => 'GET, POST, DELETE']);
            }
            Auth::requireRole('admin', 'teacher');
            if (!Csrf::verify($request->header('x-csrf-token'))) {
                return Response::json(['success' => false, 'error' => 'Invalid CSRF token.'], 419);
            }
            if ($request->method() === 'DELETE') {
                $changed = $this->service->delete((int)$user['id'], $classId);
                return Response::json(['success' => true, 'data' => ['changed' => $changed]]);
            }
            $body = $request->jsonBody();
            $saved = $this->service->save((int)$user['id'], $classId, (string)($body['signature_data'] ?? ''));
            return Response::json(['success' => true, 'data' => ['signature' => $saved]]);
        } catch (\SAMS\Exceptions\RequestPayloadTooLargeException $e) {
            return Response::json(['success' => false, 'error' => $e->getMessage()], $e->httpStatus());
        } catch (\InvalidArgumentException $e) {
            return Response::json(['success' => false, 'error' => $e->getMessage()], 422);
        } catch (\Throwable $e) {
            error_log('[SAMS signature API] ' . $e->getMessage());
            return Response::json(['success' => false, 'error' => 'Server error.'], 500);
        }
    }

    private function startSession(): void
    {
        Security::startSession(
            (string)($GLOBALS['appConfig']['session_name'] ?? 'SAMS_SESSION'),
            (int)($GLOBALS['appConfig']['session_lifetime'] ?? 3600)
        );
    }
}
