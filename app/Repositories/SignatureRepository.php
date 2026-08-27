<?php
declare(strict_types=1); namespace SAMS\Repositories; use SAMS\Helpers\Database; final class SignatureRepository{public function find(int $teacherId,int $classId):?array{$q=Database::connection()->prepare('SELECT id,signature_data,mime_type FROM signatures WHERE teacher_id=? AND class_id=? LIMIT 1');$q->execute([$teacherId,$classId]);return $q->fetch()?:null;}}
