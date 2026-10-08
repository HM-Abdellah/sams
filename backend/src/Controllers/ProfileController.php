<?php

declare(strict_types=1);

namespace SAMS\Controllers;

use SAMS\Helpers\Auth;
use SAMS\Helpers\Csrf;
use SAMS\Helpers\Security;
use SAMS\Http\Request;
use SAMS\Http\Response;
use SAMS\Repositories\AuditLogRepository;
use SAMS\Repositories\UserRepository;
use SAMS\Services\UserService;

final class ProfileController
{
    private const MAX_AVATAR_BYTES = 2_000_000;

    public function __invoke(Request $request, array $params = []): Response
    {
        Security::startSession(
            (string)($GLOBALS['appConfig']['session_name'] ?? 'SAMS_SESSION'),
            (int)($GLOBALS['appConfig']['session_lifetime'] ?? 3600)
        );

        $user = Auth::requireLogin();
        $action = (string)($params['action'] ?? '');

        try {
            if ($request->method() === 'GET' && $action === '') {
                $profile = (new UserRepository())->profileById(
                    (int)$user['id'],
                    (int)$user['school_id']
                );

                if ($profile === null) {
                    return Response::json([
                        'success' => false,
                        'error' => 'Profile not found.',
                    ], 404);
                }

                return Response::json([
                    'success' => true,
                    'data' => [
                        'id' => (int)$profile['id'],
                        'username' => (string)$profile['username'],
                        'full_name' => (string)$profile['full_name'],
                        'role' => (string)$profile['role'],
                        'avatar_url' => $profile['avatar_path'] ? '/api/v1/profile/avatar' : null,
                    ],
                ]);
            }

            if ($request->method() === 'GET' && $action === 'avatar') {
                $profile = (new UserRepository())->profileById(
                    (int)$user['id'],
                    (int)$user['school_id']
                );
                if ($profile === null || empty($profile['avatar_path'])) {
                    return Response::json([
                        'success' => false,
                        'error' => 'Profile avatar not found.',
                    ], 404);
                }

                $root = dirname(__DIR__, 2);
                $storageRoot = realpath($root . '/storage/avatars');
                $relative = ltrim((string)$profile['avatar_path'], '/');
                if ($storageRoot === false || $relative === '' || str_contains($relative, '..')) {
                    return Response::json([
                        'success' => false,
                        'error' => 'Profile avatar not found.',
                    ], 404);
                }

                $path = realpath($storageRoot . DIRECTORY_SEPARATOR . basename($relative));
                if ($path === false || !str_starts_with($path, $storageRoot . DIRECTORY_SEPARATOR) || !is_file($path)) {
                    return Response::json([
                        'success' => false,
                        'error' => 'Profile avatar not found.',
                    ], 404);
                }

                $mime = (new \finfo(FILEINFO_MIME_TYPE))->file($path) ?: 'application/octet-stream';
                $allowed = ['image/jpeg', 'image/png', 'image/webp'];
                if (!in_array($mime, $allowed, true)) {
                    return Response::json([
                        'success' => false,
                        'error' => 'Profile avatar not found.',
                    ], 404);
                }

                $body = file_get_contents($path);
                if ($body === false) {
                    return Response::json([
                        'success' => false,
                        'error' => 'Profile avatar could not be read.',
                    ], 500);
                }

                return new Response($body, 200, [
                    'Content-Type' => $mime,
                    'Content-Length' => (string)strlen($body),
                    'Cache-Control' => 'private, max-age=0, no-store',
                ]);
            }

            if ($request->method() !== 'POST' || $action !== '') {
                return Response::json([
                    'success' => false,
                    'error' => 'Profile route not found.',
                ], 404);
            }

            if (!Csrf::verify($request->header('x-csrf-token'))) {
                return Response::json([
                    'success' => false,
                    'error' => 'Invalid CSRF token.',
                ], 419);
            }

            $userRepository = new UserRepository();
            $existing = $userRepository->profileById((int)$user['id'], (int)$user['school_id']);
            if ($existing === null) {
                return Response::json([
                    'success' => false,
                    'error' => 'Profile not found.',
                ], 404);
            }

            $validator = new UserService();
            $username = $validator->validateUsername((string)$request->postValue('username', ''));
            $fullName = $validator->validateFullName((string)$request->postValue('full_name', ''));
            $clearAvatar = (string)$request->postValue('remove_avatar', '0') === '1';

            $newAvatarPath = null;
            $newAvatarAbsolute = null;
            $avatar = $request->file('avatar');

            if ($avatar !== null && !$clearAvatar) {
                $error = (int)($avatar['error'] ?? UPLOAD_ERR_NO_FILE);
                $size = (int)($avatar['size'] ?? 0);
                $tmp = (string)($avatar['tmp_name'] ?? '');

                if ($error !== UPLOAD_ERR_OK || $tmp === '' || !is_uploaded_file($tmp)) {
                    throw new \InvalidArgumentException('Invalid profile image upload.');
                }
                if ($size < 1 || $size > self::MAX_AVATAR_BYTES) {
                    throw new \InvalidArgumentException('Profile image must be 2 MB or smaller.');
                }

                $mime = (new \finfo(FILEINFO_MIME_TYPE))->file($tmp) ?: '';
                $extension = match ($mime) {
                    'image/jpeg' => 'jpg',
                    'image/png' => 'png',
                    'image/webp' => 'webp',
                    default => null,
                };
                if ($extension === null || @getimagesize($tmp) === false) {
                    throw new \InvalidArgumentException('Profile image must be JPG, PNG, or WebP.');
                }

                $storageDir = dirname(__DIR__, 2) . '/storage/avatars';
                if (!is_dir($storageDir) && !mkdir($storageDir, 0750, true) && !is_dir($storageDir)) {
                    throw new \RuntimeException('Profile image storage is unavailable.');
                }

                $filename = bin2hex(random_bytes(24)) . '.' . $extension;
                $newAvatarAbsolute = $storageDir . DIRECTORY_SEPARATOR . $filename;
                if (!move_uploaded_file($tmp, $newAvatarAbsolute)) {
                    throw new \RuntimeException('Profile image could not be stored.');
                }
                @chmod($newAvatarAbsolute, 0640);
                $newAvatarPath = 'avatars/' . $filename;
            }

            $pdo = \SAMS\Helpers\Database::connection();
            $pdo->beginTransaction();

            try {
                $userRepository->updateSelfProfile(
                    (int)$user['id'],
                    (int)$user['school_id'],
                    $username,
                    $fullName,
                    $newAvatarPath,
                    $clearAvatar
                );

                (new AuditLogRepository())->record(
                    (int)$user['id'],
                    'user.profile_updated',
                    'user',
                    (int)$user['id'],
                    [
                        'username_changed' => $username !== (string)$existing['username'],
                        'full_name_changed' => $fullName !== (string)$existing['full_name'],
                        'avatar_changed' => $clearAvatar || $newAvatarPath !== null,
                    ]
                );

                $pdo->commit();
            } catch (\PDOException $e) {
                if ($pdo->inTransaction()) $pdo->rollBack();
                if ($newAvatarAbsolute !== null) @unlink($newAvatarAbsolute);
                if ((int)($e->errorInfo[1] ?? 0) === 1062) {
                    throw new \SAMS\Exceptions\AdministrationException('Username already exists.', 409);
                }
                throw $e;
            } catch (\Throwable $e) {
                if ($pdo->inTransaction()) $pdo->rollBack();
                if ($newAvatarAbsolute !== null) @unlink($newAvatarAbsolute);
                throw $e;
            }

            $oldAvatar = (string)($existing['avatar_path'] ?? '');
            if ($newAvatarPath !== null && $oldAvatar !== '') {
                @unlink(dirname(__DIR__, 2) . '/storage/' . ltrim($oldAvatar, '/'));
            } elseif ($clearAvatar && $oldAvatar !== '') {
                @unlink(dirname(__DIR__, 2) . '/storage/' . ltrim($oldAvatar, '/'));
            }

            if ($clearAvatar && $newAvatarAbsolute !== null) {
                @unlink($newAvatarAbsolute);
            }

            return Response::json([
                'success' => true,
                'data' => [
                    'id' => (int)$user['id'],
                    'username' => $username,
                    'full_name' => $fullName,
                    'role' => (string)$user['role'],
                    'avatar_url' => $clearAvatar
                        ? null
                        : ($newAvatarPath !== null || $existing['avatar_path'] ? '/api/v1/profile/avatar' : null),
                    'csrf' => Csrf::token(),
                ],
            ]);
        } catch (\SAMS\Exceptions\AdministrationException $e) {
            return Response::json([
                'success' => false,
                'error' => $e->getMessage(),
            ], $e->httpStatus());
        } catch (\InvalidArgumentException $e) {
            return Response::json([
                'success' => false,
                'error' => $e->getMessage(),
            ], 422);
        } catch (\Throwable $e) {
            error_log('[SAMS profile] ' . $e->getMessage());
            return Response::json([
                'success' => false,
                'error' => 'Server error.',
            ], 500);
        }
    }
}