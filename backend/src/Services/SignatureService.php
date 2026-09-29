<?php

declare(strict_types=1);

namespace SAMS\Services;

use InvalidArgumentException;
use SAMS\Helpers\Database;
use SAMS\Repositories\AuditLogRepository;
use SAMS\Repositories\SignatureRepository;

final class SignatureService
{
    public function __construct(
        private readonly SignatureRepository $signatures = new SignatureRepository(),
        private readonly AuditLogRepository $audit = new AuditLogRepository(),
    ) {}

    public function validatePngDataUrl(string $data): string
    {
        if (!preg_match('/^data:image\/png;base64,(?<encoded>[A-Za-z0-9+\/]*={0,2})$/', $data, $matches)) {
            throw new InvalidArgumentException('Invalid PNG signature data.');
        }
        if (strlen($data) > 500000) {
            throw new InvalidArgumentException('Signature is too large.');
        }

        $decoded = base64_decode($matches['encoded'], true);
        if ($decoded === false || !str_starts_with($decoded, "\x89PNG\r\n\x1a\n")) {
            throw new InvalidArgumentException('Invalid PNG signature data.');
        }

        return $data;
    }

    public function get(int $teacherId, int $classId, int $schoolId): ?array
    {
        $this->assertSchoolId($schoolId);
        return $this->signatures->findByTeacherAndClass($teacherId, $classId, $schoolId);
    }

    public function save(int $teacherId, int $classId, string $data, int $schoolId): array
    {
        $this->assertSchoolId($schoolId);
        $data = $this->validatePngDataUrl($data);
        $pdo = Database::connection();
        $pdo->beginTransaction();

        try {
            $existing = $this->signatures->findByTeacherAndClass($teacherId, $classId, $schoolId);
            $this->signatures->upsert($teacherId, $classId, $data, $schoolId);
            $this->audit->record(
                $teacherId,
                'signature.upsert',
                'signature',
                $existing ? (int)$existing['id'] : null,
                ['class_id' => $classId]
            );
            $pdo->commit();
        } catch (\Throwable $e) {
            if ($pdo->inTransaction()) {
                $pdo->rollBack();
            }
            throw $e;
        }

        $saved = $this->signatures->findByTeacherAndClass($teacherId, $classId, $schoolId);
        if ($saved === null) {
            throw new \RuntimeException('Signature was not persisted.');
        }
        return $saved;
    }

    public function delete(int $teacherId, int $classId, int $schoolId): bool
    {
        $this->assertSchoolId($schoolId);
        $pdo = Database::connection();
        $pdo->beginTransaction();

        try {
            $existing = $this->signatures->findByTeacherAndClass($teacherId, $classId, $schoolId);
            $this->signatures->delete($teacherId, $classId, $schoolId);

            if ($existing !== null) {
                $this->audit->record(
                    $teacherId,
                    'signature.delete',
                    'signature',
                    (int)$existing['id'],
                    ['class_id' => $classId]
                );
            }

            $pdo->commit();
            return $existing !== null;
        } catch (\Throwable $e) {
            if ($pdo->inTransaction()) {
                $pdo->rollBack();
            }
            throw $e;
        }
    }

    private function assertSchoolId(int $schoolId): void
    {
        if ($schoolId < 1) {
            throw new InvalidArgumentException('Invalid school.');
        }
    }
}
